package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.Map;

public record ModelStatusResult(
    String status,
    String environment,
    @JsonAlias("models_required")
    boolean modelsRequired,
    @JsonAlias("registered_at")
    String registeredAt,
    @JsonAlias("transaction_classifier")
    Map<String, Object> transactionClassifier,
    @JsonAlias("profile_classifier")
    Map<String, Object> profileClassifier,
    @JsonAlias("llm_provider")
    Map<String, Object> llmProvider
) {
}
