package com.financeai.backend.transaction;

import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.TransactionClassificationRequest;
import com.financeai.backend.integration.ai.TransactionClassificationResult;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class TransactionCategorizationService {

    private static final int CLASSIFICATION_BATCH_SIZE = 500;

    private final AiServiceClient aiServiceClient;
    private final TransactionCategoryRepository categoryRepository;

    public TransactionCategorizationService(AiServiceClient aiServiceClient,
                                            TransactionCategoryRepository categoryRepository) {
        this.aiServiceClient = aiServiceClient;
        this.categoryRepository = categoryRepository;
    }

    public CategorizationResult categorize(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return new CategorizationResult(0, 0, "NOT_APPLICABLE");
        }

        Map<String, UUID> categoryIds = new HashMap<>();
        categoryRepository.findAll().forEach(category ->
            categoryIds.put(category.getCode().toUpperCase(Locale.ROOT), category.getId()));

        UUID fallbackCategoryId = categoryIds.get("OUTROS");
        int categorizedCount = 0;
        String modelVersion = "FALLBACK";

        for (int start = 0; start < transactions.size(); start += CLASSIFICATION_BATCH_SIZE) {
            int end = Math.min(start + CLASSIFICATION_BATCH_SIZE, transactions.size());
            List<Transaction> batch = transactions.subList(start, end);
            List<TransactionClassificationRequest.TransactionPayload> payload = batch.stream()
                .map(transaction -> new TransactionClassificationRequest.TransactionPayload(
                    transaction.getDescription(),
                    transaction.getAmount(),
                    transaction.getPaymentMethod(),
                    transaction.getRecurrent(),
                    transaction.getSource()))
                .toList();

            TransactionClassificationResult result = aiServiceClient.classifyTransactions(
                new TransactionClassificationRequest(payload));
            List<TransactionClassificationResult.Prediction> predictions =
                result != null ? result.predictions() : null;
            if (result != null && result.modelVersion() != null) {
                modelVersion = result.modelVersion();
            }

            for (int index = 0; index < batch.size(); index++) {
                Transaction transaction = batch.get(index);
                String predictedCode = predictions != null && index < predictions.size()
                    ? predictions.get(index).category()
                    : null;
                String categoryCode = resolveCategoryCode(transaction, predictedCode, categoryIds);
                transaction.setCategoryId(categoryIds.getOrDefault(categoryCode, fallbackCategoryId));
                if (!"OUTROS".equals(categoryCode)) {
                    categorizedCount++;
                }
            }
        }

        return new CategorizationResult(transactions.size(), categorizedCount, modelVersion);
    }

    private String resolveCategoryCode(Transaction transaction,
                                       String predictedCode,
                                       Map<String, UUID> categoryIds) {
        if (transaction.getType() == TransactionType.INCOME) {
            return "RENDA";
        }

        String normalizedPrediction = predictedCode == null
            ? ""
            : predictedCode.trim().toUpperCase(Locale.ROOT);
        if (!normalizedPrediction.isBlank()
            && !"OUTROS".equals(normalizedPrediction)
            && categoryIds.containsKey(normalizedPrediction)) {
            return normalizedPrediction;
        }

        String ruleBasedCategory = classifyByRules(transaction.getDescription());
        return categoryIds.containsKey(ruleBasedCategory) ? ruleBasedCategory : "OUTROS";
    }

    private String classifyByRules(String rawDescription) {
        String description = normalize(rawDescription);

        if (containsAny(description, "supermercado", "mercado", "restaurante", "padaria", "delivery", "comida", "lanche")) {
            return "ALIMENTACAO";
        }
        if (containsAny(description, "transporte", "uber", "combustivel", "gasolina", "estacionamento", "passagem aerea", "veiculo")) {
            return "TRANSPORTE";
        }
        if (containsAny(description, "farmacia", "drogaria", "medico", "saude", "academia", "veterinario")) {
            return "SAUDE";
        }
        if (containsAny(description, "aluguel", "condominio", "energia", "conta de agua", "moradia")) {
            return "MORADIA";
        }
        if (containsAny(description, "curso", "escola", "faculdade", "livraria", "educacao")) {
            return "EDUCACAO";
        }
        if (containsAny(description, "streaming", "netflix", "spotify", "cinema", "lazer", "viagem", "hospedagem")) {
            return "LAZER";
        }
        if (containsAny(description, "internet", "celular", "imposto", "taxa", "seguro")) {
            return "SERVICOS";
        }
        if (containsAny(description, "roupa", "eletronico", "pet shop", "compra")) {
            return "COMPRAS";
        }
        if (containsAny(description, "fatura", "divida", "emprestimo", "financiamento")) {
            return "DIVIDAS";
        }
        if (containsAny(description, "investimento", "aplicacao", "corretora")) {
            return "INVESTIMENTOS";
        }
        if (containsAny(description, "transferencia")) {
            return "TRANSFERENCIAS";
        }
        return "OUTROS";
    }

    private boolean containsAny(String value, String... terms) {
        for (String term : terms) {
            if (value.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
        return normalized.toLowerCase(Locale.ROOT);
    }

    public record CategorizationResult(
        int processedCount,
        int categorizedCount,
        String modelVersion
    ) {
    }
}
