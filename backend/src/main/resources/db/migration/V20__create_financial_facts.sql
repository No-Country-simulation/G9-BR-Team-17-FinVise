CREATE TABLE IF NOT EXISTS financial_fact_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    schema_version VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    facts JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_financial_fact_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_financial_fact_source
        UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_fact_user_source
    ON financial_fact_snapshots(user_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_financial_fact_period
    ON financial_fact_snapshots(user_id, period_start, period_end);
