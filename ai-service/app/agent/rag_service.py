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
        self.db_url = os.getenv(
            "SPRING_DATASOURCE_URL",
            os.getenv("DATABASE_URL", "jdbc:postgresql://postgres:5432/finvise")
        )
        if self.db_url.startswith("jdbc:postgresql://"):
            self.dsn = self.db_url.replace("jdbc:postgresql://", "postgresql://")
        else:
            self.dsn = self.db_url

        self.db_user = os.getenv(
            "SPRING_DATASOURCE_USERNAME",
            os.getenv("POSTGRES_USER", "finvise")
        )
        self.db_pass = os.getenv(
            "SPRING_DATASOURCE_PASSWORD",
            os.getenv("POSTGRES_PASSWORD", "change_me_in_production")
        )
        self.dimension = 1536

    def _get_connection(self):
        db_user = os.getenv(
            "SPRING_DATASOURCE_USERNAME",
            os.getenv("POSTGRES_USER", self.db_user)
        )
        db_pass = os.getenv(
            "SPRING_DATASOURCE_PASSWORD",
            os.getenv("POSTGRES_PASSWORD", self.db_pass)
        )
        dsn = self.dsn
        if "postgresql://" in dsn and "@" not in dsn:
            dsn = dsn.replace("postgresql://", f"postgresql://{db_user}:{db_pass}@")
        return psycopg.connect(dsn)

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

        # Fallback local pseudo-embedding generation (1536-dimensional unit vector)
        vec = [0.0] * self.dimension
        tokens = text.lower().split()
        for i, token in enumerate(tokens):
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimension
            vec[idx] += 1.0 / (i + 1)

        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        else:
            vec[0] = 1.0
        return vec

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generates 1536-dimensional embedding vectors for a batch of texts in 1 single HTTP request.
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
                    timeout=settings.llm_timeout_seconds,
                )
                if response.status_code == 200:
                    data = response.json()
                    data_items = sorted(data["data"], key=lambda x: x["index"])
                    return [item["embedding"] for item in data_items]
            except Exception as exc:  # noqa: BLE001
                logger.warning("OpenAI Batch Embedding API call failed, falling back to per-item generation: %s", exc)

        return [self.generate_embedding(t) for t in texts]

    def index_unembedded_chunks(self, user_id: str) -> int:
        """
        Indexes any un-embedded document chunks in pgvector for the given user in batch.
        """
        if not user_id:
            return 0

        updated_count = 0
        try:
            with self._get_connection() as conn:
                if not self._ensure_embedding_column(conn):
                    return 0

                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, document_chunk
                        FROM rag_documents
                        WHERE user_id = %s::uuid AND embedding IS NULL
                        LIMIT 50;
                        """,
                        (user_id,)
                    )
                    rows = cur.fetchall()
                    if rows:
                        doc_ids = [r[0] for r in rows]
                        texts = [r[1] for r in rows]
                        vectors = self.generate_embeddings_batch(texts)
                        for doc_id, vector in zip(doc_ids, vectors, strict=False):
                            vector_str = json.dumps(vector)
                            cur.execute(
                                """
                                UPDATE rag_documents
                                SET embedding = %s::vector
                                WHERE id = %s::uuid;
                                """,
                                (vector_str, doc_id)
                            )
                            updated_count += 1
                conn.commit()
            if updated_count > 0:
                logger.info("Indexed %d RAG vector embeddings for user_id=%s", updated_count, user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Embedding indexing step skipped/failed: %s", exc)
        return updated_count

    def retrieve_context(self, user_id: str, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Retrieves relevant transaction/financial chunks for the user from PostgreSQL RAG store.
        Uses pgvector similarity search (distance <=>) when available, falling back to timestamp ordering.
        """
        if not user_id:
            logger.warning("RAG search called without user_id")
            return []

        # Tenta indexar vetores pendentes antes da busca
        self.index_unembedded_chunks(user_id)

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
                            cur.execute(
                                """
                                SELECT id, source_type, document_chunk, metadata, created_at,
                                       (embedding <=> %s::vector) AS distance
                                FROM rag_documents
                                WHERE user_id = %s::uuid AND embedding IS NOT NULL
                                ORDER BY embedding <=> %s::vector ASC
                                LIMIT %s;
                                """,
                                (query_vec_str, user_id, query_vec_str, limit)
                            )
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
                    cur.execute(
                        """
                        SELECT id, source_type, document_chunk, metadata, created_at
                        FROM rag_documents
                        WHERE user_id = %s::uuid
                        ORDER BY created_at DESC
                        LIMIT %s;
                        """,
                        (user_id, limit)
                    )
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
