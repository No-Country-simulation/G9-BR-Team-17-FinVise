package com.financeai.backend.rag;

public record RagIndexStatusResponse(
    String status,
    long totalDocuments,
    long pendingDocuments,
    long processingDocuments,
    long indexedDocuments,
    long failedDocuments
) {
}
