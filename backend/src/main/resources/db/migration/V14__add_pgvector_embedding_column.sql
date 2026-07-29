-- Enable pgvector extension if available and add embedding vector column to rag_documents
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE rag_documents 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Optional vector index for similarity search
CREATE INDEX IF NOT EXISTS idx_rag_documents_user_embedding 
ON rag_documents(user_id) WHERE embedding IS NOT NULL;
