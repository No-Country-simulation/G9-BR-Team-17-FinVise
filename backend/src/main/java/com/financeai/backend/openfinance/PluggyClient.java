package com.financeai.backend.openfinance;

import com.fasterxml.jackson.databind.JsonNode;
import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.config.OpenFinanceProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class PluggyClient {
    private final OpenFinanceProperties properties;
    private final RestClient client;

    public PluggyClient(OpenFinanceProperties properties) {
        this.properties = properties;
        this.client = RestClient.builder().baseUrl(properties.getBaseUrl()).build();
    }

    public String createConnectToken(String userId) {
        requireConfiguration();
        String apiKey = authenticate();
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("clientUserId", userId);
        options.put("avoidDuplicates", true);
        if (properties.getWebhookUrl() != null && !properties.getWebhookUrl().isBlank()) {
            options.put("webhookUrl", properties.getWebhookUrl());
        }
        if (properties.getOauthRedirectUrl() != null && !properties.getOauthRedirectUrl().isBlank()) {
            options.put("oauthRedirectUri", properties.getOauthRedirectUrl());
        }

        try {
            JsonNode response = client.post()
                .uri("/connect_token")
                .header("X-API-KEY", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("options", options))
                .retrieve()
                .body(JsonNode.class);
            String token = text(response, "accessToken");
            if (token == null) token = text(response, "connectToken");
            if (token == null) {
                throw new BusinessException("OPEN_FINANCE_INVALID_RESPONSE", "O provedor não retornou o token de conexão");
            }
            return token;
        } catch (RestClientException exception) {
            throw providerFailure("Falha ao criar consentimento Open Finance", exception);
        }
    }

    public PluggySyncData fetchTransactions(String itemId, String expectedClientUserId) {
        requireConfiguration();
        String apiKey = authenticate();
        try {
            verifyItemOwner(apiKey, itemId, expectedClientUserId);
            JsonNode accountsResponse = client.get()
                .uri(uriBuilder -> uriBuilder.path("/accounts").queryParam("itemId", itemId).build())
                .header("X-API-KEY", apiKey)
                .retrieve()
                .body(JsonNode.class);
            JsonNode accounts = accountsResponse != null ? accountsResponse.path("results") : null;
            if (accounts == null || !accounts.isArray()) {
                throw new BusinessException("OPEN_FINANCE_INVALID_RESPONSE", "O provedor não retornou as contas conectadas");
            }

            List<PluggyTransaction> transactions = new ArrayList<>();
            List<String> accountNames = new ArrayList<>();
            for (JsonNode account : accounts) {
                String accountId = text(account, "id");
                String accountType = text(account, "type");
                String accountName = text(account, "name");
                if (accountName != null && !accountNames.contains(accountName)) {
                    accountNames.add(accountName);
                }
                if (accountId != null) {
                    transactions.addAll(fetchAccountTransactions(apiKey, accountId, accountType));
                }
            }
            String displayName = accountNames.isEmpty()
                ? null
                : String.join(" • ", accountNames.stream().limit(3).toList());
            return new PluggySyncData(transactions, displayName);
        } catch (RestClientException exception) {
            throw providerFailure("Falha ao sincronizar transações do Open Finance", exception);
        }
    }

    private void verifyItemOwner(String apiKey, String itemId, String expectedClientUserId) {
        JsonNode item = client.get()
            .uri("/items/{id}", itemId)
            .header("X-API-KEY", apiKey)
            .retrieve()
            .body(JsonNode.class);
        String clientUserId = text(item, "clientUserId");
        if (clientUserId == null || !clientUserId.equals(expectedClientUserId)) {
            throw new AccessDeniedException("A conexão Open Finance não pertence ao usuário autenticado");
        }
    }

    private List<PluggyTransaction> fetchAccountTransactions(String apiKey,
                                                              String accountId,
                                                              String accountType) {
        List<PluggyTransaction> result = new ArrayList<>();
        String after = null;
        int page = 0;
        do {
            String currentAfter = after;
            JsonNode response = client.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/v2/transactions").queryParam("accountId", accountId);
                    if (currentAfter != null && !currentAfter.isBlank()) builder.queryParam("after", currentAfter);
                    return builder.build();
                })
                .header("X-API-KEY", apiKey)
                .retrieve()
                .body(JsonNode.class);

            JsonNode items = response != null ? response.path("results") : null;
            if (items != null && items.isArray()) {
                for (JsonNode item : items) {
                    if (!"POSTED".equalsIgnoreCase(text(item, "status"))) continue;
                    String id = text(item, "id");
                    String description = text(item, "description");
                    String date = text(item, "date");
                    if (id == null || description == null || date == null || !item.hasNonNull("amount")) continue;
                    result.add(new PluggyTransaction(
                        id,
                        description,
                        item.path("amount").decimalValue(),
                        OffsetDateTime.parse(date).toLocalDate(),
                        text(item, "type"),
                        accountType
                    ));
                }
            }

            after = extractAfter(response != null ? text(response, "next") : null);
            page++;
        } while (after != null && page < 100);
        return result;
    }

    private String authenticate() {
        try {
            JsonNode response = client.post()
                .uri("/auth")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "clientId", properties.getClientId(),
                    "clientSecret", properties.getClientSecret()
                ))
                .retrieve()
                .body(JsonNode.class);
            String apiKey = text(response, "apiKey");
            if (apiKey == null) {
                throw new BusinessException("OPEN_FINANCE_INVALID_RESPONSE", "O provedor não retornou a chave da API");
            }
            return apiKey;
        } catch (RestClientException exception) {
            throw providerFailure("Falha ao autenticar no provedor Open Finance", exception);
        }
    }

    private String extractAfter(String next) {
        if (next == null || next.isBlank()) return null;
        return UriComponentsBuilder.fromUriString(next).build().getQueryParams().getFirst("after");
    }

    private String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) return null;
        String value = node.path(field).asText();
        return value.isBlank() ? null : value;
    }

    private void requireConfiguration() {
        if (!properties.isConfigured()) {
            throw new BusinessException(
                "OPEN_FINANCE_NOT_CONFIGURED",
                "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET para habilitar o Open Finance");
        }
    }

    private BusinessException providerFailure(String message, Exception cause) {
        return new BusinessException("OPEN_FINANCE_PROVIDER_ERROR", message, cause);
    }

    public record PluggyTransaction(
        String id,
        String description,
        BigDecimal amount,
        java.time.LocalDate date,
        String type,
        String accountType
    ) {
    }

    public record PluggySyncData(List<PluggyTransaction> transactions, String displayName) {
    }
}
