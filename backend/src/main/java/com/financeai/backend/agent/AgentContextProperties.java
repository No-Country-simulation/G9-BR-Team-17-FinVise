package com.financeai.backend.agent;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

@Validated
@Configuration
@ConfigurationProperties(prefix = "finance-ai.agent.context")
public class AgentContextProperties {

    @Min(2) @Max(50)
    private int historyMaxMessages = 16;
    @Min(1000)
    private int inputTokenBudget = 8000;
    @Min(256)
    private int summaryMaxChars = 4000;
    @Min(10) @Max(500)
    private int summaryBatchSize = 100;
    @Min(1) @Max(100)
    private int recentTransactions = 20;
    @Min(1) @Max(100)
    private int recurringExpenses = 20;
    @Min(1) @Max(120)
    private int analyticalMaxMonths = 60;
    @Min(10000)
    private long conversationLockTimeoutMs = 120000;

    public int getHistoryMaxMessages() { return historyMaxMessages; }
    public void setHistoryMaxMessages(int value) { historyMaxMessages = value; }
    public int getInputTokenBudget() { return inputTokenBudget; }
    public void setInputTokenBudget(int value) { inputTokenBudget = value; }
    public int getSummaryMaxChars() { return summaryMaxChars; }
    public void setSummaryMaxChars(int value) { summaryMaxChars = value; }
    public int getSummaryBatchSize() { return summaryBatchSize; }
    public void setSummaryBatchSize(int value) { summaryBatchSize = value; }
    public int getRecentTransactions() { return recentTransactions; }
    public void setRecentTransactions(int value) { recentTransactions = value; }
    public int getRecurringExpenses() { return recurringExpenses; }
    public void setRecurringExpenses(int value) { recurringExpenses = value; }
    public int getAnalyticalMaxMonths() { return analyticalMaxMonths; }
    public void setAnalyticalMaxMonths(int value) { analyticalMaxMonths = value; }
    public long getConversationLockTimeoutMs() { return conversationLockTimeoutMs; }
    public void setConversationLockTimeoutMs(long value) { conversationLockTimeoutMs = value; }
}
