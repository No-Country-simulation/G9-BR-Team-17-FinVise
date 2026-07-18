package com.financeai.backend.recommendation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RecommendationDto(
    UUID id,
    String title,
    String description,
    String reason,
    RecommendationPriority priority,
    String category,
    String expectedImpact,
    BigDecimal suggestedAmount,
    String relatedIndicator,
    Instant createdAt
) {
}
