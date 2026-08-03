package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record AgentRespondRequest(
    @JsonProperty("conversation_id") String conversationId,
    @JsonProperty("user_id") String userId,
    @JsonProperty("messages") List<MessageDto> messages,
    @JsonProperty("context") AgentContextDto context
) {
    public static final String CONTEXT_SCHEMA_VERSION = "1.0";

    public record MessageDto(
        @JsonProperty("role") String role,
        @JsonProperty("content") String content
    ) {}

    public record AgentContextDto(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("financial_profile") FinancialProfileDto financialProfile,
        @JsonProperty("indicators") FinancialIndicatorsDto indicators,
        @JsonProperty("spending_summary") SpendingSummaryDto spendingSummary,
        @JsonProperty("recommendations") List<RecommendationDto> recommendations,
        @JsonProperty("transactions") List<TransactionContextDto> transactions,
        @JsonProperty("recurring_expenses") List<RecurringExpenseDto> recurringExpenses,
        @JsonProperty("previous_period_indicators") FinancialIndicatorsDto previousPeriodIndicators,
        @JsonProperty("analytical_facts") Map<String, Object> analyticalFacts,
        @JsonProperty("retrieval") RetrievalDto retrieval
    ) {
        /** Convenience constructor for empty context. */
        public AgentContextDto() {
            this(CONTEXT_SCHEMA_VERSION, FinancialProfileDto.empty(), FinancialIndicatorsDto.empty(),
                SpendingSummaryDto.empty(), List.of(), List.of(), List.of(), null, Map.of(),
                new RetrievalDto(5, List.of()));
        }
    }

    public record FinancialProfileDto(
        @JsonProperty("source") String source,
        @JsonProperty("transaction_count") int transactionCount,
        @JsonProperty("period_start") String periodStart,
        @JsonProperty("period_end") String periodEnd,
        @JsonProperty("month_count") int monthCount,
        @JsonProperty("monthly_income") BigDecimal monthlyIncome,
        @JsonProperty("monthly_expenses") BigDecimal monthlyExpenses
    ) {
        public static FinancialProfileDto empty() {
            return new FinancialProfileDto(
                "ALL", 0, null, null, 0, BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    public record FinancialIndicatorsDto(
        @JsonProperty("total_income") BigDecimal totalIncome,
        @JsonProperty("total_expenses") BigDecimal totalExpenses,
        @JsonProperty("balance") BigDecimal balance,
        @JsonProperty("transaction_count") int transactionCount,
        @JsonProperty("savings_rate_pct") BigDecimal savingsRatePct,
        @JsonProperty("income_commitment_pct") BigDecimal incomeCommitmentPct
    ) {
        public static FinancialIndicatorsDto empty() {
            return new FinancialIndicatorsDto(
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, null, null);
        }
    }

    public record SpendingSummaryDto(
        @JsonProperty("by_category") Map<String, BigDecimal> byCategory,
        @JsonProperty("total_expenses") BigDecimal totalExpenses
    ) {
        public static SpendingSummaryDto empty() {
            return new SpendingSummaryDto(Map.of(), BigDecimal.ZERO);
        }
    }

    public record RecommendationDto(
        @JsonProperty("title") String title,
        @JsonProperty("description") String description,
        @JsonProperty("category") String category,
        @JsonProperty("priority") String priority
    ) {}

    public record TransactionContextDto(
        @JsonProperty("description") String description,
        @JsonProperty("amount") BigDecimal amount,
        @JsonProperty("type") String type,
        @JsonProperty("date") String date,
        @JsonProperty("payment_method") String paymentMethod,
        @JsonProperty("recurrent") boolean recurrent
    ) {}

    public record RecurringExpenseDto(
        @JsonProperty("description") String description,
        @JsonProperty("amount") BigDecimal amount,
        @JsonProperty("date") String date
    ) {}

    public record RetrievalDto(
        @JsonProperty("top_k") int topK,
        @JsonProperty("source_ids") List<String> sourceIds
    ) {}
}
