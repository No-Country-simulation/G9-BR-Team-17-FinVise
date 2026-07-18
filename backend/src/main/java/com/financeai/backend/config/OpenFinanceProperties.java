package com.financeai.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "finance-ai.open-finance")
public class OpenFinanceProperties {

    private String provider = "pluggy";
    private String baseUrl = "https://api.pluggy.ai";
    private String clientId = "";
    private String clientSecret = "";
    private String webhookUrl = "";
    private String oauthRedirectUrl = "";
    private boolean includeSandbox = false;

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank();
    }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }
    public String getWebhookUrl() { return webhookUrl; }
    public void setWebhookUrl(String webhookUrl) { this.webhookUrl = webhookUrl; }
    public String getOauthRedirectUrl() { return oauthRedirectUrl; }
    public void setOauthRedirectUrl(String oauthRedirectUrl) { this.oauthRedirectUrl = oauthRedirectUrl; }
    public boolean isIncludeSandbox() { return includeSandbox; }
    public void setIncludeSandbox(boolean includeSandbox) { this.includeSandbox = includeSandbox; }
}
