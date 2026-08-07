package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.financeai.backend.config.AiServiceProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Component
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);
    private static final String USER_ID_HEADER = "X-FinVise-User-Id";
    private static final int MINIMUM_SERVICE_TOKEN_LENGTH = 32;

    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiServiceClient(AiServiceProperties properties) {
        String serviceToken = properties.getServiceToken();
        if (serviceToken == null || serviceToken.length() < MINIMUM_SERVICE_TOKEN_LENGTH) {
            throw new IllegalStateException(
                "AI_SERVICE_TOKEN deve conter pelo menos 32 caracteres");
        }
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getConnectTimeoutMs().intValue());
        factory.setReadTimeout(properties.getReadTimeoutMs().intValue());
        this.restClient = RestClient.builder()
            .baseUrl(properties.getUrl())
            .requestFactory(factory)
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + serviceToken)
            .build();
    }

    public TransactionClassificationResult classifyTransactions(TransactionClassificationRequest request) {
        try {
            return restClient.post()
                .uri("/internal/v1/transactions/classify")
                .body(request)
                .retrieve()
                .body(TransactionClassificationResult.class);
        } catch (RestClientException e) {
            log.warn("Falha ao chamar ai-service para classificação: {}", e.getMessage());
            return null;
        }
    }

    public ProfileAnalysisResult analyzeProfile(ProfileAnalysisRequest request) {
        try {
            return restClient.post()
                .uri("/internal/v1/profiles/analyze")
                .body(request)
                .retrieve()
                .body(ProfileAnalysisResult.class);
        } catch (RestClientException e) {
            log.warn("Falha ao chamar ai-service para análise de perfil: {}", e.getMessage());
            return null;
        }
    }

    public AiRecommendationResponse generateRecommendations(AiRecommendationRequest request) {
        try {
            return restClient.post()
                .uri("/internal/v1/recommendations/generate")
                .body(request)
                .retrieve()
                .body(AiRecommendationResponse.class);
        } catch (RestClientException e) {
            log.warn("Falha ao chamar ai-service para geração de recomendações: {}", e.getMessage());
            return null;
        }
    }

    public AgentRespondResponse agentRespond(AgentRespondRequest request) {
        try {
            return restClient.post()
                .uri("/internal/v1/agent/respond")
                .header(USER_ID_HEADER, request.userId())
                .body(request)
                .retrieve()
                .body(AgentRespondResponse.class);
        } catch (RestClientException e) {
            log.warn("Falha ao chamar ai-service para resposta do agente: {}", e.getMessage());
            return null;
        }
    }

    public void agentRespondStream(
        AgentRespondRequest request,
        Consumer<AgentStreamEvent> eventConsumer
    ) {
        restClient.post()
            .uri("/internal/v1/agent/respond/stream")
            .header(USER_ID_HEADER, request.userId())
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.TEXT_EVENT_STREAM)
            .body(request)
            .exchange((httpRequest, response) -> {
                if (!response.getStatusCode().is2xxSuccessful()) {
                    throw new RestClientException(
                        "AI Service respondeu com status " + response.getStatusCode());
                }

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    response.getBody(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (!line.startsWith("data:")) {
                            continue;
                        }

                        String data = line.substring(5).trim();
                        if (data.isEmpty() || "[DONE]".equals(data)) {
                            continue;
                        }

                        JsonNode payload = objectMapper.readTree(data);
                        String type = payload.path("type").asText();
                        if (type.isBlank() && payload.has("token")) {
                            type = "token";
                        }

                        List<String> tools = new ArrayList<>();
                        payload.path("tools").forEach(tool -> tools.add(tool.asText()));
                        List<Map<String, Object>> sources = new ArrayList<>();
                        if (payload.path("sources").isArray()) {
                            payload.path("sources").forEach(source -> sources.add(
                                objectMapper.convertValue(source,
                                    new com.fasterxml.jackson.core.type.TypeReference<>() {})));
                        }
                        eventConsumer.accept(new AgentStreamEvent(
                            type,
                            payload.path("token").asText(null),
                            tools,
                            sources,
                            payload.path("message").asText(null)
                        ));
                    }
                }
                return null;
            });
    }

    public ModelStatusResult getModelStatus() {
        try {
            return restClient.get()
                .uri("/internal/v1/models/status")
                .retrieve()
                .body(ModelStatusResult.class);
        } catch (RestClientException e) {
            log.warn("Falha ao obter status dos modelos: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Triggers embedding generation for all un-embedded RAG document chunks of a user.
     * Called after CSV import or Open Finance sync inserts new chunks.
     * Returns the count of indexed vectors.
     */
    public int indexRagDocuments(String userId) {
        return indexRagDocuments(userId, List.of());
    }

    public int indexRagDocuments(String userId, List<String> sourceIds) {
        return indexRagDocuments(userId, sourceIds, false);
    }

    public int indexRagDocuments(String userId,
                                 List<String> sourceIds,
                                 boolean background) {
        try {
            return requestRagIndex(userId, sourceIds, background, null).indexedCount();
        } catch (RuntimeException e) {
            log.warn("Falha ao solicitar indexação RAG ao ai-service: {}", e.getMessage());
            return 0;
        }
    }

    public int indexRagDocumentsOrThrow(String userId, List<String> sourceIds) {
        return requestRagIndex(userId, sourceIds, false, null).indexedCount();
    }

    public RagIndexResponse indexRagBatchOrThrow(String userId, List<String> sourceIds) {
        return requestRagIndex(userId, sourceIds, false, 1);
    }

    private RagIndexResponse requestRagIndex(String userId,
                                             List<String> sourceIds,
                                             boolean background,
                                             Integer maxBatches) {
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("source_ids", sourceIds != null ? sourceIds : List.of());
        body.put("background", background);
        if (maxBatches != null) {
            body.put("max_batches", maxBatches);
        }
        RagIndexResponse response = restClient.post()
            .uri("/internal/v1/rag/index")
            .header(USER_ID_HEADER, userId)
            .body(body)
            .retrieve()
            .body(RagIndexResponse.class);
        if (response == null) {
            throw new IllegalStateException("Resposta vazia do AI Service na indexação RAG");
        }
        log.info("Indexação RAG concluída no ai-service com {} vetores para user_id={}",
            response.indexedCount(), userId);
        return response;
    }

    public record AiRecommendationRequest(
        BigDecimal monthlyIncome,
        BigDecimal debtLevelPercentage,
        String savingFrequency,
        BigDecimal financialReserve,
        Map<String, Object> indicators,
        Map<String, BigDecimal> spendingByCategory
    ) {}

    public record AiRecommendationItem(
        String title,
        String description,
        String reason,
        String priority,
        String category,
        String impact,
        BigDecimal suggestedAmount,
        String relatedIndicator
    ) {}

    public record AiRecommendationResponse(
        String source,
        List<AiRecommendationItem> recommendations
    ) {}

    public record RagIndexResponse(
        @JsonProperty("indexed_count") int indexedCount,
        @JsonProperty("user_id") String userId,
        @JsonProperty("has_more") boolean hasMore
    ) {}

    public record AgentStreamEvent(
        String type,
        String token,
        List<String> tools,
        List<Map<String, Object>> sources,
        String message
    ) {
        public AgentStreamEvent(String type,
                                String token,
                                List<String> tools,
                                String message) {
            this(type, token, tools, List.of(), message);
        }
    }
}
