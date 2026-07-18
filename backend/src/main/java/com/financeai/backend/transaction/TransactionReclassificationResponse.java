package com.financeai.backend.transaction;

public record TransactionReclassificationResponse(
    int processedCount,
    int categorizedCount,
    String modelVersion
) {
}
