package com.financeai.backend;

import com.financeai.backend.config.AiServiceProperties;
import com.financeai.backend.config.JwtProperties;
import com.financeai.backend.config.ProductionSecretsValidator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecretsValidatorTest {

    @Test
    void shouldRejectKnownProductionPlaceholders() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setSecret("change_me_to_a_256_bit_secret_minimum_32_chars");
        ProductionSecretsValidator validator = new ProductionSecretsValidator(
            jwtProperties, validAiServiceProperties(), "change_me_in_production");

        assertThatThrownBy(validator::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void shouldRejectWeakProductionDatabasePassword() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setSecret("v7!j6U6fcbapV4wxG6Jwz3W5DXgb21V9sZqR0QpfKcM");
        ProductionSecretsValidator validator = new ProductionSecretsValidator(
            jwtProperties, validAiServiceProperties(), "postgres");

        assertThatThrownBy(validator::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SPRING_DATASOURCE_PASSWORD");
    }

    @Test
    void shouldAcceptStrongProductionSecrets() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setSecret("v7!j6U6fcbapV4wxG6Jwz3W5DXgb21V9sZqR0QpfKcM");
        ProductionSecretsValidator validator = new ProductionSecretsValidator(
            jwtProperties, validAiServiceProperties(), "w!W5t7wuk9ULrhx0t7fG2jfK");

        assertThatCode(validator::validate).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectWeakAiServiceTokenInProduction() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setSecret("v7!j6U6fcbapV4wxG6Jwz3W5DXgb21V9sZqR0QpfKcM");
        AiServiceProperties aiServiceProperties = new AiServiceProperties();
        aiServiceProperties.setServiceToken("change_me_to_a_secure_service_token");
        ProductionSecretsValidator validator = new ProductionSecretsValidator(
            jwtProperties,
            aiServiceProperties,
            "w!W5t7wuk9ULrhx0t7fG2jfK");

        assertThatThrownBy(validator::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("AI_SERVICE_TOKEN");
    }

    private AiServiceProperties validAiServiceProperties() {
        AiServiceProperties properties = new AiServiceProperties();
        properties.setServiceToken("v4B!2yM8xQ7nL5cR9pT3kW6sD1fG0hJz");
        return properties;
    }
}
