package com.financeai.backend.integration.ai;

import com.financeai.backend.config.AiServiceProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);

    private final RestClient restClient;

    public AiServiceClient(AiServiceProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getConnectTimeoutMs().intValue());
        factory.setReadTimeout(properties.getReadTimeoutMs().intValue());
        this.restClient = RestClient.builder()
            .baseUrl(properties.getUrl())
            .requestFactory(factory)
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
}
