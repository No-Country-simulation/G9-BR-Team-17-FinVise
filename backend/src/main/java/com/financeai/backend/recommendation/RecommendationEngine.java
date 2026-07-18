package com.financeai.backend.recommendation;

import com.financeai.backend.analysis.FinancialAnalysis;
import com.financeai.backend.indicator.FinancialIndicator;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Component
public class RecommendationEngine {

    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal SAVINGS_RATE_THRESHOLD = BigDecimal.valueOf(5);
    private static final BigDecimal DEBT_LEVEL_THRESHOLD = BigDecimal.valueOf(40);
    private static final BigDecimal NON_ESSENTIAL_THRESHOLD = BigDecimal.valueOf(30);
    private static final int RECURRING_THRESHOLD = 5;
    private static final BigDecimal RESERVE_MONTHS_THRESHOLD = BigDecimal.valueOf(3);

    public List<Recommendation> generateRecommendations(FinancialAnalysis analysis, FinancialIndicator indicator) {
        List<Recommendation> recommendations = new ArrayList<>();

        if (indicator.getSavingsRatePercentage() != null
            && indicator.getSavingsRatePercentage().compareTo(SAVINGS_RATE_THRESHOLD) < 0) {
            recommendations.add(buildRecommendation(
                analysis,
                RecommendationPriority.HIGH,
                "Aumentar poupança gradualmente",
                "Sua taxa de poupança estimada está abaixo de 5%. Considere reservar uma parcela fixa da renda mensal.",
                "Taxa de poupança estimada de " + indicator.getSavingsRatePercentage() + "% está abaixo do ideal.",
                "POUPANCA",
                "Aumento da reserva de emergência e maior segurança financeira.",
                suggestedSavingsAmount(indicator),
                "estimatedSavingsRate"
            ));
        }

        if (indicator.getDebtLevelPercentage() != null
            && indicator.getDebtLevelPercentage().compareTo(DEBT_LEVEL_THRESHOLD) > 0) {
            recommendations.add(buildRecommendation(
                analysis,
                RecommendationPriority.CRITICAL,
                "Reduzir dívidas",
                "O nível de endividamento ultrapassa 40% da renda. Priorize o pagamento de dívidas com juros mais altos.",
                "Nível de endividamento de " + indicator.getDebtLevelPercentage() + "% está elevado.",
                "DIVIDAS",
                "Redução do custo financeiro e menor comprometimento da renda.",
                null,
                "debtLevelPercentage"
            ));
        }

        if (indicator.getNonEssentialExpensesPercentage() != null
            && indicator.getNonEssentialExpensesPercentage().compareTo(NON_ESSENTIAL_THRESHOLD) > 0) {
            recommendations.add(buildRecommendation(
                analysis,
                RecommendationPriority.MEDIUM,
                "Revisar gastos não essenciais",
                "Gastos não essenciais representam mais de 30% das despesas. Revista assinaturas e lazer.",
                "Gastos não essenciais em " + indicator.getNonEssentialExpensesPercentage() + "%.",
                "LAZER",
                "Maior sobra mensal para investimentos e reserva.",
                null,
                "nonEssentialExpensesPercentage"
            ));
        }

        if (indicator.getTotalExpenses() != null && indicator.getMonthlyIncome() != null
            && indicator.getTotalExpenses().compareTo(indicator.getMonthlyIncome()) > 0) {
            recommendations.add(buildRecommendation(
                analysis,
                RecommendationPriority.CRITICAL,
                "Despesas superam renda",
                "Suas despesas totais são maiores que a renda mensal. É necessário cortar gastos ou aumentar a renda urgentemente.",
                "Despesas (" + indicator.getTotalExpenses() + ") superam renda (" + indicator.getMonthlyIncome() + ").",
                "ORCAMENTO",
                "Equilíbrio entre receitas e despesas.",
                indicator.getTotalExpenses().subtract(indicator.getMonthlyIncome()),
                "totalExpenses"
            ));
        }

        if (indicator.getRecurringExpensesCount() != null && indicator.getRecurringExpensesCount() > RECURRING_THRESHOLD) {
            recommendations.add(buildRecommendation(
                analysis,
                RecommendationPriority.MEDIUM,
                "Revisar assinaturas",
                "Você possui mais de 5 despesas recorrentes. Avalie cancelar serviços pouco utilizados.",
                "Total de despesas recorrentes: " + indicator.getRecurringExpensesCount() + ".",
                "SERVICOS",
                "Redução de gastos fixos mensais.",
                null,
                "recurringExpensesCount"
            ));
        }

        if (indicator.getReserveInMonths() != null
            && indicator.getReserveInMonths().compareTo(RESERVE_MONTHS_THRESHOLD) < 0) {
            recommendations.add(buildRecommendation(
                analysis,
                RecommendationPriority.HIGH,
                "Construir reserva de emergência",
                "Sua reserva financeira cobre menos de 3 meses de despesas. Construa uma reserva de emergência.",
                "Reserva cobre " + indicator.getReserveInMonths() + " meses de despesas.",
                "RESERVA",
                "Proteção contra imprevistos financeiros.",
                targetReserveAmount(indicator),
                "reserveInMonths"
            ));
        }

        return recommendations;
    }

    private Recommendation buildRecommendation(FinancialAnalysis analysis,
                                               RecommendationPriority priority,
                                               String title,
                                               String description,
                                               String reason,
                                               String category,
                                               String expectedImpact,
                                               BigDecimal suggestedAmount,
                                               String relatedIndicator) {
        Recommendation recommendation = new Recommendation();
        recommendation.setAnalysis(analysis);
        recommendation.setPriority(priority);
        recommendation.setTitle(title);
        recommendation.setDescription(description);
        recommendation.setReason(reason);
        recommendation.setCategory(category);
        recommendation.setExpectedImpact(expectedImpact);
        recommendation.setSuggestedAmount(suggestedAmount);
        recommendation.setRelatedIndicator(relatedIndicator);
        return recommendation;
    }

    private BigDecimal suggestedSavingsAmount(FinancialIndicator indicator) {
        if (indicator.getMonthlyIncome() == null) {
            return null;
        }
        return indicator.getMonthlyIncome()
            .multiply(BigDecimal.valueOf(0.10))
            .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal targetReserveAmount(FinancialIndicator indicator) {
        if (indicator.getTotalExpenses() == null) {
            return null;
        }
        return indicator.getTotalExpenses()
            .multiply(RESERVE_MONTHS_THRESHOLD)
            .setScale(2, RoundingMode.HALF_UP);
    }
}
