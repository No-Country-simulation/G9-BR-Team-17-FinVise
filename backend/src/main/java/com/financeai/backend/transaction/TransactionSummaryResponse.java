package com.financeai.backend.transaction;

import java.math.BigDecimal;

public record TransactionSummaryResponse(
    BigDecimal totalIncome,
    BigDecimal totalExpense,
    BigDecimal balance
) {
}
