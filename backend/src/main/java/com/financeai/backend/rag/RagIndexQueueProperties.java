package com.financeai.backend.rag;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

@Validated
@Configuration
@ConfigurationProperties(prefix = "finance-ai.rag.index-queue")
public class RagIndexQueueProperties {

    private boolean enabled = true;

    @Min(100)
    private long pollDelayMs = 1000;

    @Min(1000)
    private long lockTimeoutMs = 120000;

    @Min(1)
    private int maxAttempts = 5;

    @Min(100)
    private long retryBaseDelayMs = 2000;

    @Min(100)
    private long retryMaxDelayMs = 60000;

    public long retryDelayMs(int attempt) {
        long delay = retryBaseDelayMs;
        for (int current = 1; current < attempt && delay < retryMaxDelayMs; current++) {
            delay = Math.min(retryMaxDelayMs, delay > retryMaxDelayMs / 2
                ? retryMaxDelayMs
                : delay * 2);
        }
        return delay;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public long getPollDelayMs() {
        return pollDelayMs;
    }

    public void setPollDelayMs(long pollDelayMs) {
        this.pollDelayMs = pollDelayMs;
    }

    public long getLockTimeoutMs() {
        return lockTimeoutMs;
    }

    public void setLockTimeoutMs(long lockTimeoutMs) {
        this.lockTimeoutMs = lockTimeoutMs;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public long getRetryBaseDelayMs() {
        return retryBaseDelayMs;
    }

    public void setRetryBaseDelayMs(long retryBaseDelayMs) {
        this.retryBaseDelayMs = retryBaseDelayMs;
    }

    public long getRetryMaxDelayMs() {
        return retryMaxDelayMs;
    }

    public void setRetryMaxDelayMs(long retryMaxDelayMs) {
        this.retryMaxDelayMs = retryMaxDelayMs;
    }
}
