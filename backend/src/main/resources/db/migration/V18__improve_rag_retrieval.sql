ALTER TABLE rag_documents
    ADD COLUMN IF NOT EXISTS chunk_type VARCHAR(40) NOT NULL DEFAULT 'TRANSACTION',
    ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(120),
    ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_rag_documents_source_filter
    ON rag_documents(user_id, source_type, source_id, chunk_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_documents_derived_chunk
    ON rag_documents(user_id, source_type, source_id, chunk_type, content_hash)
    WHERE content_hash IS NOT NULL AND transaction_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rag_documents_full_text
    ON rag_documents USING gin (to_tsvector('simple', document_chunk));
