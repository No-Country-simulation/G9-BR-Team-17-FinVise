package com.financeai.backend;

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
            jwtProperties, "change_me_in_production");

        assertThatThrownBy(validator::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void shouldRejectWeakProductionDatabasePassword() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setSecret("v7!j6U6fcbapV4wxG6Jwz3W5DXgb21V9sZqR0QpfKcM");
        ProductionSecretsValidator validator = new ProductionSecretsValidator(
            jwtProperties, "postgres");

        assertThatThrownBy(validator::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SPRING_DATASOURCE_PASSWORD");
    }

    @Test
    void shouldAcceptStrongProductionSecrets() {
        JwtProperties jwtProperties = new JwtProperties();
        jwtProperties.setSecret("v7!j6U6fcbapV4wxG6Jwz3W5DXgb21V9sZqR0QpfKcM");
        ProductionSecretsValidator validator = new ProductionSecretsValidator(
            jwtProperties, "w!W5t7wuk9ULrhx0t7fG2jfK");

        assertThatCode(validator::validate).doesNotThrowAnyException();
    }
}
