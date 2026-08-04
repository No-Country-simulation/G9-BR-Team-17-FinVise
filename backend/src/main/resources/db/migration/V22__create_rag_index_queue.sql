CREATE TABLE rag_index_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rerun_requested BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP WITH TIME ZONE,
    lock_token UUID,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rag_index_jobs_user UNIQUE (user_id),
    CONSTRAINT fk_rag_index_jobs_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_rag_index_jobs_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT chk_rag_index_jobs_attempts CHECK (attempts >= 0),
    CONSTRAINT chk_rag_index_jobs_lock
        CHECK (
            (status = 'PROCESSING' AND locked_at IS NOT NULL AND lock_token IS NOT NULL)
            OR
            (status <> 'PROCESSING' AND locked_at IS NULL AND lock_token IS NULL)
        )
);

CREATE INDEX idx_rag_index_jobs_available
    ON rag_index_jobs(next_attempt_at, created_at)
    WHERE status = 'PENDING';

CREATE INDEX idx_rag_index_jobs_stale
    ON rag_index_jobs(locked_at)
    WHERE status = 'PROCESSING';
