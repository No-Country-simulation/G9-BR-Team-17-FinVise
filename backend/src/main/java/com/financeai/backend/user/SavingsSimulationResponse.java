package com.financeai.backend.user;

import java.math.BigDecimal;

public record SavingsSimulationResponse(
    BigDecimal monthlyIncome,
    BigDecimal currentSavingsRate,
    BigDecimal targetSavingsRate,
    Integer months,
    BigDecimal currentMonthlySavings,
    BigDecimal targetMonthlySavings,
    BigDecimal accumulatedCurrent,
    BigDecimal accumulatedTarget,
    BigDecimal additionalMonthlyEffort,
    BigDecimal projectedAnnualDifference
) {
}
