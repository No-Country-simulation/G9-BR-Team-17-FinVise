package com.financeai.backend.user;

import com.financeai.backend.analysis.FinancialProfileDto;
import com.financeai.backend.analysis.IndicatorDto;
import com.financeai.backend.recommendation.RecommendationDto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record DashboardResponse(
    UUID userId,
    String name,
    FinancialProfileDto financialProfile,
    IndicatorDto indicators,
    Map<String, CategorySummary> spendingSummary,
    List<RecommendationDto> topRecommendations,
    BigDecimal financialReserve,
    String period
) {

    public record CategorySummary(
        BigDecimal amount,
        BigDecimal percentage
    ) {
    }
}
