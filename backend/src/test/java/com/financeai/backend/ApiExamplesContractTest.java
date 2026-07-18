package com.financeai.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.analysis.CreateAnalysisRequest;
import com.financeai.backend.transaction.ClassifyTransactionsRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class ApiExamplesContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void shouldKeepAllThreeExamplesAlignedWithCurrentApiContract() throws Exception {
        Path repositoryRoot = findRepositoryRoot();
        JsonNode canonical = objectMapper.readTree(
            repositoryRoot.resolve("finance_ai_dataset/exemplos_api.json").toFile());
        JsonNode rawCopy = objectMapper.readTree(
            repositoryRoot.resolve("data/raw/finance_ai_dataset/exemplos_api.json").toFile());

        assertThat(rawCopy).isEqualTo(canonical);

        CreateAnalysisRequest analysisRequest = objectMapper.treeToValue(
            canonical.path("exemplo_1_analise_financeira").path("request"),
            CreateAnalysisRequest.class);
        assertThat(validator.validate(analysisRequest)).isEmpty();

        for (String example : new String[] {
            "exemplo_2_classificacao_transacao",
            "exemplo_3_classificacao_transacao"
        }) {
            JsonNode node = canonical.path(example);
            ClassifyTransactionsRequest request = objectMapper.treeToValue(
                node.path("request"), ClassifyTransactionsRequest.class);
            assertThat(validator.validate(request)).isEmpty();
            assertThat(node.path("response_esperada").path("data")
                .path("classifiedTransactions").isArray()).isTrue();
            assertThat(node.toString()).doesNotContain("subcategoria");
        }
    }

    private Path findRepositoryRoot() {
        Path current = Path.of("").toAbsolutePath();
        if (Files.isDirectory(current.resolve("finance_ai_dataset"))) {
            return current;
        }
        Path parent = current.getParent();
        if (parent != null && Files.isDirectory(parent.resolve("finance_ai_dataset"))) {
            return parent;
        }
        throw new IllegalStateException("Diretório finance_ai_dataset não encontrado");
    }
}
