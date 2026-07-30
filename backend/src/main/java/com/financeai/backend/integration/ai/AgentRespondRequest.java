package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record AgentRespondRequest(
    @JsonProperty("conversation_id") String conversationId,
    @JsonProperty("user_id") String userId,
    @JsonProperty("messages") List<MessageDto> messages,
    @JsonProperty("context") AgentContextDto context
) {
    public record MessageDto(
        @JsonProperty("role") String role,
        @JsonProperty("content") String content
    ) {}

    public record AgentContextDto(
        @JsonProperty("financial_profile") Map<String, Object> financialProfile,
        @JsonProperty("indicators") Map<String, Object> indicators,
        @JsonProperty("spending_summary") Map<String, Object> spendingSummary,
        @JsonProperty("recommendations") List<Object> recommendations,
        @JsonProperty("transactions") List<Object> transactions,
        @JsonProperty("recurring_expenses") List<Object> recurringExpenses,
        @JsonProperty("previous_period_indicators") Map<String, Object> previousPeriodIndicators,
        @JsonProperty("retrieval") RetrievalDto retrieval
    ) {
        /** Convenience constructor for empty context. */
        public AgentContextDto() {
            this(Map.of(), Map.of(), Map.of(), List.of(), List.of(), List.of(), Map.of(),
                new RetrievalDto(5, List.of()));
        }
    }

    public record RetrievalDto(
        @JsonProperty("top_k") int topK,
        @JsonProperty("source_ids") List<String> sourceIds
    ) {}
}
