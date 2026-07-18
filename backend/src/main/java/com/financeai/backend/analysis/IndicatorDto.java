package com.financeai.backend.analysis;

import java.math.BigDecimal;

public record IndicatorDto(
    BigDecimal monthlyIncome,
    BigDecimal totalExpenses,
    BigDecimal incomeCommitmentPercentage,
    BigDecimal debtLevelPercentage,
    BigDecimal estimatedSavingsRate,
    Integer recurringExpensesCount,
    BigDecimal fixedExpensesPercentage,
    BigDecimal nonEssentialExpensesPercentage,
    BigDecimal reserveInMonths
) {
}
