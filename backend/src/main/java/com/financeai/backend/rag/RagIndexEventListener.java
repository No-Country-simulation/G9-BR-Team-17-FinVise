package com.financeai.backend.rag;

import com.financeai.backend.integration.ai.AiServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class RagIndexEventListener {

    private static final Logger log = LoggerFactory.getLogger(RagIndexEventListener.class);

    private final AiServiceClient aiServiceClient;

    public RagIndexEventListener(AiServiceClient aiServiceClient) {
        this.aiServiceClient = aiServiceClient;
    }

    @Async
    @TransactionalEventListener(
        phase = TransactionPhase.AFTER_COMMIT,
        fallbackExecution = true
    )
    public void indexAfterIngestion(RagIndexRequestedEvent event) {
        aiServiceClient.indexRagDocuments(
            event.userId().toString(), event.sourceIds(), true);
        log.info("Indexação pós-ingestão enfileirada para o usuário {}", event.userId());
    }
}
