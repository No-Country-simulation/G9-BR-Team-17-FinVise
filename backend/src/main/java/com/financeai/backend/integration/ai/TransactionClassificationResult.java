package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record TransactionClassificationResult(
    List<Prediction> predictions,
    @JsonProperty("model_version")
    String modelVersion,
    @JsonProperty("model_status")
    String modelStatus
) {

    public record Prediction(
        String category,
        String subcategory,
        Double confidence,
        @JsonProperty("top_features")
        List<String> topFeatures
    ) {
    }
}
