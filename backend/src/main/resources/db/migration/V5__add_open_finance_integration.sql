ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_user_source_external
    ON transactions(user_id, source, external_id)
    WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS open_finance_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    external_item_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_open_finance_provider_item UNIQUE (provider, external_item_id)
);

CREATE INDEX IF NOT EXISTS idx_open_finance_connections_user
    ON open_finance_connections(user_id);
