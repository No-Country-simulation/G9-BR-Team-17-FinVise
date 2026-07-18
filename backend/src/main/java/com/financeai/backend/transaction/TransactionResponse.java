package com.financeai.backend.transaction;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TransactionResponse(
    UUID id,
    String description,
    BigDecimal amount,
    LocalDate date,
    TransactionType type,
    String category,
    String source,
    Instant createdAt
) {
}
