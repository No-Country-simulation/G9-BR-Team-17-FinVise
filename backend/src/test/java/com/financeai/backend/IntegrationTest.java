package com.financeai.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class IntegrationTest extends PostgresTestSupport {

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextLoads() {
        assertThat(port).isPositive();
    }

    @Test
    void actuatorHealthShouldBeUp() {
        RestClient restClient = RestClient.create();
        String response = restClient.get()
            .uri("http://localhost:{port}/actuator/health", port)
            .retrieve()
            .body(String.class);

        assertThat(response).contains("\"status\":\"UP\"");
    }

    @Test
    void cleanDatabaseShouldApplyAllMigrations() {
        Integer appliedMigrations = jdbcTemplate.queryForObject(
            "select count(*) from flyway_schema_history where success",
            Integer.class);
        String usersTable = jdbcTemplate.queryForObject(
            "select to_regclass('public.users')", String.class);

        assertThat(appliedMigrations).isEqualTo(19);
        assertThat(usersTable).isEqualTo("users");
    }
}
