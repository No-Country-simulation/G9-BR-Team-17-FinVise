package com.financeai.backend.rag;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class RagIndexQueueOperationsService {

    private final RagIndexQueueRepository queueRepository;
    private final RagIndexQueueMetrics metrics;

    public RagIndexQueueOperationsService(RagIndexQueueRepository queueRepository,
                                          RagIndexQueueMetrics metrics) {
        this.queueRepository = queueRepository;
        this.metrics = metrics;
    }

    @Transactional(readOnly = true)
    public RagIndexQueueStatusResponse status(UUID userId) {
        return queueRepository.status(userId)
            .orElseGet(RagIndexQueueStatusResponse::empty);
    }

    @Transactional
    public RagReprocessResponse reprocess(UUID userId, boolean force) {
        if (!queueRepository.hasDocuments(userId)) {
            return new RagReprocessResponse(false, force, 0, "EMPTY");
        }
        if (!queueRepository.reprocess(userId)) {
            throw new RagQueueOperationConflictException(
                "A indexação RAG já está em processamento para este usuário");
        }
        int resetDocuments = queueRepository.resetDocumentsForReprocessing(userId, force);
        metrics.manualReprocess();
        metrics.updateDepth(queueRepository.counts());
        return new RagReprocessResponse(true, force, resetDocuments, "PENDING");
    }
}
