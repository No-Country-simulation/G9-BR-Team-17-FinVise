package com.financeai.backend.indicator;

import java.math.BigDecimal;
import java.util.UUID;

public interface FinancialIndicatorView {
    UUID getAnalysisId();
    BigDecimal getMonthlyIncome();
    BigDecimal getTotalExpenses();
    BigDecimal getIncomeCommitmentPercentage();
    BigDecimal getDebtLevelPercentage();
    BigDecimal getSavingsRatePercentage();
    Integer getRecurringExpensesCount();
    BigDecimal getFixedExpensesPercentage();
    BigDecimal getNonEssentialExpensesPercentage();
    BigDecimal getReserveInMonths();
}
