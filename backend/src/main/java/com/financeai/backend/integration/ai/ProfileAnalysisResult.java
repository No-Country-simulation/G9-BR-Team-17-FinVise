package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;

public record ProfileAnalysisResult(
    String classification,
    BigDecimal score,
    BigDecimal confidence,
    @JsonProperty("main_factors")
    List<String> mainFactors,
    @JsonProperty("model_version")
    String modelVersion,
    @JsonProperty("model_status")
    String modelStatus
) {
}
