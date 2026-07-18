package com.financeai.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "finance-ai.security.jwt")
public class JwtProperties {

    private String secret;
    private Long expirationMs = 86400000L;

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public Long getExpirationMs() {
        return expirationMs;
    }

    public void setExpirationMs(Long expirationMs) {
        this.expirationMs = expirationMs;
    }
}
