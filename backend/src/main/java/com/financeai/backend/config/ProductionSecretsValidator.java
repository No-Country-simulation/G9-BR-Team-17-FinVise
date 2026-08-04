package com.financeai.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
@Profile("production")
public class ProductionSecretsValidator {

    private static final int MINIMUM_DATABASE_PASSWORD_LENGTH = 16;
    private static final int MINIMUM_SERVICE_TOKEN_LENGTH = 32;

    private final JwtProperties jwtProperties;
    private final AiServiceProperties aiServiceProperties;
    private final String databasePassword;

    public ProductionSecretsValidator(
        JwtProperties jwtProperties,
        AiServiceProperties aiServiceProperties,
        @Value("${spring.datasource.password}") String databasePassword
    ) {
        this.jwtProperties = jwtProperties;
        this.aiServiceProperties = aiServiceProperties;
        this.databasePassword = databasePassword;
    }

    @PostConstruct
    public void validate() {
        if (isPlaceholder(jwtProperties.getSecret())) {
            throw new IllegalStateException(
                "JWT_SECRET must be replaced with a randomly generated production secret");
        }
        if (databasePassword == null
            || databasePassword.length() < MINIMUM_DATABASE_PASSWORD_LENGTH
            || isPlaceholder(databasePassword)) {
            throw new IllegalStateException(
                "SPRING_DATASOURCE_PASSWORD must contain at least 16 characters "
                    + "and must not use a placeholder");
        }
        String serviceToken = aiServiceProperties.getServiceToken();
        if (serviceToken == null
            || serviceToken.length() < MINIMUM_SERVICE_TOKEN_LENGTH
            || isPlaceholder(serviceToken)) {
            throw new IllegalStateException(
                "AI_SERVICE_TOKEN must contain at least 32 characters "
                    + "and must not use a placeholder");
        }
    }

    private boolean isPlaceholder(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.contains("change_me")
            || normalized.contains("change-me")
            || normalized.equals("finvise")
            || normalized.equals("postgres");
    }
}
