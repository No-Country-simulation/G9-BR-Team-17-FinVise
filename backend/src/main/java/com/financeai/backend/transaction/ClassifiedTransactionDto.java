package com.financeai.backend.transaction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ClassifiedTransactionDto(
    UUID id,
    String description,
    BigDecimal amount,
    LocalDate date,
    TransactionType type,
    String categoryCode,
    String categoryName,
    Double confidence
) {
}
