package com.financeai.backend.rag;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class RagIndexQueueRepository {

    private final JdbcTemplate jdbcTemplate;

    public RagIndexQueueRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void enqueue(UUID userId) {
        jdbcTemplate.update("""
            INSERT INTO rag_index_jobs (user_id)
            VALUES (?)
            ON CONFLICT (user_id) DO UPDATE
            SET status = CASE
                    WHEN rag_index_jobs.status = 'PROCESSING' THEN 'PROCESSING'
                    ELSE 'PENDING'
                END,
                rerun_requested = rag_index_jobs.status = 'PROCESSING',
                attempts = CASE
                    WHEN rag_index_jobs.status = 'PROCESSING' THEN rag_index_jobs.attempts
                    ELSE 0
                END,
                next_attempt_at = CASE
                    WHEN rag_index_jobs.status = 'PROCESSING'
                        THEN rag_index_jobs.next_attempt_at
                    ELSE CURRENT_TIMESTAMP
                END,
                locked_at = CASE
                    WHEN rag_index_jobs.status = 'PROCESSING' THEN rag_index_jobs.locked_at
                    ELSE NULL
                END,
                lock_token = CASE
                    WHEN rag_index_jobs.status = 'PROCESSING' THEN rag_index_jobs.lock_token
                    ELSE NULL
                END,
                last_error = CASE
                    WHEN rag_index_jobs.status = 'PROCESSING' THEN rag_index_jobs.last_error
                    ELSE NULL
                END,
                updated_at = CURRENT_TIMESTAMP
            """, userId);
    }

    public Optional<RagIndexJob> claimNext(long lockTimeoutMs) {
        List<RagIndexJob> jobs = jdbcTemplate.query("""
            WITH candidate AS (
                SELECT id
                FROM rag_index_jobs
                WHERE (status = 'PENDING' AND next_attempt_at <= CURRENT_TIMESTAMP)
                   OR (status = 'PROCESSING'
                       AND locked_at <= CURRENT_TIMESTAMP - (? * INTERVAL '1 millisecond'))
                ORDER BY next_attempt_at, created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE rag_index_jobs AS job
            SET status = 'PROCESSING',
                locked_at = CURRENT_TIMESTAMP,
                lock_token = uuid_generate_v4(),
                updated_at = CURRENT_TIMESTAMP
            FROM candidate
            WHERE job.id = candidate.id
            RETURNING job.id, job.user_id, job.lock_token, job.attempts
            """,
            (resultSet, rowNumber) -> new RagIndexJob(
                resultSet.getObject("id", UUID.class),
                resultSet.getObject("user_id", UUID.class),
                resultSet.getObject("lock_token", UUID.class),
                resultSet.getInt("attempts")),
            lockTimeoutMs);
        return jobs.stream().findFirst();
    }

    public boolean complete(RagIndexJob job) {
        return jdbcTemplate.update("""
            UPDATE rag_index_jobs
            SET status = CASE WHEN rerun_requested THEN 'PENDING' ELSE 'COMPLETED' END,
                rerun_requested = FALSE,
                attempts = CASE WHEN rerun_requested THEN 0 ELSE attempts END,
                next_attempt_at = CASE
                    WHEN rerun_requested THEN CURRENT_TIMESTAMP
                    ELSE next_attempt_at
                END,
                locked_at = NULL,
                lock_token = NULL,
                last_error = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'PROCESSING' AND lock_token = ?
            """, job.id(), job.lockToken()) == 1;
    }

    public boolean continueAfterBatch(RagIndexJob job) {
        return jdbcTemplate.update("""
            UPDATE rag_index_jobs
            SET status = 'PENDING',
                rerun_requested = FALSE,
                attempts = 0,
                next_attempt_at = CURRENT_TIMESTAMP,
                locked_at = NULL,
                lock_token = NULL,
                last_error = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'PROCESSING' AND lock_token = ?
            """, job.id(), job.lockToken()) == 1;
    }

    public boolean deferWithoutFailure(RagIndexJob job, long retryDelayMs, String reason) {
        return jdbcTemplate.update("""
            UPDATE rag_index_jobs
            SET status = 'PENDING',
                rerun_requested = FALSE,
                next_attempt_at = CURRENT_TIMESTAMP + (? * INTERVAL '1 millisecond'),
                locked_at = NULL,
                lock_token = NULL,
                last_error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'PROCESSING' AND lock_token = ?
            """, retryDelayMs, reason, job.id(), job.lockToken()) == 1;
    }

    public boolean fail(RagIndexJob job,
                        int attempt,
                        int maxAttempts,
                        long retryDelayMs,
                        String error) {
        return jdbcTemplate.update("""
            UPDATE rag_index_jobs
            SET status = CASE WHEN ? >= ? THEN 'FAILED' ELSE 'PENDING' END,
                rerun_requested = FALSE,
                attempts = ?,
                next_attempt_at = CASE
                    WHEN ? >= ? THEN CURRENT_TIMESTAMP
                    ELSE CURRENT_TIMESTAMP + (? * INTERVAL '1 millisecond')
                END,
                locked_at = NULL,
                lock_token = NULL,
                last_error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'PROCESSING' AND lock_token = ?
            """,
            attempt, maxAttempts, attempt,
            attempt, maxAttempts, retryDelayMs,
            error, job.id(), job.lockToken()) == 1;
    }
}
