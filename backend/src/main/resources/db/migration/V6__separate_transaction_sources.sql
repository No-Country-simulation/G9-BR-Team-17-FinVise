ALTER TABLE agent_conversations
    ADD COLUMN IF NOT EXISTS transaction_source VARCHAR(50) NOT NULL DEFAULT 'CSV_IMPORT';

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_source
    ON agent_conversations(user_id, transaction_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_source_date
    ON transactions(user_id, source, transaction_date DESC);
