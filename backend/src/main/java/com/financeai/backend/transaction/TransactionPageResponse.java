package com.financeai.backend.transaction;

import java.util.List;

public record TransactionPageResponse(
    List<TransactionResponse> content,
    long totalElements,
    int totalPages,
    int size,
    int number
) {
}
