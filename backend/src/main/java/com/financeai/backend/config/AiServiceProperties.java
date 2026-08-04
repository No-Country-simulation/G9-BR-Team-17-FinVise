package com.financeai.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "finance-ai.ai-service")
public class AiServiceProperties {

    private String url = "http://localhost:8000";
    private Long connectTimeoutMs = 5000L;
    private Long readTimeoutMs = 30000L;
    private String serviceToken;

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public Long getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(Long connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public Long getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public void setReadTimeoutMs(Long readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }

    public String getServiceToken() {
        return serviceToken;
    }

    public void setServiceToken(String serviceToken) {
        this.serviceToken = serviceToken;
    }
}
