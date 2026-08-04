package com.financeai.backend;

import com.financeai.backend.config.AiServiceProperties;
import com.financeai.backend.integration.ai.*;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiServiceClientIntegrationTest {

    @RegisterExtension
    static WireMockExtension wireMock = WireMockExtension.newInstance()
        .options(wireMockConfig().dynamicPort())
        .build();

    private AiServiceClient aiServiceClient;

    @BeforeEach
    void setUp() {
        AiServiceProperties properties = new AiServiceProperties();
        properties.setUrl(wireMock.baseUrl());
        aiServiceClient = new AiServiceClient(properties);
    }

    @Test
    void shouldClassifyTransactions() {
        // given
        String responseBody = """
            {
                "predictions": [
                    {
                        "category": "ALIMENTACAO",
                        "subcategory": "SUPERMERCADO",
                        "confidence": 0.95,
                        "top_features": ["supermercado"]
                    }
                ],
                "model_version": "v1.0.0",
                "model_status": "LOADED"
            }
            """;

        wireMock.stubFor(post(urlEqualTo("/internal/v1/transactions/classify"))
            .willReturn(okJson(responseBody)));

        TransactionClassificationRequest request = new TransactionClassificationRequest(List.of(
            new TransactionClassificationRequest.TransactionPayload(
                "Supermercado", BigDecimal.valueOf(250.00), "CREDIT_CARD", false, "APP")
        ));

        // when
        TransactionClassificationResult result = aiServiceClient.classifyTransactions(request);

        // then
        assertThat(result).isNotNull();
        assertThat(result.modelVersion()).isEqualTo("v1.0.0");
        assertThat(result.predictions()).hasSize(1);
        assertThat(result.predictions().get(0).category()).isEqualTo("ALIMENTACAO");
    }

    @Test
    void shouldAnalyzeProfile() {
        // given
        String responseBody = """
            {
                "classification": "SAUDAVEL",
                "score": 82.50,
                "confidence": 0.91,
                "mainFactors": ["Renda estável", "Poupança regular"],
                "model_version": "profile-v2",
                "model_status": "LOADED"
            }
            """;

        wireMock.stubFor(post(urlEqualTo("/internal/v1/profiles/analyze"))
            .willReturn(okJson(responseBody)));

        ProfileAnalysisRequest request = new ProfileAnalysisRequest(
            "MACHINE_LEARNING",
            BigDecimal.valueOf(8000.00),
            BigDecimal.valueOf(20.00),
            "MEDIUM",
            BigDecimal.valueOf(12000.00),
            new ProfileAnalysisRequest.ProfileIndicators(
                BigDecimal.valueOf(50), BigDecimal.valueOf(15), BigDecimal.valueOf(30),
                BigDecimal.valueOf(20), 3, 5, BigDecimal.ZERO, BigDecimal.valueOf(3))
        );

        // when
        ProfileAnalysisResult result = aiServiceClient.analyzeProfile(request);

        // then
        assertThat(result).isNotNull();
        assertThat(result.classification()).isEqualTo("SAUDAVEL");
        assertThat(result.score()).isEqualByComparingTo(BigDecimal.valueOf(82.50));
        assertThat(result.modelVersion()).isEqualTo("profile-v2");
    }

    @Test
    void shouldReturnNullWhenClassifyFails() {
        // given
        wireMock.stubFor(post(urlEqualTo("/internal/v1/transactions/classify"))
            .willReturn(WireMock.serverError()));

        TransactionClassificationRequest request = new TransactionClassificationRequest(List.of(
            new TransactionClassificationRequest.TransactionPayload(
                "Farmácia", BigDecimal.valueOf(80.00), null, false, "APP")
        ));

        // when
        TransactionClassificationResult result = aiServiceClient.classifyTransactions(request);

        // then
        assertThat(result).isNull();
    }

    @Test
    void shouldDeserializeModelStatusFromSnakeCaseContract() {
        String responseBody = """
            {
                "transaction_classifier": {
                    "name": "SklearnTransactionClassifier",
                    "version": "1.1.0",
                    "status": "LOADED"
                },
                "profile_classifier": {
                    "name": "SklearnProfileClassifier",
                    "version": "1.0.0",
                    "status": "LOADED"
                },
                "llm_provider": {
                    "provider": "openai",
                    "enabled": false,
                    "model": "gpt-4o-mini"
                }
            }
            """;

        wireMock.stubFor(get(urlEqualTo("/internal/v1/models/status"))
            .willReturn(okJson(responseBody)));

        ModelStatusResult result = aiServiceClient.getModelStatus();

        assertThat(result).isNotNull();
        assertThat(result.transactionClassifier()).containsEntry("status", "LOADED");
        assertThat(result.profileClassifier()).containsEntry("version", "1.0.0");
        assertThat(result.llmProvider()).containsEntry("enabled", false);
    }

    @Test
    void shouldReturnNullWhenModelStatusFails() {
        wireMock.stubFor(get(urlEqualTo("/internal/v1/models/status"))
            .willReturn(WireMock.serverError()));

        assertThat(aiServiceClient.getModelStatus()).isNull();
    }

    @Test
    void shouldPropagateRagIndexFailureForDurableQueueRetry() {
        wireMock.stubFor(post(urlEqualTo("/internal/v1/rag/index"))
            .willReturn(WireMock.serverError()));

        assertThatThrownBy(() -> aiServiceClient.indexRagDocumentsOrThrow(
            "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", List.of()))
            .isInstanceOf(org.springframework.web.client.RestClientException.class);
    }

    @Test
    void shouldRequestSingleRagBatchAndReturnContinuationState() {
        wireMock.stubFor(post(urlEqualTo("/internal/v1/rag/index"))
            .withRequestBody(matchingJsonPath("$.max_batches", equalTo("1")))
            .willReturn(okJson("""
                {
                    "indexed_count": 200,
                    "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                    "has_more": true,
                    "status": "processing"
                }
                """)));

        AiServiceClient.RagIndexResponse result = aiServiceClient.indexRagBatchOrThrow(
            "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", List.of());

        assertThat(result.indexedCount()).isEqualTo(200);
        assertThat(result.hasMore()).isTrue();
    }

    @Test
    void shouldConsumeNamedAgentStreamEvents() {
        String responseBody = """
            event: tools
            data: {"type":"tools","tools":["get_financial_profile"]}

            event: token
            data: {"type":"token","token":"Olá"}

            event: done
            data: {"type":"done"}

            """;
        wireMock.stubFor(post(urlEqualTo("/internal/v1/agent/respond/stream"))
            .willReturn(aResponse()
                .withHeader("Content-Type", "text/event-stream")
                .withBody(responseBody)));
        AgentRespondRequest request = new AgentRespondRequest(
            "conversation-1",
            "user-1",
            List.of(new AgentRespondRequest.MessageDto("user", "Como estou?")),
            new AgentRespondRequest.AgentContextDto()
        );
        List<AiServiceClient.AgentStreamEvent> events = new java.util.ArrayList<>();

        aiServiceClient.agentRespondStream(request, events::add);

        assertThat(events).hasSize(3);
        assertThat(events.get(0).tools()).containsExactly("get_financial_profile");
        assertThat(events.get(1).token()).isEqualTo("Olá");
        assertThat(events.get(2).type()).isEqualTo("done");
    }
}
