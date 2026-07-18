CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    parent_id UUID,
    CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES transaction_categories(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    category_id UUID,
    description VARCHAR(500) NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50),
    recurrent BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_transaction_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_transaction_category FOREIGN KEY (category_id) REFERENCES transaction_categories(id)
);

CREATE TABLE IF NOT EXISTS financial_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    analysis_period VARCHAR(20),
    profile_classification VARCHAR(50),
    score NUMERIC(5, 2),
    confidence NUMERIC(4, 3),
    model_versions JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_analysis_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS financial_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL UNIQUE,
    monthly_income NUMERIC(19, 2),
    total_income NUMERIC(19, 2),
    total_expenses NUMERIC(19, 2),
    monthly_balance NUMERIC(19, 2),
    income_commitment_pct NUMERIC(5, 2),
    debt_level_pct NUMERIC(5, 2),
    savings_rate_pct NUMERIC(5, 2),
    fixed_expenses_pct NUMERIC(5, 2),
    non_essential_expenses_pct NUMERIC(5, 2),
    recurring_expenses_count INTEGER,
    top_category VARCHAR(50),
    variation_pct NUMERIC(5, 2),
    reserve_in_months NUMERIC(19, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_indicator_analysis FOREIGN KEY (analysis_id) REFERENCES financial_analyses(id)
);

CREATE TABLE IF NOT EXISTS spending_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL,
    category_code VARCHAR(50) NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL,
    CONSTRAINT fk_spending_summary_analysis FOREIGN KEY (analysis_id) REFERENCES financial_analyses(id)
);

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    reason TEXT,
    priority VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    expected_impact TEXT,
    suggested_amount NUMERIC(19, 2),
    related_indicator VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_recommendation_analysis FOREIGN KEY (analysis_id) REFERENCES financial_analyses(id)
);

CREATE TABLE IF NOT EXISTS agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_conversation_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id)
);

CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    loaded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS imported_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_imported_file_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON financial_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_spending_summary_analysis_id ON spending_summaries(analysis_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_analysis_id ON recommendations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_id ON agent_messages(conversation_id);
