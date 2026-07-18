package com.financeai.backend.importation;

import java.time.Instant;
import java.util.UUID;

public record ImportSourceResponse(
    UUID id,
    String type,
    String displayName,
    String provider,
    String status,
    long transactionCount,
    long categorizedCount,
    Long sizeBytes,
    Instant createdAt,
    Instant lastSyncAt,
    String errorMessage,
    boolean defaultSource
) {
}
