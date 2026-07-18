package com.financeai.backend.integration.ai;

import java.math.BigDecimal;

public record ProfileAnalysisRequest(
    String model,
    BigDecimal monthlyIncome,
    BigDecimal debtLevelPercentage,
    String savingFrequency,
    BigDecimal financialReserve,
    ProfileIndicators indicators
) {

    public record ProfileIndicators(
        BigDecimal incomeCommitmentPercentage,
        BigDecimal savingsRatePercentage,
        BigDecimal fixedExpensesPercentage,
        BigDecimal nonEssentialExpensesPercentage,
        Integer recurringExpensesCount,
        Integer transactionsExpenseCount,
        BigDecimal expenseVariationPercentage,
        BigDecimal reserveInMonths
    ) {
    }
}
