package com.financeai.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class FinanceAiBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(FinanceAiBackendApplication.class, args);
    }
}
