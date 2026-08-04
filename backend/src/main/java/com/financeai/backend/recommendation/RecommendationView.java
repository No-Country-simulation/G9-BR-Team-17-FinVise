package com.financeai.backend.recommendation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface RecommendationView {
    UUID getAnalysisId();
    UUID getId();
    String getTitle();
    String getDescription();
    String getReason();
    RecommendationPriority getPriority();
    String getCategory();
    String getExpectedImpact();
    BigDecimal getSuggestedAmount();
    String getRelatedIndicator();
    Instant getCreatedAt();
}
