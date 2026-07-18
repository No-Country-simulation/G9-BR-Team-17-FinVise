package com.financeai.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class IntegrationTest extends PostgresTestSupport {

    @LocalServerPort
    private int port;

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
}
