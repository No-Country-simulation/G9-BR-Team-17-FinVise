ALTER TABLE agent_conversations
    ADD COLUMN IF NOT EXISTS history_summary TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS summarized_through_created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS summarized_through_message_id UUID,
    ADD COLUMN IF NOT EXISTS summarized_message_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS active_request_id UUID,
    ADD COLUMN IF NOT EXISTS active_request_started_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS agent_message_requests (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    user_message_id UUID,
    assistant_message_id UUID,
    error_code VARCHAR(80),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_agent_request_conversation
        FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_request_user_message
        FOREIGN KEY (user_message_id) REFERENCES agent_messages(id) ON DELETE SET NULL,
    CONSTRAINT fk_agent_request_assistant_message
        FOREIGN KEY (assistant_message_id) REFERENCES agent_messages(id) ON DELETE SET NULL,
    CONSTRAINT chk_agent_request_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_agent_conversation_active_request'
    ) THEN
        ALTER TABLE agent_conversations
            ADD CONSTRAINT fk_agent_conversation_active_request
            FOREIGN KEY (active_request_id) REFERENCES agent_message_requests(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_message_requests_conversation_created
    ON agent_message_requests(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created_desc
    ON agent_messages(conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_agent_scope
    ON transactions(user_id, source, import_source_id, type, transaction_date DESC)
    INCLUDE (amount, category_id, recurrent, description, payment_method);
