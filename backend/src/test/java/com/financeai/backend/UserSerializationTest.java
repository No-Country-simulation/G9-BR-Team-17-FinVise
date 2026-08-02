package com.financeai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.analysis.FinancialAnalysis;
import com.financeai.backend.user.FinancialAnalysisHistoryDto;
import com.financeai.backend.user.User;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void shouldNeverSerializePasswordHash() throws Exception {
        User user = new User();
        user.setEmail("user@example.com");
        user.setName("User");
        user.setPasswordHash("sensitive-password-hash");

        String json = objectMapper.writeValueAsString(user);

        assertThat(json)
            .contains("\"email\":\"user@example.com\"")
            .doesNotContain("passwordHash")
            .doesNotContain("sensitive-password-hash");
    }

    @Test
    void historyDtoShouldNotExposeItsUserEntity() throws Exception {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("sensitive-password-hash");
        FinancialAnalysis analysis = new FinancialAnalysis();
        analysis.setUser(user);
        analysis.setProfileClassification("BALANCED");

        String json = objectMapper.writeValueAsString(
            FinancialAnalysisHistoryDto.from(analysis));

        assertThat(json)
            .contains("\"profileClassification\":\"BALANCED\"")
            .doesNotContain("\"user\"")
            .doesNotContain("user@example.com")
            .doesNotContain("sensitive-password-hash");
    }
}
