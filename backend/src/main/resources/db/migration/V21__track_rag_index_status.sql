ALTER TABLE rag_documents
    ADD COLUMN IF NOT EXISTS index_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS index_error TEXT,
    ADD COLUMN IF NOT EXISTS index_attempted_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'rag_documents'
          AND column_name = 'embedding'
    ) THEN
        EXECUTE '
            UPDATE rag_documents
            SET index_status = CASE
                WHEN embedding IS NOT NULL THEN ''INDEXED''
                ELSE ''PENDING''
            END
        ';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_rag_documents_index_status'
    ) THEN
        ALTER TABLE rag_documents
            ADD CONSTRAINT chk_rag_documents_index_status
            CHECK (index_status IN ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rag_documents_index_status
    ON rag_documents(user_id, source_id, index_status);
