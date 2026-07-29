-- Enable pgvector extension and add embedding column if pgvector is supported by the Postgres environment
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;
        ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS embedding vector(1536);
        CREATE INDEX IF NOT EXISTS idx_rag_documents_user_embedding 
        ON rag_documents(user_id) WHERE embedding IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        -- If pgvector extension is not installed in the Postgres binary (e.g. embedded Postgres in CI/CD tests),
        -- fallback gracefully so Flyway migration succeeds.
        RAISE NOTICE 'pgvector extension not available in this PostgreSQL environment, skipping vector column.';
    END;
END $$;
