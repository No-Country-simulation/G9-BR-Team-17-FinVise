package com.financeai.backend.transaction;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ClassifyTransactionsRequest(
    @NotEmpty(message = "A lista de transações não pode estar vazia")
    @Valid
    List<TransactionDto> transactions
) {
}
