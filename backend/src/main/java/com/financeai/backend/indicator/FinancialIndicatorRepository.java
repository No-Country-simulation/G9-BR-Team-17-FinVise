package com.financeai.backend.indicator;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FinancialIndicatorRepository extends JpaRepository<FinancialIndicator, UUID> {

    Optional<FinancialIndicator> findByAnalysisId(UUID analysisId);

    @Query("""
        SELECT
            indicator.analysis.id AS analysisId,
            indicator.monthlyIncome AS monthlyIncome,
            indicator.totalExpenses AS totalExpenses,
            indicator.incomeCommitmentPercentage AS incomeCommitmentPercentage,
            indicator.debtLevelPercentage AS debtLevelPercentage,
            indicator.savingsRatePercentage AS savingsRatePercentage,
            indicator.recurringExpensesCount AS recurringExpensesCount,
            indicator.fixedExpensesPercentage AS fixedExpensesPercentage,
            indicator.nonEssentialExpensesPercentage AS nonEssentialExpensesPercentage,
            indicator.reserveInMonths AS reserveInMonths
        FROM FinancialIndicator indicator
        WHERE indicator.analysis.id IN :analysisIds
        """)
    List<FinancialIndicatorView> findViewsByAnalysisIds(
        @Param("analysisIds") Collection<UUID> analysisIds);
}
