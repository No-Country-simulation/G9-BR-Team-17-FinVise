package com.financeai.backend.importation;

import com.financeai.backend.transaction.TransactionType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CsvTransactionRecord(
    String description,
    BigDecimal amount,
    LocalDate date,
    TransactionType type,
    String paymentMethod,
    Boolean recurrent
) {
}
