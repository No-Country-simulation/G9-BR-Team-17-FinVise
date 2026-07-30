import hashlib
import json
import math
import os
from typing import Any

import httpx
import psycopg

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class RAGService:
    def __init__(self) -> None:
        # Parse JDBC-style URL into host/port/dbname components
        raw_url = os.getenv(
            "SPRING_DATASOURCE_URL",
            os.getenv("DATABASE_URL", "jdbc:postgresql://postgres:5432/finvise")
        )
        # Strip jdbc: prefix if present
        cleaned = raw_url.replace("jdbc:postgresql://", "").replace("postgresql://", "")
        # Remove any userinfo (user:pass@) if embedded in URL
        if "@" in cleaned:
            cleaned = cleaned.split("@", 1)[1]
        # Split host:port/dbname
        host_port, _, dbname = cleaned.partition("/")
        if ":" in host_port:
            self.db_host, port_str = host_port.rsplit(":", 1)
            self.db_port = int(port_str)
        else:
            self.db_host = host_port
            self.db_port = 5432
        self.db_name = dbname.split("?")[0] if dbname else "finvise"

        self.db_user = os.getenv(
            "SPRING_DATASOURCE_USERNAME",
            os.getenv("POSTGRES_USER", "finvise")
        )
        self.db_pass = os.getenv(
            "SPRING_DATASOURCE_PASSWORD",
            os.getenv("POSTGRES_PASSWORD", "")
        )
        self.dimension = 1536

    def _get_connection(self):
        """Creates a psycopg connection using named parameters (safe for special chars in passwords)."""
        return psycopg.connect(
            host=self.db_host,
            port=self.db_port,
            dbname=self.db_name,
            user=self.db_user,
            password=self.db_pass,
        )

    def _ensure_embedding_column(self, conn: psycopg.Connection) -> bool:
        """
        Ensures pgvector extension is enabled and the embedding column exists on rag_documents.
        """
        try:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute(
                    """
                    ALTER TABLE rag_documents
                    ADD COLUMN IF NOT EXISTS embedding vector(1536);
                    """
                )
            conn.commit()
            return True
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            logger.warning("Could not auto-create vector column on rag_documents: %s", exc)
            return False

    def _generate_local_embedding(self, text: str) -> list[float]:
        """Fallback local pseudo-embedding generation (1536-dimensional unit vector)."""
        vec = [0.0] * self.dimension
        tokens = text.lower().split()
        for i, token in enumerate(tokens):
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimension
            vec[idx] += 1.0 / (i + 1)

        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            return [x / norm for x in vec]
        vec[0] = 1.0
        return vec

    def generate_embedding(self, text: str) -> list[float]:
        """
        Generates 1536-dimensional embedding vector for RAG similarity indexing and search.
        Uses OpenAI API if configured; otherwise generates a deterministic normalized vector locally.
        """
        if settings.enable_llm and settings.llm_api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": "text-embedding-3-small",
                    "input": text,
                }
                response = httpx.post(
                    f"{settings.llm_base_url.rstrip('/')}/embeddings",
                    headers=headers,
                    json=payload,
                    timeout=settings.llm_timeout_seconds,
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["data"][0]["embedding"]
            except Exception as exc:  # noqa: BLE001
                logger.warning("OpenAI Embedding API call failed, falling back to local vector: %s", exc)

        return self._generate_local_embedding(text)

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generates 1536-dimensional embedding vectors for a batch of texts in 1 single HTTP request.
        Falls back to fast local pseudo-embeddings if OpenAI API is unavailable or fails.
        """
        if not texts:
            return []

        if settings.enable_llm and settings.llm_api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": "text-embedding-3-small",
                    "input": texts,
                }
                response = httpx.post(
                    f"{settings.llm_base_url.rstrip('/')}/embeddings",
                    headers=headers,
                    json=payload,
                    timeout=30.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    data_items = sorted(data["data"], key=lambda x: x["index"])
                    return [item["embedding"] for item in data_items]
                logger.warning("OpenAI Batch Embedding API returned status %d, using local embeddings", response.status_code)
            except Exception as exc:  # noqa: BLE001
                logger.warning("OpenAI Batch Embedding API call failed: %s", exc)

        return [self._generate_local_embedding(t) for t in texts]

    def index_unembedded_chunks(self, user_id: str) -> int:
        """
        Indexes un-embedded document chunks in pgvector for the given user in batch.
        Processes up to 5 batches of 100 items per call.
        """
        if not user_id:
            return 0

        total_updated = 0
        batch_size = 1000
        max_batches = 2
        batch_count = 0
        try:
            with self._get_connection() as conn:
                if not self._ensure_embedding_column(conn):
                    return 0

                while batch_count < max_batches:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT id, document_chunk
                            FROM rag_documents
                            WHERE user_id = %s::uuid AND embedding IS NULL
                            LIMIT %s;
                            """,
                            (user_id, batch_size)
                        )
                        rows = cur.fetchall()
                        if not rows:
                            break

                        doc_ids = [r[0] for r in rows]
                        texts = [r[1] for r in rows]
                        vectors = self.generate_embeddings_batch(texts)

                        update_params = [
                            (json.dumps(vector), doc_id)
                            for doc_id, vector in zip(doc_ids, vectors, strict=False)
                        ]
                        cur.executemany(
                            """
                            UPDATE rag_documents
                            SET embedding = %s::vector
                            WHERE id = %s::uuid;
                            """,
                            update_params
                        )
                        total_updated += len(doc_ids)
                    conn.commit()
                    batch_count += 1

                    if len(rows) < batch_size:
                        break

            if total_updated > 0:
                logger.info("Indexed %d RAG vector embeddings for user_id=%s", total_updated, user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Embedding indexing step skipped/failed: %s", exc)
        return total_updated

    def retrieve_context(
        self,
        user_id: str,
        query: str,
        limit: int = 5,
        source_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Fast, non-blocking retrieval of relevant transaction/financial chunks for the user from PostgreSQL RAG store.
        Uses pgvector similarity search (distance <=>) when available, falling back to chronological ordering.
        """
        if not user_id:
            logger.warning("RAG search called without user_id")
            return []

        normalized_source = source_type.strip().upper() if source_type and source_type.strip() else None
        source_clause = " AND source_type = %s" if normalized_source else ""

        try:
            with self._get_connection() as conn:
                # Garante que a coluna de embedding existe antes de executar a query vetorial
                has_vector = self._ensure_embedding_column(conn)

                with conn.cursor() as cur:
                    # 1. Tentar busca por similaridade vetorial via pgvector (distância cosseno <=> )
                    if has_vector and query and query.strip():
                        query_vec = self.generate_embedding(query)
                        query_vec_str = json.dumps(query_vec)
                        try:
                            vector_query = f"""
                                SELECT id, source_type, document_chunk, metadata, created_at,
                                       (embedding <=> %s::vector) AS distance
                                FROM rag_documents
                                WHERE user_id = %s::uuid{source_clause}
                                  AND embedding IS NOT NULL
                                ORDER BY embedding <=> %s::vector ASC
                                LIMIT %s;
                            """
                            vector_params: list[Any] = [query_vec_str, user_id]
                            if normalized_source:
                                vector_params.append(normalized_source)
                            vector_params.extend([query_vec_str, limit])
                            cur.execute(vector_query, tuple(vector_params))
                            rows = cur.fetchall()
                            if rows:
                                results = []
                                for row in rows:
                                    results.append({
                                        "id": str(row[0]),
                                        "source_type": row[1],
                                        "content": row[2],
                                        "metadata": row[3],
                                        "created_at": str(row[4]),
                                        "distance": float(row[5]) if row[5] is not None else None
                                    })
                                logger.info("pgvector similarity search retrieved %d chunks for user_id=%s", len(results), user_id)
                                return results
                        except Exception as vec_exc:  # noqa: BLE001
                            conn.rollback()  # Reseta o estado da transação abortada!
                            logger.warning("pgvector similarity search query error, falling back to chronological query: %s", vec_exc)

                    # 2. Fallback para ordenação temporal padrão se os vetores não estiverem preenchidos
                    chronological_query = f"""
                        SELECT id, source_type, document_chunk, metadata, created_at
                        FROM rag_documents
                        WHERE user_id = %s::uuid{source_clause}
                        ORDER BY created_at DESC
                        LIMIT %s;
                    """
                    chronological_params: list[Any] = [user_id]
                    if normalized_source:
                        chronological_params.append(normalized_source)
                    chronological_params.append(limit)
                    cur.execute(chronological_query, tuple(chronological_params))
                    rows = cur.fetchall()
                    results = []
                    for row in rows:
                        results.append({
                            "id": str(row[0]),
                            "source_type": row[1],
                            "content": row[2],
                            "metadata": row[3],
                            "created_at": str(row[4])
                        })
                    logger.info("RAG retrieved %d document chunks chronologically for user_id=%s", len(results), user_id)
                    return results
        except Exception as exc:  # noqa: BLE001
            logger.error("RAG retrieval failed: %s", exc)
            return []


rag_service = RAGService()
