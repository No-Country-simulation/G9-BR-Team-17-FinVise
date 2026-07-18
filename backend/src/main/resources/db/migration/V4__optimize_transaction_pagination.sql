CREATE INDEX IF NOT EXISTS idx_transactions_user_date_created
    ON transactions(user_id, transaction_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date
    ON transactions(user_id, type, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date
    ON transactions(user_id, category_id, transaction_date DESC);
