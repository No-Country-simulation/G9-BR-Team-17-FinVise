-- Table to store RAG document chunks, metadata, and vector embeddings per user
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- 'CSV_IMPORT', 'OPEN_FINANCE', 'MANUAL'
    source_id VARCHAR(255),
    document_chunk TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user isolation and filtering
CREATE INDEX IF NOT EXISTS idx_rag_documents_user_id ON rag_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source_type ON rag_documents(user_id, source_type);
