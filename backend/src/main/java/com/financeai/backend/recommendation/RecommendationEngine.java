package com.financeai.backend.recommendation;

import com.financeai.backend.analysis.FinancialAnalysis;
import com.financeai.backend.indicator.FinancialIndicator;
import com.financeai.backend.integration.ai.AiServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class RecommendationEngine {

    private static final Logger log = LoggerFactory.getLogger(RecommendationEngine.class);

    private static final BigDecimal SAVINGS_RATE_THRESHOLD = BigDecimal.valueOf(5);
    private static final BigDecimal DEBT_LEVEL_THRESHOLD = BigDecimal.valueOf(40);
    private static final BigDecimal NON_ESSENTIAL_THRESHOLD = BigDecimal.valueOf(30);
    private static final int RECURRING_THRESHOLD = 5;
    private static final BigDecimal RESERVE_MONTHS_THRESHOLD = BigDecimal.valueOf(3);

    private final AiServiceClient aiServiceClient;

    public RecommendationEngine() {
        this(null);
    }

    @Autowired(required = false)
    public RecommendationEngine(AiServiceClient aiServiceClient) {
        this.aiServiceClient = aiServiceClient;
    }

    public List<Recommendation> generateRecommendations(FinancialAnalysis analysis, FinancialIndicator indicator) {
        // Tentar gerar via Agente de IA primeiro se o client estiver disponível
        if (aiServiceClient != null) {
            try {
                List<Recommendation> aiRecommendations = tryGenerateWithAi(analysis, indicator);
                if (aiRecommendations != null && !aiRecommendations.isEmpty()) {
                    log.info("Geradas {} recomendações via Agente de IA para a análise {}",
                        aiRecommendations.size(), analysis.getId());
                    return aiRecommendations;
                }
            } catch (Exception e) {
                log.warn("Falha na chamada do Agente de IA para recomendações, usando fallback estático: {}", e.getMessage());
            }
        }

        // Fallback: Motor de Regras Determinísticas
        log.info("Gerando recomendações via Motor de Regras Determinísticas (Fallback) para a análise {}", analysis.getId());
        return generateRuleBasedRecommendations(analysis, indicator);
    }

    private List<Recommendation> tryGenerateWithAi(FinancialAnalysis analysis, FinancialIndicator indicator) {
        Map<String, Object> indicatorsMap = new HashMap<>();
        indicatorsMap.put("incomeCommitmentPercentage", indicator.getIncomeCommitmentPercentage() != null ? indicator.getIncomeCommitmentPercentage().doubleValue() : 0.0);
        indicatorsMap.put("savingsRatePercentage", indicator.getSavingsRatePercentage() != null ? indicator.getSavingsRatePercentage().doubleValue() : 0.0);
        indicatorsMap.put("fixedExpensesPercentage", indicator.getFixedExpensesPercentage() != null ? indicator.getFixedExpensesPercentage().doubleValue() : 0.0);
        indicatorsMap.put("nonEssentialExpensesPercentage", indicator.getNonEssentialExpensesPercentage() != null ? indicator.getNonEssentialExpensesPercentage().doubleValue() : 0.0);
        indicatorsMap.put("recurringExpensesCount", indicator.getRecurringExpensesCount() != null ? indicator.getRecurringExpensesCount() : 0);
        indicatorsMap.put("transactionsExpenseCount", 0);
        indicatorsMap.put("expenseVariationPercentage", indicator.getVariationPercentage() != null ? indicator.getVariationPercentage().doubleValue() : 0.0);
        indicatorsMap.put("reserveInMonths", indicator.getReserveInMonths() != null ? indicator.getReserveInMonths().doubleValue() : 0.0);

        BigDecimal reserve = indicator.getMonthlyBalance() != null ? indicator.getMonthlyBalance().max(BigDecimal.ZERO) : BigDecimal.ZERO;

        AiServiceClient.AiRecommendationRequest req = new AiServiceClient.AiRecommendationRequest(
            indicator.getMonthlyIncome() != null ? indicator.getMonthlyIncome() : BigDecimal.ZERO,
            indicator.getDebtLevelPercentage() != null ? indicator.getDebtLevelPercentage() : BigDecimal.ZERO,
            "",
            reserve,
            indicatorsMap,
            Map.of()
        );

        AiServiceClient.AiRecommendationResponse res = aiServiceClient.generateRecommendations(req);
        if (res == null || res.recommendations() == null || res.recommendations().isEmpty()) {
            return List.of();
        }

        List<Recommendation> recommendations = new ArrayList<>();
        for (AiServiceClient.AiRecommendationItem item : res.recommendations()) {
            RecommendationPriority priority = parsePriority(item.priority());
            recommendations.add(buildRecommendation(
                analysis,
                priority,
                item.title() != null ? item.title() : "Sugestão Financeira",
                item.description() != null ? item.description() : "",
                item.reason() != null ? item.reason() : "",
                item.category() != null ? item.category() : "ORCAMENTO",
                item.impact() != null ? item.impact() : "",
                item.suggestedAmount(),
                item.relatedIndicator() != null ? item.relatedIndicator() : ""
            ));
        }
        return recommendations;
    }

    private RecommendationPriority parsePriority(String priorityStr) {
        if (priorityStr == null) {
            return RecommendationPriority.MEDIUM;
        }
        try {
            return RecommendationPriority.valueOf(priorityStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return RecommendationPriority.MEDIUM;
        }
    }

    public List<Recommendation> generateRuleBasedRecommendations(FinancialAnalysis analysis, FinancialIndicator indicator) {
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
