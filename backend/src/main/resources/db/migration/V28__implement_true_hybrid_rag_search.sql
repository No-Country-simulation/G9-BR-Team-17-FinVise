-- Keep embeddings isolated by model while preserving textual retrieval when pgvector is absent.
CREATE TABLE IF NOT EXISTS rag_document_embeddings (
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    embedding_model VARCHAR(120) NOT NULL,
    dimensions INTEGER NOT NULL DEFAULT 1536,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, embedding_model),
    CONSTRAINT chk_rag_document_embeddings_dimensions CHECK (dimensions > 0)
);

CREATE INDEX IF NOT EXISTS idx_rag_document_embeddings_model_document
    ON rag_document_embeddings(embedding_model, document_id);

ALTER TABLE rag_documents
    ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
        GENERATED ALWAYS AS (
            to_tsvector('portuguese', COALESCE(document_chunk, ''))
        ) STORED;

DROP INDEX IF EXISTS idx_rag_documents_full_text;

CREATE INDEX IF NOT EXISTS idx_rag_documents_full_text_pt
    ON rag_documents USING GIN (search_vector);

DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;

        ALTER TABLE rag_document_embeddings
            ADD COLUMN IF NOT EXISTS embedding vector(1536);

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'rag_documents'
              AND column_name = 'embedding'
        ) THEN
            EXECUTE '
                INSERT INTO rag_document_embeddings (
                    document_id, embedding_model, dimensions, embedding, created_at
                )
                SELECT id,
                       embedding_model,
                       1536,
                       embedding,
                       COALESCE(embedding_created_at, created_at, CURRENT_TIMESTAMP)
                FROM rag_documents
                WHERE embedding IS NOT NULL
                  AND embedding_model IS NOT NULL
                ON CONFLICT (document_id, embedding_model) DO UPDATE
                SET embedding = EXCLUDED.embedding,
                    dimensions = EXCLUDED.dimensions,
                    created_at = EXCLUDED.created_at
            ';
        END IF;

        CREATE INDEX IF NOT EXISTS idx_rag_document_embeddings_hnsw
            ON rag_document_embeddings USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
            WHERE embedding IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgvector embedding store creation skipped: %', SQLERRM;
    END;
END $$;

CREATE OR REPLACE FUNCTION invalidate_rag_document_embeddings()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.document_chunk IS DISTINCT FROM NEW.document_chunk
       OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
       OR OLD.schema_version IS DISTINCT FROM NEW.schema_version THEN
        DELETE FROM rag_document_embeddings WHERE document_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invalidate_rag_document_embeddings ON rag_documents;

CREATE TRIGGER trg_invalidate_rag_document_embeddings
AFTER UPDATE OF document_chunk, content_hash, schema_version ON rag_documents
FOR EACH ROW
EXECUTE FUNCTION invalidate_rag_document_embeddings();
