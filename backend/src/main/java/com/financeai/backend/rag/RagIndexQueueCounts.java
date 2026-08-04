package com.financeai.backend.rag;

public record RagIndexQueueCounts(
    long pending,
    long processing,
    long completed,
    long deadLetter
) {
}
