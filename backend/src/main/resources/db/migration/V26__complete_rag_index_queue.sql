ALTER TABLE rag_index_jobs
    ADD COLUMN heartbeat_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN dead_lettered_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN manual_reprocess_count INTEGER NOT NULL DEFAULT 0;

UPDATE rag_index_jobs
SET heartbeat_at = COALESCE(locked_at, updated_at)
WHERE status = 'PROCESSING';

ALTER TABLE rag_index_jobs
    DROP CONSTRAINT chk_rag_index_jobs_status,
    DROP CONSTRAINT chk_rag_index_jobs_lock;

UPDATE rag_index_jobs
SET status = 'DEAD_LETTER',
    dead_lettered_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE status = 'FAILED';

ALTER TABLE rag_index_jobs
    ADD CONSTRAINT chk_rag_index_jobs_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD_LETTER')),
    ADD CONSTRAINT chk_rag_index_jobs_manual_reprocess_count
        CHECK (manual_reprocess_count >= 0),
    ADD CONSTRAINT chk_rag_index_jobs_lock
        CHECK (
            (
                status = 'PROCESSING'
                AND locked_at IS NOT NULL
                AND heartbeat_at IS NOT NULL
                AND lock_token IS NOT NULL
            )
            OR
            (
                status <> 'PROCESSING'
                AND locked_at IS NULL
                AND heartbeat_at IS NULL
                AND lock_token IS NULL
            )
        );

DROP INDEX idx_rag_index_jobs_stale;

CREATE INDEX idx_rag_index_jobs_stale
    ON rag_index_jobs(heartbeat_at)
    WHERE status = 'PROCESSING';

CREATE INDEX idx_rag_index_jobs_dead_letter
    ON rag_index_jobs(dead_lettered_at DESC)
    WHERE status = 'DEAD_LETTER';
