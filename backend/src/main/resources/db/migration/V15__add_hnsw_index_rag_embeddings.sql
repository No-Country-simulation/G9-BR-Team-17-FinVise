-- Create HNSW index for efficient cosine similarity search on rag_documents embeddings.
-- Uses DO block with EXCEPTION handler so the migration succeeds even if pgvector
-- is not installed in the PostgreSQL environment (e.g., CI/CD embedded Postgres).
DO $$
BEGIN
    BEGIN
        -- HNSW index for cosine similarity (operator class vector_cosine_ops)
        -- m=16 and ef_construction=64 are good defaults for moderate-sized datasets
        CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding_hnsw
        ON rag_documents USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgvector HNSW index creation skipped: %', SQLERRM;
    END;
END $$;
