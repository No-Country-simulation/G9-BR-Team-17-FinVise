package com.financeai.backend.rag;

import java.time.Instant;

public record RagIndexQueueStatusResponse(
    String status,
    int attempts,
    boolean rerunRequested,
    Instant nextAttemptAt,
    Instant heartbeatAt,
    Instant deadLetteredAt,
    String lastError,
    int manualReprocessCount,
    Instant updatedAt
) {
    public static RagIndexQueueStatusResponse empty() {
        return new RagIndexQueueStatusResponse(
            "EMPTY", 0, false, null, null, null, null, 0, null);
    }
}
