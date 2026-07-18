package com.financeai.backend;

import com.financeai.backend.analysis.FinancialAnalysis;
import com.financeai.backend.indicator.FinancialIndicator;
import com.financeai.backend.recommendation.Recommendation;
import com.financeai.backend.recommendation.RecommendationEngine;
import com.financeai.backend.recommendation.RecommendationPriority;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationEngineTest {

    private RecommendationEngine engine;
    private FinancialAnalysis analysis;
    private FinancialIndicator indicator;

    @BeforeEach
    void setUp() {
        engine = new RecommendationEngine();
        analysis = new FinancialAnalysis();
        analysis.setId(java.util.UUID.randomUUID());
        indicator = new FinancialIndicator();
    }

    @Test
    void shouldRecommendIncreaseSavingsWhenSavingsRateBelowThreshold() {
        // given
        indicator.setMonthlyIncome(BigDecimal.valueOf(5000.00));
        indicator.setTotalExpenses(BigDecimal.valueOf(4800.00));
        indicator.setSavingsRatePercentage(BigDecimal.valueOf(2.00));
        indicator.setDebtLevelPercentage(BigDecimal.valueOf(10.00));
        indicator.setNonEssentialExpensesPercentage(BigDecimal.valueOf(10.00));
        indicator.setRecurringExpensesCount(2);
        indicator.setReserveInMonths(BigDecimal.valueOf(6.00));

        // when
        List<Recommendation> recommendations = engine.generateRecommendations(analysis, indicator);

        // then
        assertThat(recommendations)
            .anyMatch(r -> r.getTitle().contains("poupança") && r.getPriority() == RecommendationPriority.HIGH);
    }

    @Test
    void shouldRecommendReduceDebtWhenDebtLevelAboveThreshold() {
        // given
        indicator.setSavingsRatePercentage(BigDecimal.valueOf(10.00));
        indicator.setDebtLevelPercentage(BigDecimal.valueOf(50.00));
        indicator.setNonEssentialExpensesPercentage(BigDecimal.valueOf(10.00));
        indicator.setTotalExpenses(BigDecimal.valueOf(2000.00));
        indicator.setMonthlyIncome(BigDecimal.valueOf(5000.00));
        indicator.setRecurringExpensesCount(2);
        indicator.setReserveInMonths(BigDecimal.valueOf(6.00));

        // when
        List<Recommendation> recommendations = engine.generateRecommendations(analysis, indicator);

        // then
        assertThat(recommendations)
            .anyMatch(r -> r.getTitle().contains("dívidas") && r.getPriority() == RecommendationPriority.CRITICAL);
    }

    @Test
    void shouldRecommendReduceNonEssentialExpensesAboveThreshold() {
        // given
        indicator.setSavingsRatePercentage(BigDecimal.valueOf(10.00));
        indicator.setDebtLevelPercentage(BigDecimal.valueOf(10.00));
        indicator.setNonEssentialExpensesPercentage(BigDecimal.valueOf(35.00));
        indicator.setTotalExpenses(BigDecimal.valueOf(2000.00));
        indicator.setMonthlyIncome(BigDecimal.valueOf(5000.00));
        indicator.setRecurringExpensesCount(2);
        indicator.setReserveInMonths(BigDecimal.valueOf(6.00));

        // when
        List<Recommendation> recommendations = engine.generateRecommendations(analysis, indicator);

        // then
        assertThat(recommendations)
            .anyMatch(r -> r.getTitle().contains("não essenciais") && r.getPriority() == RecommendationPriority.MEDIUM);
    }

    @Test
    void shouldRecommendEmergencyReserveBelowThreshold() {
        // given
        indicator.setMonthlyIncome(BigDecimal.valueOf(5000.00));
        indicator.setTotalExpenses(BigDecimal.valueOf(2000.00));
        indicator.setSavingsRatePercentage(BigDecimal.valueOf(10.00));
        indicator.setDebtLevelPercentage(BigDecimal.valueOf(10.00));
        indicator.setNonEssentialExpensesPercentage(BigDecimal.valueOf(10.00));
        indicator.setRecurringExpensesCount(2);
        indicator.setReserveInMonths(BigDecimal.valueOf(1.50));

        // when
        List<Recommendation> recommendations = engine.generateRecommendations(analysis, indicator);

        // then
        assertThat(recommendations)
            .anyMatch(r -> r.getTitle().contains("reserva") && r.getPriority() == RecommendationPriority.HIGH);
    }

    @Test
    void shouldRecommendWhenExpensesExceedIncome() {
        // given
        indicator.setMonthlyIncome(BigDecimal.valueOf(3000.00));
        indicator.setTotalExpenses(BigDecimal.valueOf(3500.00));
        indicator.setSavingsRatePercentage(BigDecimal.valueOf(0.00));
        indicator.setDebtLevelPercentage(BigDecimal.valueOf(10.00));
        indicator.setNonEssentialExpensesPercentage(BigDecimal.valueOf(10.00));
        indicator.setRecurringExpensesCount(2);
        indicator.setReserveInMonths(BigDecimal.valueOf(6.00));

        // when
        List<Recommendation> recommendations = engine.generateRecommendations(analysis, indicator);

        // then
        assertThat(recommendations)
            .anyMatch(r -> r.getTitle().contains("Despesas superam renda") && r.getPriority() == RecommendationPriority.CRITICAL);
    }

    @Test
    void shouldRecommendReviewSubscriptionsWhenRecurringCountAboveThreshold() {
        // given
        indicator.setMonthlyIncome(BigDecimal.valueOf(5000.00));
        indicator.setTotalExpenses(BigDecimal.valueOf(2000.00));
        indicator.setSavingsRatePercentage(BigDecimal.valueOf(10.00));
        indicator.setDebtLevelPercentage(BigDecimal.valueOf(10.00));
        indicator.setNonEssentialExpensesPercentage(BigDecimal.valueOf(10.00));
        indicator.setRecurringExpensesCount(8);
        indicator.setReserveInMonths(BigDecimal.valueOf(6.00));

        // when
        List<Recommendation> recommendations = engine.generateRecommendations(analysis, indicator);

        // then
        assertThat(recommendations)
            .anyMatch(r -> r.getTitle().contains("assinaturas") && r.getPriority() == RecommendationPriority.MEDIUM);
    }

    @Test
    void shouldReturnEmptyRecommendationsWhenAllIndicatorsHealthy() {
        // given
        indicator.setMonthlyIncome(BigDecimal.valueOf(5000.00));
        indicator.setTotalExpenses(BigDecimal.valueOf(2000.00));
        indicator.setSavingsRatePercentage(BigDecimal.valueOf(10.00));
        indicator.setDebtLevelPercentage(BigDecimal.valueOf(20.00));
        indicator.setNonEssentialExpensesPercentage(BigDecimal.valueOf(20.00));
        indicator.setRecurringExpensesCount(3);
        indicator.setReserveInMonths(BigDecimal.valueOf(6.00));

        // when
        List<Recommendation> recommendations = engine.generateRecommendations(analysis, indicator);

        // then
        assertThat(recommendations).isEmpty();
    }
}
