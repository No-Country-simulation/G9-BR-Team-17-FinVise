package com.financeai.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.integration.ai.AgentRespondRequest;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AgentContextContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void shouldDeserializeAndSerializeTheSharedAgentContextContract() throws Exception {
        String contract = Files.readString(
            Path.of("..", "contracts", "agent-context-v1.json"));

        AgentRespondRequest request = objectMapper.readValue(
            contract, AgentRespondRequest.class);

        assertThat(request.context().schemaVersion())
            .isEqualTo(AgentRespondRequest.CONTEXT_SCHEMA_VERSION);
        assertThat(request.context().financialProfile().monthlyIncome())
            .isEqualByComparingTo(new BigDecimal("5000.00"));
        assertThat(request.context().indicators().savingsRatePct())
            .isEqualByComparingTo(new BigDecimal("30.00"));
        assertThat(request.context().previousPeriodIndicators().balance())
            .isEqualByComparingTo(new BigDecimal("1800.00"));
        assertThat(request.context().recommendations().getFirst().category())
            .isEqualTo("POUPANCA");

        JsonNode expected = objectMapper.readTree(contract);
        JsonNode serialized = objectMapper.valueToTree(request);
        assertJsonEquivalent(expected, serialized);
    }

    private void assertJsonEquivalent(JsonNode expected, JsonNode actual) {
        assertThat(actual.getNodeType()).isEqualTo(expected.getNodeType());
        if (expected.isObject()) {
            List<String> expectedFields = new ArrayList<>();
            List<String> actualFields = new ArrayList<>();
            expected.fieldNames().forEachRemaining(expectedFields::add);
            actual.fieldNames().forEachRemaining(actualFields::add);
            assertThat(actualFields).containsExactlyElementsOf(expectedFields);
            expectedFields.forEach(field ->
                assertJsonEquivalent(expected.get(field), actual.get(field)));
            return;
        }
        if (expected.isArray()) {
            assertThat(actual.size()).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertJsonEquivalent(expected.get(index), actual.get(index));
            }
            return;
        }
        if (expected.isNumber()) {
            assertThat(actual.decimalValue())
                .isEqualByComparingTo(expected.decimalValue());
            return;
        }
        assertThat(actual).isEqualTo(expected);
    }
}
