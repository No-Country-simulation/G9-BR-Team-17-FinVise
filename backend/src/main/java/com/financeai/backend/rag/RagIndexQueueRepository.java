package com.financeai.backend.rag;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
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
                    WHEN rag_index_jobs.status IN ('PROCESSING', 'DEAD_LETTER')
                        THEN rag_index_jobs.status
                    ELSE 'PENDING'
                END,
                rerun_requested = rag_index_jobs.status IN ('PROCESSING', 'DEAD_LETTER'),
                attempts = CASE
                    WHEN rag_index_jobs.status IN ('PROCESSING', 'DEAD_LETTER')
                        THEN rag_index_jobs.attempts
                    ELSE 0
                END,
                next_attempt_at = CASE
                    WHEN rag_index_jobs.status IN ('PROCESSING', 'DEAD_LETTER')
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
                heartbeat_at = CASE
                    WHEN rag_index_jobs.status = 'PROCESSING' THEN rag_index_jobs.heartbeat_at
                    ELSE NULL
                END,
                last_error = CASE
                    WHEN rag_index_jobs.status IN ('PROCESSING', 'DEAD_LETTER')
                        THEN rag_index_jobs.last_error
                    ELSE NULL
                END,
                dead_lettered_at = CASE
                    WHEN rag_index_jobs.status = 'DEAD_LETTER'
                        THEN rag_index_jobs.dead_lettered_at
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
                       AND heartbeat_at <= CURRENT_TIMESTAMP - (? * INTERVAL '1 millisecond'))
                ORDER BY next_attempt_at, created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE rag_index_jobs AS job
            SET status = 'PROCESSING',
                locked_at = CURRENT_TIMESTAMP,
                heartbeat_at = CURRENT_TIMESTAMP,
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

    public boolean heartbeat(RagIndexJob job) {
        return jdbcTemplate.update("""
            UPDATE rag_index_jobs
            SET heartbeat_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'PROCESSING' AND lock_token = ?
            """, job.id(), job.lockToken()) == 1;
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
                heartbeat_at = NULL,
                lock_token = NULL,
                last_error = NULL,
                dead_lettered_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'PROCESSING' AND lock_token = ?
            """, job.id(), job.lockToken()) == 1;
    }

    public boolean continueAfterDrainLimit(RagIndexJob job) {
        return jdbcTemplate.update("""
            UPDATE rag_index_jobs
            SET status = 'PENDING',
                rerun_requested = FALSE,
                attempts = 0,
                next_attempt_at = CURRENT_TIMESTAMP,
                locked_at = NULL,
                heartbeat_at = NULL,
                lock_token = NULL,
                last_error = NULL,
                dead_lettered_at = NULL,
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
                heartbeat_at = NULL,
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
            SET status = CASE WHEN ? >= ? THEN 'DEAD_LETTER' ELSE 'PENDING' END,
                rerun_requested = FALSE,
                attempts = ?,
                next_attempt_at = CASE
                    WHEN ? >= ? THEN CURRENT_TIMESTAMP
                    ELSE CURRENT_TIMESTAMP + (? * INTERVAL '1 millisecond')
                END,
                locked_at = NULL,
                heartbeat_at = NULL,
                lock_token = NULL,
                last_error = ?,
                dead_lettered_at = CASE
                    WHEN ? >= ? THEN CURRENT_TIMESTAMP
                    ELSE NULL
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'PROCESSING' AND lock_token = ?
            """,
            attempt, maxAttempts, attempt,
            attempt, maxAttempts, retryDelayMs,
            error, attempt, maxAttempts, job.id(), job.lockToken()) == 1;
    }

    public boolean reprocess(UUID userId) {
        return jdbcTemplate.update("""
            INSERT INTO rag_index_jobs (
                user_id, status, attempts, next_attempt_at, manual_reprocess_count
            )
            VALUES (?, 'PENDING', 0, CURRENT_TIMESTAMP, 1)
            ON CONFLICT (user_id) DO UPDATE
            SET status = 'PENDING',
                rerun_requested = FALSE,
                attempts = 0,
                next_attempt_at = CURRENT_TIMESTAMP,
                locked_at = NULL,
                heartbeat_at = NULL,
                lock_token = NULL,
                last_error = NULL,
                dead_lettered_at = NULL,
                manual_reprocess_count = rag_index_jobs.manual_reprocess_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE rag_index_jobs.status <> 'PROCESSING'
            """, userId) == 1;
    }

    public int resetDocumentsForReprocessing(UUID userId, boolean force) {
        String condition = force
            ? ""
            : " AND (embedding IS NULL OR index_status IN ('PENDING', 'PROCESSING', 'FAILED'))";
        return jdbcTemplate.update("""
            UPDATE rag_documents
            SET embedding = NULL,
                embedding_model = NULL,
                embedding_created_at = NULL,
                index_status = 'PENDING',
                index_error = NULL,
                index_attempted_at = NULL
            WHERE user_id = ?
            """ + condition, userId);
    }

    public boolean hasDocuments(UUID userId) {
        Boolean exists = jdbcTemplate.queryForObject("""
            SELECT EXISTS (
                SELECT 1 FROM rag_documents WHERE user_id = ?
            )
            """, Boolean.class, userId);
        return Boolean.TRUE.equals(exists);
    }

    public Optional<RagIndexQueueStatusResponse> status(UUID userId) {
        return jdbcTemplate.query("""
            SELECT status, attempts, rerun_requested, next_attempt_at,
                   heartbeat_at, dead_lettered_at, last_error,
                   manual_reprocess_count, updated_at
            FROM rag_index_jobs
            WHERE user_id = ?
            """, (resultSet, rowNumber) -> new RagIndexQueueStatusResponse(
                resultSet.getString("status"),
                resultSet.getInt("attempts"),
                resultSet.getBoolean("rerun_requested"),
                instant(resultSet.getTimestamp("next_attempt_at")),
                instant(resultSet.getTimestamp("heartbeat_at")),
                instant(resultSet.getTimestamp("dead_lettered_at")),
                resultSet.getString("last_error"),
                resultSet.getInt("manual_reprocess_count"),
                instant(resultSet.getTimestamp("updated_at"))),
            userId).stream().findFirst();
    }

    public RagIndexQueueCounts counts() {
        return jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
                   COUNT(*) FILTER (WHERE status = 'PROCESSING') AS processing,
                   COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
                   COUNT(*) FILTER (WHERE status = 'DEAD_LETTER') AS dead_letter
            FROM rag_index_jobs
            """, (resultSet, rowNumber) -> new RagIndexQueueCounts(
                resultSet.getLong("pending"),
                resultSet.getLong("processing"),
                resultSet.getLong("completed"),
                resultSet.getLong("dead_letter")));
    }

    private static Instant instant(Timestamp timestamp) {
        return timestamp != null ? timestamp.toInstant() : null;
    }
}
