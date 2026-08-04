package com.financeai.backend.rag;

public record RagReprocessResponse(
    boolean queued,
    boolean force,
    int resetDocuments,
    String queueStatus
) {
}
