package com.financeai.backend;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;

@ActiveProfiles("test")
public abstract class PostgresTestSupport {

    private static EmbeddedPostgres embeddedPostgres;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) throws IOException {
        embeddedPostgres = EmbeddedPostgres.start();
        registry.add("spring.datasource.url", () -> embeddedPostgres.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
    }

    @AfterAll
    static void tearDown() throws IOException {
        if (embeddedPostgres != null) {
            embeddedPostgres.close();
        }
    }
}
