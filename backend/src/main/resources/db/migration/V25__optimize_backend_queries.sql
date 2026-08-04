CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created_id
    ON agent_messages(conversation_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_financial_analyses_user_created
    ON financial_analyses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_analyses_user_source_created
    ON financial_analyses(user_id, (model_versions ->> 'transactionSource'), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_analyses_user_import_source_created
    ON financial_analyses(user_id, (model_versions ->> 'importSourceId'), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_created
    ON agent_conversations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_source_import_date
    ON transactions(user_id, source, import_source_id, transaction_date DESC);
