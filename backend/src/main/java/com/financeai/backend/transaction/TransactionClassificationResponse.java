package com.financeai.backend.transaction;

import java.util.List;

public record TransactionClassificationResponse(
    List<ClassifiedTransactionDto> classifiedTransactions,
    String modelVersion
) {
}
