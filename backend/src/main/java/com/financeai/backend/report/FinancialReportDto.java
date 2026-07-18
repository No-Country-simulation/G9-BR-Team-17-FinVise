package com.financeai.backend.report;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

public record FinancialReportDto(
    UUID userId,
    String userName,
    BigDecimal totalIncome,
    BigDecimal totalExpenses,
    BigDecimal balance,
    Map<String, CategoryTotal> summaryByCategory
) {

    public record CategoryTotal(
        BigDecimal amount,
        BigDecimal percentage
    ) {
    }
}
