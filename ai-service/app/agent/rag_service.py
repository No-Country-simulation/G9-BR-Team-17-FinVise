import hashlib
import json
import math
import os
from collections.abc import Callable
from threading import Lock
from time import perf_counter
from typing import Any

import psycopg
from psycopg_pool import ConnectionPool

from app.agent.rag_metrics import rag_retrieval_metrics
from app.core.config import settings
from app.core.http_client import get_http_client
from app.core.logging import get_logger

logger = get_logger(__name__)


class RAGIndexBusyError(RuntimeError):
    """Raised when another worker already owns the per-user indexing lock."""


class RAGService:
    def __init__(
        self,
        pool_factory: Callable[..., ConnectionPool] = ConnectionPool,
    ) -> None:
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
        self._pool_factory = pool_factory
        self._pool: ConnectionPool | None = None
        self._pool_lock = Lock()

    def open(self) -> None:
        """Creates the pool without forcing a database connection at startup."""
        with self._pool_lock:
            if self._pool is not None:
                return
            if settings.rag_db_pool_min_size > settings.rag_db_pool_max_size:
                raise ValueError(
                    "RAG_DB_POOL_MIN_SIZE must not exceed RAG_DB_POOL_MAX_SIZE"
                )
            pool = self._pool_factory(
                "",
                kwargs={
                    "host": self.db_host,
                    "port": self.db_port,
                    "dbname": self.db_name,
                    "user": self.db_user,
                    "password": self.db_pass,
                },
                min_size=settings.rag_db_pool_min_size,
                max_size=settings.rag_db_pool_max_size,
                timeout=settings.rag_db_pool_timeout_seconds,
                open=False,
                name="rag-postgresql",
            )
            pool.open(wait=False)
            self._pool = pool

    def close(self) -> None:
        with self._pool_lock:
            if self._pool is None:
                return
            self._pool.close()
            self._pool = None

    def _get_connection(self):
        self.open()
        pool = self._pool
        if pool is None:  # pragma: no cover - protected by open()
            raise RuntimeError("RAG PostgreSQL pool is not available")
        return pool.connection(timeout=settings.rag_db_pool_timeout_seconds)

    def _ensure_embedding_column(self, conn: psycopg.Connection) -> bool:
        """Checks the model-isolated vector store created exclusively by Flyway."""
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'rag_document_embeddings'
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

        response = get_http_client().post(
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
        requested_max_batches: int | None = None,
    ) -> int:
        if not user_id:
            return 0

        normalized_sources = self._normalize_source_ids(source_ids)
        source_clause = (
            " AND documents.source_id = ANY(%s)" if normalized_sources else ""
        )
        model_name = self._embedding_model_name()
        batch_size = max(1, min(settings.rag_embedding_batch_size, 500))
        configured_max_batches = max(1, min(settings.rag_index_max_batches, 100))
        max_batches = (
            configured_max_batches
            if requested_max_batches is None
            else max(1, min(requested_max_batches, configured_max_batches))
        )
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
                        raise RAGIndexBusyError(
                            f"RAG indexing already running for user_id={user_id}"
                        )

                for _ in range(max_batches):
                    with conn.cursor() as cur:
                        query = f"""
                            SELECT documents.id, documents.document_chunk
                            FROM rag_documents documents
                            WHERE documents.user_id = %s::uuid{source_clause}
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM rag_document_embeddings embeddings
                                  WHERE embeddings.document_id = documents.id
                                    AND embeddings.embedding_model = %s
                                    AND embeddings.embedding IS NOT NULL
                              )
                            ORDER BY documents.created_at, documents.id
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
                        raise

                    with conn.cursor() as cur:
                        cur.executemany(
                            """
                            INSERT INTO rag_document_embeddings (
                                document_id, embedding_model, dimensions, embedding, created_at
                            )
                            VALUES (%s::uuid, %s, %s, %s::vector, CURRENT_TIMESTAMP)
                            ON CONFLICT (document_id, embedding_model) DO UPDATE
                            SET dimensions = EXCLUDED.dimensions,
                                embedding = EXCLUDED.embedding,
                                created_at = EXCLUDED.created_at;
                            """,
                            [
                                (document_id, model_name, self.dimension, json.dumps(vector))
                                for (document_id, _), vector in zip(
                                    rows, vectors, strict=True
                                )
                            ],
                        )
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
            raise

        if total_updated:
            logger.info(
                "Indexed %d RAG embeddings with model=%s for user_id=%s",
                total_updated,
                model_name,
                user_id,
            )
        return total_updated

    def has_unembedded_chunks(
        self,
        user_id: str,
        source_ids: list[str] | None = None,
    ) -> bool:
        if not user_id:
            return False

        normalized_sources = self._normalize_source_ids(source_ids)
        source_clause = (
            " AND documents.source_id = ANY(%s)" if normalized_sources else ""
        )
        params: list[Any] = [user_id]
        if normalized_sources:
            params.append(normalized_sources)
        params.append(self._embedding_model_name())

        with self._get_connection() as conn:
            if not self._ensure_embedding_column(conn):
                return False
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT EXISTS (
                        SELECT 1
                        FROM rag_documents documents
                        WHERE documents.user_id = %s::uuid{source_clause}
                          AND NOT EXISTS (
                              SELECT 1
                              FROM rag_document_embeddings embeddings
                              WHERE embeddings.document_id = documents.id
                                AND embeddings.embedding_model = %s
                                AND embeddings.embedding IS NOT NULL
                          )
                    );
                    """,
                    tuple(params),
                )
                row = cur.fetchone()
                return bool(row and row[0])

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

        started_at = perf_counter()
        top_k = max(1, min(limit, 20))
        candidate_limit = min(
            top_k * settings.rag_candidate_multiplier,
            200,
        )
        normalized_source = (
            source_type.strip().upper()
            if source_type and source_type.strip()
            else None
        )
        normalized_sources = self._normalize_source_ids(source_ids)
        filter_sql, filter_params = self._filters(normalized_source, normalized_sources)
        vector_results: list[dict[str, Any]] = []
        text_results: list[dict[str, Any]] = []
        vector_failed = False
        text_failed = False
        results: list[dict[str, Any]] = []

        try:
            with self._get_connection() as conn:
                has_vector = self._ensure_embedding_column(conn)
                if has_vector and query.strip():
                    vector_results, vector_failed = self._vector_search(
                        conn,
                        user_id,
                        query,
                        candidate_limit,
                        filter_sql,
                        filter_params,
                    )

                try:
                    text_results = self._keyword_search(
                        conn,
                        user_id,
                        query,
                        candidate_limit,
                        filter_sql,
                        filter_params,
                    )
                except Exception as exc:  # noqa: BLE001
                    conn.rollback()
                    text_failed = True
                    logger.warning("Portuguese full-text retrieval failed: %s", exc)
                fused = self._fuse_rankings(vector_results, text_results)
                results = self._diversify(
                    fused, top_k, normalized_sources
                )
        except Exception as exc:  # noqa: BLE001
            logger.error("RAG retrieval failed: %s", exc)
            results = []
        finally:
            rag_retrieval_metrics.record(
                duration_ms=(perf_counter() - started_at) * 1000,
                vector_results=len(vector_results),
                text_results=len(text_results),
                result_count=len(results),
                vector_failed=vector_failed,
                text_failed=text_failed,
            )
        return results

    def _vector_search(
        self,
        conn: psycopg.Connection,
        user_id: str,
        query: str,
        limit: int,
        filter_sql: str,
        filter_params: list[Any],
    ) -> tuple[list[dict[str, Any]], bool]:
        try:
            query_vector = json.dumps(self.generate_embedding(query))
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT documents.id, documents.source_type, documents.source_id,
                           documents.chunk_type, documents.document_chunk,
                           documents.metadata, documents.created_at,
                           (embeddings.embedding <=> %s::vector) AS distance
                    FROM rag_document_embeddings embeddings
                    JOIN rag_documents documents ON documents.id = embeddings.document_id
                    WHERE documents.user_id = %s::uuid{filter_sql}
                      AND embeddings.embedding_model = %s
                      AND embeddings.embedding IS NOT NULL
                    ORDER BY embeddings.embedding <=> %s::vector ASC
                    LIMIT %s;
                    """,
                    (
                        query_vector,
                        user_id,
                        *filter_params,
                        self._embedding_model_name(),
                        query_vector,
                        limit,
                    ),
                )
                rows = cur.fetchall()
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            logger.warning("Vector retrieval failed; using keyword search: %s", exc)
            return [], True

        results = []
        for row in rows:
            similarity = max(0.0, 1.0 - float(row[7]))
            if similarity < settings.rag_min_relevance:
                continue
            results.append(
                self._result(
                    row[:7],
                    score=similarity,
                    vector_score=similarity,
                )
            )
        return results, False

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
                               search_vector,
                               websearch_to_tsquery('portuguese', %s)
                           ) AS keyword_rank
                    FROM rag_documents
                    WHERE user_id = %s::uuid{filter_sql}
                      AND search_vector
                          @@ websearch_to_tsquery('portuguese', %s)
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
                self._result(
                    row[:7],
                    score=float(row[7] or 0.0),
                    text_score=float(row[7] or 0.0),
                )
                for row in cur.fetchall()
            ]

    def _result(
        self,
        row: tuple[Any, ...],
        score: float,
        *,
        vector_score: float = 0.0,
        text_score: float = 0.0,
    ) -> dict[str, Any]:
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
            "vector_score": round(vector_score, 4),
            "text_score": round(text_score, 4),
        }

    def _fuse_rankings(
        self,
        vector_results: list[dict[str, Any]],
        text_results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Fuses independent vector and Portuguese FTS rankings with weighted RRF."""
        fused: dict[str, dict[str, Any]] = {}
        rrf_k = settings.rag_hybrid_rrf_k
        channels = (
            ("vector", vector_results, settings.rag_vector_weight),
            ("text", text_results, settings.rag_text_weight),
        )
        for channel, results, weight in channels:
            for rank, result in enumerate(results, start=1):
                document_id = result["id"]
                item = fused.setdefault(
                    document_id,
                    {
                        **result,
                        "vector_score": 0.0,
                        "text_score": 0.0,
                        "retrieval_channels": [],
                        "_rrf_score": 0.0,
                    },
                )
                item["_rrf_score"] += weight / (rrf_k + rank)
                item[f"{channel}_rank"] = rank
                item[f"{channel}_score"] = result[f"{channel}_score"]
                item["retrieval_channels"].append(channel)

        maximum_rrf = (
            settings.rag_vector_weight + settings.rag_text_weight
        ) / (rrf_k + 1)
        ordered = sorted(
            fused.values(),
            key=lambda item: (
                item["_rrf_score"],
                max(item["vector_score"], item["text_score"]),
                item["created_at"],
            ),
            reverse=True,
        )
        for item in ordered:
            item["score"] = round(item["_rrf_score"] / maximum_rrf, 4)
            item.pop("_rrf_score", None)
        return ordered

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
