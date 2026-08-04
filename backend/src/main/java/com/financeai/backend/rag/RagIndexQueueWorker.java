package com.financeai.backend.rag;

import com.financeai.backend.integration.ai.AiServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@ConditionalOnProperty(
    prefix = "finance-ai.rag.index-queue",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class RagIndexQueueWorker {

    private static final Logger log = LoggerFactory.getLogger(RagIndexQueueWorker.class);
    private static final int MAX_ERROR_LENGTH = 2000;

    private final RagIndexQueueRepository queueRepository;
    private final RagIndexQueueProperties properties;
    private final AiServiceClient aiServiceClient;
    private final RagIndexQueueMetrics metrics;
    private final TaskScheduler heartbeatScheduler;

    public RagIndexQueueWorker(
        RagIndexQueueRepository queueRepository,
        RagIndexQueueProperties properties,
        AiServiceClient aiServiceClient,
        RagIndexQueueMetrics metrics,
        @Qualifier("ragIndexQueueHeartbeatScheduler") TaskScheduler heartbeatScheduler
    ) {
        this.queueRepository = queueRepository;
        this.properties = properties;
        this.aiServiceClient = aiServiceClient;
        this.metrics = metrics;
        this.heartbeatScheduler = heartbeatScheduler;
    }

    @Scheduled(fixedDelayString = "${finance-ai.rag.index-queue.poll-delay-ms:1000}")
    public void processNext() {
        Optional<RagIndexJob> claimed = queueRepository.claimNext(
            properties.getLockTimeoutMs());
        if (claimed.isEmpty()) {
            refreshDepth();
            return;
        }

        RagIndexJob job = claimed.get();
        long startedAt = System.nanoTime();
        metrics.claimed();
        HeartbeatLease lease = startHeartbeat(job);
        try {
            drain(job, lease);
        } catch (HttpClientErrorException exception) {
            if (lease.isLost()) {
                log.warn("Falha ignorada para o job RAG {} após perda do lock", job.id());
            } else if (exception.getStatusCode() == HttpStatus.CONFLICT) {
                deferBusyJob(job, exception);
            } else {
                handleFailure(job, exception);
            }
        } catch (Exception exception) {
            if (lease.isLost()) {
                log.warn("Falha ignorada para o job RAG {} após perda do lock", job.id());
            } else {
                handleFailure(job, exception);
            }
        } finally {
            lease.close();
            metrics.recordDuration(startedAt);
            refreshDepth();
        }
    }

    private void drain(RagIndexJob job, HeartbeatLease lease) {
        int totalIndexed = 0;
        for (int batch = 1; batch <= properties.getMaxBatchesPerDrain(); batch++) {
            if (lease.isLost()) {
                return;
            }
            AiServiceClient.RagIndexResponse response = aiServiceClient.indexRagBatchOrThrow(
                job.userId().toString(), List.of());
            metrics.batch(response.indexedCount());
            totalIndexed += response.indexedCount();

            if (lease.isLost()) {
                return;
            }
            if (!response.hasMore()) {
                lease.close();
                if (queueRepository.complete(job)) {
                    metrics.succeeded();
                    log.info("Job RAG {} drenado com {} vetores para o usuário {}",
                        job.id(), totalIndexed, job.userId());
                } else {
                    recordLostLock(job, lease);
                }
                return;
            }
            if (response.indexedCount() <= 0) {
                throw new IllegalStateException(
                    "AI Service informou documentos pendentes sem avançar a indexação");
            }
        }

        lease.close();
        if (queueRepository.continueAfterDrainLimit(job)) {
            metrics.drainLimited();
            log.info("Job RAG {} atingiu o limite de {} lotes e continuará no próximo ciclo",
                job.id(), properties.getMaxBatchesPerDrain());
        } else {
            recordLostLock(job, lease);
        }
    }

    private HeartbeatLease startHeartbeat(RagIndexJob job) {
        AtomicBoolean lost = new AtomicBoolean(false);
        ScheduledFuture<?> future = heartbeatScheduler.scheduleAtFixedRate(() -> {
            try {
                if (!queueRepository.heartbeat(job) && lost.compareAndSet(false, true)) {
                    metrics.lockLost();
                    log.warn(
                        "Heartbeat rejeitado para o job RAG {}; lock não pertence mais ao worker",
                        job.id());
                }
            } catch (RuntimeException exception) {
                log.warn("Falha ao renovar heartbeat do job RAG {}: {}",
                    job.id(), exception.getMessage());
            }
        }, Duration.ofMillis(properties.getHeartbeatIntervalMs()));
        return new HeartbeatLease(future, lost);
    }

    private void recordLostLock(RagIndexJob job, HeartbeatLease lease) {
        if (lease.markLost()) {
            metrics.lockLost();
        }
        log.warn("Resultado ignorado para o job RAG {} com lock expirado", job.id());
    }

    private void deferBusyJob(RagIndexJob job, Exception exception) {
        long retryDelay = properties.getRetryBaseDelayMs();
        String message = errorMessage(exception);
        if (queueRepository.deferWithoutFailure(job, retryDelay, message)) {
            metrics.retried();
            log.info("Job RAG {} já está em processamento; nova verificação em {} ms",
                job.id(), retryDelay);
        } else {
            log.warn("Contenção ignorada para o job RAG {} com lock expirado", job.id());
        }
    }

    private void handleFailure(RagIndexJob job, Exception exception) {
        int attempt = job.attempts() + 1;
        long retryDelay = properties.retryDelayMs(attempt);
        String message = errorMessage(exception);
        boolean updated = queueRepository.fail(
            job,
            attempt,
            properties.getMaxAttempts(),
            retryDelay,
            message);
        if (!updated) {
            log.warn("Falha ignorada para o job RAG {} com lock expirado", job.id());
        } else if (attempt >= properties.getMaxAttempts()) {
            metrics.deadLettered();
            log.error("Job RAG {} movido para dead-letter após {} tentativas, usuário {}: {}",
                job.id(), attempt, job.userId(), message);
        } else {
            metrics.retried();
            log.warn("Job RAG {} falhou na tentativa {}/{}; nova tentativa em {} ms: {}",
                job.id(), attempt, properties.getMaxAttempts(), retryDelay, message);
        }
    }

    private String errorMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            message = exception.getClass().getSimpleName();
        }
        return message.substring(0, Math.min(message.length(), MAX_ERROR_LENGTH));
    }

    private void refreshDepth() {
        try {
            metrics.updateDepth(queueRepository.counts());
        } catch (RuntimeException exception) {
            log.warn("Falha ao atualizar métricas da fila RAG: {}", exception.getMessage());
        }
    }

    private static final class HeartbeatLease implements AutoCloseable {
        private final ScheduledFuture<?> future;
        private final AtomicBoolean lost;

        private HeartbeatLease(ScheduledFuture<?> future, AtomicBoolean lost) {
            this.future = future;
            this.lost = lost;
        }

        private boolean isLost() {
            return lost.get();
        }

        private boolean markLost() {
            return lost.compareAndSet(false, true);
        }

        @Override
        public void close() {
            if (future != null) {
                future.cancel(false);
            }
        }
    }
}
