ALTER TABLE agent_conversations
    ADD COLUMN IF NOT EXISTS rag_source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS rag_top_k INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_agent_conversations_rag_top_k'
    ) THEN
        ALTER TABLE agent_conversations
            ADD CONSTRAINT chk_agent_conversations_rag_top_k
            CHECK (rag_top_k BETWEEN 1 AND 20);
    END IF;
END $$;

ALTER TABLE agent_messages
    ADD COLUMN IF NOT EXISTS rag_sources JSONB;
