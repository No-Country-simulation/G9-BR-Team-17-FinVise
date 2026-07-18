package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.Map;

public record ModelStatusResult(
    @JsonAlias("transaction_classifier")
    Map<String, Object> transactionClassifier,
    @JsonAlias("profile_classifier")
    Map<String, Object> profileClassifier,
    @JsonAlias("llm_provider")
    Map<String, Object> llmProvider
) {
}
