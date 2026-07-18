package com.financeai.backend.analysis;

import com.financeai.backend.recommendation.RecommendationDto;
import com.financeai.backend.transaction.ClassifiedTransactionDto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record AnalysisResponse(
    UUID analysisId,
    UUID userId,
    FinancialProfileDto financialProfile,
    IndicatorDto indicators,
    Map<String, CategorySummaryDto> spendingSummary,
    List<ClassifiedTransactionDto> classifiedTransactions,
    List<RecommendationDto> recommendations,
    Map<String, String> modelVersions,
    Instant createdAt
) {

    public record CategorySummaryDto(
        BigDecimal amount,
        BigDecimal percentage
    ) {
    }
}
