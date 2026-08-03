package com.financeai.backend.rag;

public record RagIndexStatusCount(
    RagIndexStatus status,
    long total
) {
}
