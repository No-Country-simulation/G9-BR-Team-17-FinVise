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
        raw_url = os.getenv(
            "SPRING_DATASOURCE_URL",
            os.getenv("DATABASE_URL", "jdbc:postgresql://postgres:5432/finvise"),
        )
        cleaned = raw_url.replace("jdbc:postgresql://", "").replace("postgresql://", "")
        if "@" in cleaned:
            cleaned = cleaned.split("@", 1)[1]
        host_port, _, dbname = cleaned.partition("/")
        if ":" in host_port:
            self.db_host, port_str = host_port.rsplit(":", 1)
            self.db_port = int(port_str)
        else:
            self.db_host = host_port
            self.db_port = 5432
        self.db_name = dbname.split("?")[0] if dbname else "finvise"
        self.db_user = os.getenv(
            "SPRING_DATASOURCE_USERNAME", os.getenv("POSTGRES_USER", "finvise")
        )
        self.db_pass = os.getenv(
            "SPRING_DATASOURCE_PASSWORD", os.getenv("POSTGRES_PASSWORD", "")
        )
        self.dimension = 1536

    def _get_connection(self):
        return psycopg.connect(
            host=self.db_host,
            port=self.db_port,
            dbname=self.db_name,
            user=self.db_user,
            password=self.db_pass,
        )

    def _ensure_embedding_column(self, conn: psycopg.Connection) -> bool:
        """Read-only capability check. Schema changes belong exclusively to Flyway."""
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'rag_documents'
                          AND column_name = 'embedding'
                    );
                    """
                )
                row = cur.fetchone()
                return bool(row and row[0])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not verify pgvector schema: %s", exc)
            return False

    def _uses_remote_embeddings(self) -> bool:
        return bool(settings.rag_enable_remote_embeddings and settings.llm_api_key)

    def _embedding_model_name(self) -> str:
        if self._uses_remote_embeddings():
            return settings.rag_embedding_model
        return "local-hash-v2"

    def _generate_local_embedding(self, text: str) -> list[float]:
        """Deterministic development fallback; production should configure the embedding API."""
        vector = [0.0] * self.dimension
        normalized = "".join(
            character if character.isalnum() else " " for character in text.lower()
        )
        tokens = normalized.split()
        features = tokens + [
            f"{tokens[index]}_{tokens[index + 1]}"
            for index in range(max(0, len(tokens) - 1))
        ]
        for feature in features:
            digest = hashlib.sha256(feature.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm:
            return [value / norm for value in vector]
        vector[0] = 1.0
        return vector

    def generate_embedding(self, text: str) -> list[float]:
        return self.generate_embeddings_batch([text])[0]

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self._uses_remote_embeddings():
            return [self._generate_local_embedding(text) for text in texts]

        response = httpx.post(
            f"{settings.llm_base_url.rstrip('/')}/embeddings",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={"model": settings.rag_embedding_model, "input": texts},
            timeout=settings.llm_timeout_seconds,
        )
        response.raise_for_status()
        items = sorted(response.json()["data"], key=lambda item: item["index"])
        vectors = [item["embedding"] for item in items]
        if len(vectors) != len(texts) or any(
            len(vector) != self.dimension for vector in vectors
        ):
            raise ValueError("Embedding provider returned an unexpected vector shape")
        return vectors

    def index_unembedded_chunks(
        self,
        user_id: str,
        source_ids: list[str] | None = None,
    ) -> int:
        if not user_id:
            return 0

        normalized_sources = self._normalize_source_ids(source_ids)
        source_clause = " AND source_id = ANY(%s)" if normalized_sources else ""
        model_name = self._embedding_model_name()
        batch_size = max(1, min(settings.rag_embedding_batch_size, 500))
        max_batches = max(1, min(settings.rag_index_max_batches, 100))
        total_updated = 0

        try:
            with self._get_connection() as conn:
                if not self._ensure_embedding_column(conn):
                    return 0

                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT pg_try_advisory_lock(hashtext(%s));", (user_id,)
                    )
                    lock = cur.fetchone()
                    if not lock or not lock[0]:
                        logger.info("RAG indexing already running for user_id=%s", user_id)
                        return 0

                for _ in range(max_batches):
                    with conn.cursor() as cur:
                        query = f"""
                            SELECT id, document_chunk
                            FROM rag_documents
                            WHERE user_id = %s::uuid{source_clause}
                              AND (
                                  embedding IS NULL
                                  OR embedding_model IS DISTINCT FROM %s
                              )
                            ORDER BY created_at, id
                            LIMIT %s
                            FOR UPDATE SKIP LOCKED;
                        """
                        params: list[Any] = [user_id]
                        if normalized_sources:
                            params.append(normalized_sources)
                        params.extend([model_name, batch_size])
                        cur.execute(query, tuple(params))
                        rows = cur.fetchall()
                        if not rows:
                            break

                    self._mark_index_status(conn, rows, "PROCESSING")
                    conn.commit()

                    try:
                        vectors = self.generate_embeddings_batch(
                            [row[1] for row in rows]
                        )
                    except Exception as exc:  # noqa: BLE001
                        conn.rollback()
                        self._mark_index_status(
                            conn,
                            rows,
                            "FAILED",
                            str(exc)[:1000],
                        )
                        conn.commit()
                        logger.error(
                            "RAG embedding batch failed for user_id=%s: %s",
                            user_id,
                            exc,
                        )
                        break

                    with conn.cursor() as cur:
                        cur.executemany(
                            """
                            UPDATE rag_documents
                            SET embedding = %s::vector,
                                embedding_model = %s,
                                embedding_created_at = CURRENT_TIMESTAMP,
                                index_status = 'INDEXED',
                                index_error = NULL,
                                index_attempted_at = CURRENT_TIMESTAMP
                            WHERE id = %s::uuid;
                            """,
                            [
                                (json.dumps(vector), model_name, document_id)
                                for (document_id, _), vector in zip(
                                    rows, vectors, strict=True
                                )
                            ],
                        )
                        total_updated += len(rows)
                    conn.commit()
                    if len(rows) < batch_size:
                        break
        except Exception as exc:  # noqa: BLE001
            logger.error("RAG indexing failed for user_id=%s: %s", user_id, exc)
            return total_updated

        if total_updated:
            logger.info(
                "Indexed %d RAG embeddings with model=%s for user_id=%s",
                total_updated,
                model_name,
                user_id,
            )
        return total_updated

    def _mark_index_status(
        self,
        conn: psycopg.Connection,
        rows: list[tuple[Any, ...]],
        status: str,
        error: str | None = None,
    ) -> None:
        if not rows:
            return
        with conn.cursor() as cur:
            cur.executemany(
                """
                UPDATE rag_documents
                SET index_status = %s,
                    index_error = %s,
                    index_attempted_at = CURRENT_TIMESTAMP
                WHERE id = %s::uuid;
                """,
                [(status, error, row[0]) for row in rows],
            )

    def retrieve_context(
        self,
        user_id: str,
        query: str,
        limit: int = 5,
        source_type: str | None = None,
        source_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        if not user_id:
            logger.warning("RAG search called without user_id")
            return []

        top_k = max(1, min(limit, 20))
        normalized_source = (
            source_type.strip().upper()
            if source_type and source_type.strip()
            else None
        )
        normalized_sources = self._normalize_source_ids(source_ids)
        filter_sql, filter_params = self._filters(normalized_source, normalized_sources)

        try:
            with self._get_connection() as conn:
                has_vector = self._ensure_embedding_column(conn)
                if has_vector and query.strip():
                    vector_results = self._vector_search(
                        conn,
                        user_id,
                        query,
                        top_k,
                        filter_sql,
                        filter_params,
                    )
                    if vector_results:
                        return self._diversify(vector_results, top_k, normalized_sources)

                keyword_results = self._keyword_search(
                    conn,
                    user_id,
                    query,
                    top_k,
                    filter_sql,
                    filter_params,
                )
                return self._diversify(
                    keyword_results, top_k, normalized_sources
                )
        except Exception as exc:  # noqa: BLE001
            logger.error("RAG retrieval failed: %s", exc)
            return []

    def _vector_search(
        self,
        conn: psycopg.Connection,
        user_id: str,
        query: str,
        limit: int,
        filter_sql: str,
        filter_params: list[Any],
    ) -> list[dict[str, Any]]:
        try:
            query_vector = json.dumps(self.generate_embedding(query))
            candidate_limit = min(limit * 4, 80)
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT id, source_type, source_id, chunk_type, document_chunk,
                           metadata, created_at,
                           (embedding <=> %s::vector) AS distance,
                           ts_rank_cd(
                               to_tsvector('simple', document_chunk),
                               plainto_tsquery('simple', %s)
                           ) AS keyword_rank
                    FROM rag_documents
                    WHERE user_id = %s::uuid{filter_sql}
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector ASC
                    LIMIT %s;
                    """,
                    (
                        query_vector,
                        query,
                        user_id,
                        *filter_params,
                        query_vector,
                        candidate_limit,
                    ),
                )
                rows = cur.fetchall()
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            logger.warning("Vector retrieval failed; using keyword search: %s", exc)
            return []

        results = []
        for row in rows:
            similarity = max(0.0, 1.0 - float(row[7]))
            keyword_rank = float(row[8] or 0.0)
            if similarity < settings.rag_min_relevance and keyword_rank <= 0:
                continue
            results.append(
                self._result(
                    row[:7],
                    score=min(1.0, similarity + min(keyword_rank, 1.0) * 0.1),
                )
            )
        return results

    def _keyword_search(
        self,
        conn: psycopg.Connection,
        user_id: str,
        query: str,
        limit: int,
        filter_sql: str,
        filter_params: list[Any],
    ) -> list[dict[str, Any]]:
        with conn.cursor() as cur:
            if query.strip():
                cur.execute(
                    f"""
                    SELECT id, source_type, source_id, chunk_type, document_chunk,
                           metadata, created_at,
                           ts_rank_cd(
                               to_tsvector('simple', document_chunk),
                               plainto_tsquery('simple', %s)
                           ) AS keyword_rank
                    FROM rag_documents
                    WHERE user_id = %s::uuid{filter_sql}
                      AND to_tsvector('simple', document_chunk)
                          @@ plainto_tsquery('simple', %s)
                    ORDER BY keyword_rank DESC, created_at DESC
                    LIMIT %s;
                    """,
                    (query, user_id, *filter_params, query, limit),
                )
            else:
                cur.execute(
                    f"""
                    SELECT id, source_type, source_id, chunk_type, document_chunk,
                           metadata, created_at, 0.0 AS keyword_rank
                    FROM rag_documents
                    WHERE user_id = %s::uuid{filter_sql}
                    ORDER BY created_at DESC
                    LIMIT %s;
                    """,
                    (user_id, *filter_params, limit),
                )
            return [
                self._result(row[:7], score=float(row[7] or 0.0))
                for row in cur.fetchall()
            ]

    def _result(self, row: tuple[Any, ...], score: float) -> dict[str, Any]:
        metadata = row[5]
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except json.JSONDecodeError:
                metadata = {}
        metadata = metadata or {}
        return {
            "id": str(row[0]),
            "source_type": row[1],
            "source_id": row[2],
            "chunk_type": row[3],
            "content": row[4],
            "metadata": metadata,
            "source_name": metadata.get("sourceName") or row[2],
            "created_at": str(row[6]),
            "score": round(score, 4),
        }

    def _filters(
        self,
        source_type: str | None,
        source_ids: list[str],
    ) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if source_type:
            clauses.append("source_type = %s")
            params.append(source_type)
        if source_ids:
            clauses.append("source_id = ANY(%s)")
            params.append(source_ids)
        return (
            "".join(f" AND {clause}" for clause in clauses),
            params,
        )

    def _diversify(
        self,
        results: list[dict[str, Any]],
        limit: int,
        selected_sources: list[str],
    ) -> list[dict[str, Any]]:
        if len(selected_sources) < 2:
            return results[:limit]
        selected: list[dict[str, Any]] = []
        used_ids: set[str] = set()
        for source_id in selected_sources:
            match = next(
                (item for item in results if item["source_id"] == source_id), None
            )
            if match and match["id"] not in used_ids:
                selected.append(match)
                used_ids.add(match["id"])
                if len(selected) == limit:
                    return selected
        for item in results:
            if item["id"] not in used_ids:
                selected.append(item)
                used_ids.add(item["id"])
                if len(selected) == limit:
                    break
        return selected

    def _normalize_source_ids(self, source_ids: list[str] | None) -> list[str]:
        return list(
            dict.fromkeys(
                source_id.strip()
                for source_id in (source_ids or [])
                if source_id and source_id.strip()
            )
        )[:100]


rag_service = RAGService()
