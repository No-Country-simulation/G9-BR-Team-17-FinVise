package com.financeai.backend;

import com.financeai.backend.rag.RagIndexJob;
import com.financeai.backend.rag.RagIndexQueueRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = "finance-ai.rag.index-queue.enabled=false")
class RagIndexQueueRepositoryTest extends PostgresTestSupport {

    @Autowired
    private RagIndexQueueRepository queueRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID userId;

    @BeforeEach
    void setUpUser() {
        userId = UUID.randomUUID();
        jdbcTemplate.update("""
            INSERT INTO users (id, email, password_hash, name)
            VALUES (?, ?, 'hash', 'Teste fila RAG')
            """, userId, userId + "@example.com");
    }

    @AfterEach
    void cleanUpUser() {
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
    }

    @Test
    void shouldClaimAJobOnlyOnceAcrossConcurrentWorkers() throws Exception {
        queueRepository.enqueue(userId);

        CompletableFuture<Optional<RagIndexJob>> first = CompletableFuture.supplyAsync(
            () -> queueRepository.claimNext(120000));
        CompletableFuture<Optional<RagIndexJob>> second = CompletableFuture.supplyAsync(
            () -> queueRepository.claimNext(120000));

        Optional<RagIndexJob> firstResult = first.get(5, TimeUnit.SECONDS);
        Optional<RagIndexJob> secondResult = second.get(5, TimeUnit.SECONDS);

        assertThat(java.util.stream.Stream.of(firstResult, secondResult)
            .filter(Optional::isPresent)
            .count()).isEqualTo(1);
    }

    @Test
    void shouldRollbackEnqueueWithTheSurroundingTransaction() {
        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
            queueRepository.enqueue(userId);
            throw new IllegalStateException("forçar rollback");
        })).isInstanceOf(IllegalStateException.class);

        Integer jobs = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM rag_index_jobs WHERE user_id = ?", Integer.class, userId);
        assertThat(jobs).isZero();
    }

    @Test
    void shouldRequestRerunWhenEnqueuedDuringProcessing() {
        queueRepository.enqueue(userId);
        RagIndexJob job = queueRepository.claimNext(120000).orElseThrow();

        queueRepository.enqueue(userId);

        assertThat(queueRepository.complete(job)).isTrue();
        assertThat(status()).isEqualTo("PENDING");
        assertThat(queueRepository.claimNext(120000)).isPresent();
    }

    @Test
    void shouldPersistFailureAndRespectRetryDelay() {
        queueRepository.enqueue(userId);
        RagIndexJob job = queueRepository.claimNext(120000).orElseThrow();

        assertThat(queueRepository.fail(job, 1, 5, 60000, "falha temporária")).isTrue();

        assertThat(status()).isEqualTo("PENDING");
        assertThat(attempts()).isEqualTo(1);
        assertThat(queueRepository.claimNext(120000)).isEmpty();
    }

    @Test
    void shouldMoveJobToFailedAfterLastAttemptAndResetOnNewEnqueue() {
        queueRepository.enqueue(userId);
        RagIndexJob job = queueRepository.claimNext(120000).orElseThrow();

        assertThat(queueRepository.fail(job, 5, 5, 1000, "falha permanente")).isTrue();
        assertThat(status()).isEqualTo("FAILED");

        queueRepository.enqueue(userId);

        assertThat(status()).isEqualTo("PENDING");
        assertThat(attempts()).isZero();
        assertThat(queueRepository.claimNext(120000)).isPresent();
    }

    @Test
    void shouldIgnoreResultFromWorkerWhoseLockExpired() {
        queueRepository.enqueue(userId);
        RagIndexJob original = queueRepository.claimNext(120000).orElseThrow();
        jdbcTemplate.update("""
            UPDATE rag_index_jobs
            SET locked_at = CURRENT_TIMESTAMP - INTERVAL '5 minutes'
            WHERE user_id = ?
            """, userId);

        RagIndexJob recovered = queueRepository.claimNext(1000).orElseThrow();

        assertThat(recovered.lockToken()).isNotEqualTo(original.lockToken());
        assertThat(queueRepository.complete(original)).isFalse();
        assertThat(queueRepository.complete(recovered)).isTrue();
        assertThat(status()).isEqualTo("COMPLETED");
    }

    private String status() {
        return jdbcTemplate.queryForObject(
            "SELECT status FROM rag_index_jobs WHERE user_id = ?", String.class, userId);
    }

    private int attempts() {
        Integer result = jdbcTemplate.queryForObject(
            "SELECT attempts FROM rag_index_jobs WHERE user_id = ?", Integer.class, userId);
        return result != null ? result : 0;
    }
}
