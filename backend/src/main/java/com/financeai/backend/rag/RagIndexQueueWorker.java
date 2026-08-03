package com.financeai.backend.rag;

import com.financeai.backend.integration.ai.AiServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

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

    public RagIndexQueueWorker(RagIndexQueueRepository queueRepository,
                               RagIndexQueueProperties properties,
                               AiServiceClient aiServiceClient) {
        this.queueRepository = queueRepository;
        this.properties = properties;
        this.aiServiceClient = aiServiceClient;
    }

    @Scheduled(fixedDelayString = "${finance-ai.rag.index-queue.poll-delay-ms:1000}")
    public void processNext() {
        Optional<RagIndexJob> claimed = queueRepository.claimNext(
            properties.getLockTimeoutMs());
        if (claimed.isEmpty()) {
            return;
        }

        RagIndexJob job = claimed.get();
        try {
            int indexed = aiServiceClient.indexRagDocumentsOrThrow(
                job.userId().toString(), List.of());
            if (queueRepository.complete(job)) {
                log.info("Job RAG {} concluído com {} vetores para o usuário {}",
                    job.id(), indexed, job.userId());
            } else {
                log.warn("Resultado ignorado para o job RAG {} com lock expirado", job.id());
            }
        } catch (Exception exception) {
            handleFailure(job, exception);
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
            log.error("Job RAG {} esgotou {} tentativas para o usuário {}: {}",
                job.id(), attempt, job.userId(), message);
        } else {
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
}
