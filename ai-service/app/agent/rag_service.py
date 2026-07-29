import os
from typing import Any

import psycopg

from app.core.logging import get_logger

logger = get_logger(__name__)

class RAGService:
    def __init__(self) -> None:
        self.db_url = os.getenv(
            "SPRING_DATASOURCE_URL",
            "jdbc:postgresql://postgres:5432/finvise"
        )
        # Convert JDBC URL format to psycopg DSN format if needed
        if self.db_url.startswith("jdbc:postgresql://"):
            self.dsn = self.db_url.replace("jdbc:postgresql://", "postgresql://")
        else:
            self.dsn = self.db_url

        self.db_user = os.getenv("SPRING_DATASOURCE_USERNAME", "finvise")
        self.db_pass = os.getenv("SPRING_DATASOURCE_PASSWORD", "change_me_in_production")

    def _get_connection(self):
        # Clean DSN format for psycopg
        dsn = self.dsn
        if "postgresql://" in dsn and "@" not in dsn:
            # Inject username and password if not present in host string
            dsn = dsn.replace("postgresql://", f"postgresql://{self.db_user}:{self.db_pass}@")
        return psycopg.connect(dsn)

    def retrieve_context(self, user_id: str, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Retrieves relevant transaction/financial chunks for the user from PostgreSQL RAG store.
        Strictly filters by user_id.
        """
        if not user_id:
            logger.warning("RAG search called without user_id")
            return []

        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Query documents for the given user_id
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
                    logger.info("RAG retrieved %d document chunks for user_id=%s", len(results), user_id)
                    return results
        except Exception as exc:  # noqa: BLE001
            logger.error("RAG retrieval failed: %s", exc)
            return []


rag_service = RAGService()
