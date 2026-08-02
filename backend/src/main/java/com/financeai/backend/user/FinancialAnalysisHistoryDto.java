package com.financeai.backend.user;

import com.financeai.backend.analysis.FinancialAnalysis;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record FinancialAnalysisHistoryDto(
    UUID id,
    String analysisPeriod,
    String profileClassification,
    BigDecimal score,
    BigDecimal confidence,
    Map<String, String> modelVersions,
    Instant createdAt,
    Instant updatedAt
) {
    public static FinancialAnalysisHistoryDto from(FinancialAnalysis analysis) {
        return new FinancialAnalysisHistoryDto(
            analysis.getId(),
            analysis.getAnalysisPeriod(),
            analysis.getProfileClassification(),
            analysis.getScore(),
            analysis.getConfidence(),
            analysis.getModelVersions(),
            analysis.getCreatedAt(),
            analysis.getUpdatedAt()
        );
    }
}
