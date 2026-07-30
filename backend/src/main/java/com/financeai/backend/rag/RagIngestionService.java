package com.financeai.backend.rag;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.NumberFormat;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class RagIngestionService {

    static final String TRANSACTION_CHUNK = "TRANSACTION";
    static final String MONTHLY_SUMMARY_CHUNK = "MONTHLY_SUMMARY";
    static final String CATEGORY_SUMMARY_CHUNK = "CATEGORY_SUMMARY";

    private static final Logger log = LoggerFactory.getLogger(RagIngestionService.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

    private final RagDocumentRepository ragDocumentRepository;
    private final AiServiceClient aiServiceClient;
    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    public RagIngestionService(RagDocumentRepository ragDocumentRepository,
                               AiServiceClient aiServiceClient,
                               TransactionRepository transactionRepository,
                               TransactionCategoryRepository categoryRepository,
                               ObjectMapper objectMapper,
                               ApplicationEventPublisher eventPublisher) {
        this.ragDocumentRepository = ragDocumentRepository;
        this.aiServiceClient = aiServiceClient;
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void ingestTransactions(UUID userId,
                                   String sourceType,
                                   String sourceId,
                                   List<Transaction> transactions) {
        ingestTransactions(userId, sourceType, sourceId, sourceId, transactions);
    }

    @Transactional
    public void ingestTransactions(UUID userId,
                                   String sourceType,
                                   String sourceId,
                                   String sourceName,
                                   List<Transaction> transactions) {
        if (transactions == null || transactions.isEmpty()) {
            return;
        }

        log.info("Ingestando {} transações no RAG do usuário {} (origem: {}, id: {})",
            transactions.size(), userId, sourceType, sourceId);

        Set<UUID> indexedTransactionIds = sourceId != null && !sourceId.isBlank()
            ? ragDocumentRepository.findTransactionIdsBySource(userId, sourceType, sourceId)
            : Set.of();
        Map<UUID, String> categories = categoryNames();
        List<RagDocument> documents = new ArrayList<>();
        String effectiveSourceName = valueOrDefault(
            sourceName, valueOrDefault(sourceId, "Fonte importada"));

        for (Transaction transaction : transactions) {
            if (transaction.getId() != null && indexedTransactionIds.contains(transaction.getId())) {
                continue;
            }
            documents.add(transactionChunk(
                userId, sourceType, sourceId, effectiveSourceName, transaction, categories));
        }

        List<Transaction> sourceTransactions = loadSourceTransactions(
            userId, sourceType, sourceId, transactions);
        if (sourceId != null && !sourceId.isBlank()) {
            ragDocumentRepository.deleteDerivedChunks(
                userId, sourceType, sourceId, TRANSACTION_CHUNK);
        }
        documents.addAll(summaryChunks(
            userId, sourceType, sourceId, effectiveSourceName, sourceTransactions, categories));

        if (!documents.isEmpty()) {
            ragDocumentRepository.saveAll(documents);
        }

        if (!documents.isEmpty()) {
            List<String> sourceIds = sourceId == null || sourceId.isBlank()
                ? List.of()
                : List.of(sourceId);
            eventPublisher.publishEvent(new RagIndexRequestedEvent(userId, sourceIds));
        }
        log.info("ETL RAG concluído com {} chunks para o usuário {}", documents.size(), userId);
    }

    public int indexStep(UUID userId) {
        if (userId == null) {
            return 0;
        }
        try {
            int count = aiServiceClient.indexRagDocuments(userId.toString(), List.of());
            log.info("Indexação RAG concluída com {} vetores para o usuário {}", count, userId);
            return count;
        } catch (Exception exception) {
            log.warn("Falha na indexação RAG do usuário {}: {}", userId, exception.getMessage());
            return 0;
        }
    }

    private List<Transaction> loadSourceTransactions(UUID userId,
                                                     String sourceType,
                                                     String sourceId,
                                                     List<Transaction> fallback) {
        if (sourceId == null || sourceId.isBlank()) {
            return fallback;
        }
        try {
            UUID importSourceId = UUID.fromString(sourceId);
            return transactionRepository
                .findByUserIdAndImportSourceIdOrderByTransactionDateDesc(userId, importSourceId);
        } catch (IllegalArgumentException exception) {
            log.debug("Origem RAG sem UUID; usando lote atual: {}", sourceId);
            return fallback;
        }
    }

    private RagDocument transactionChunk(UUID userId,
                                         String sourceType,
                                         String sourceId,
                                         String sourceName,
                                         Transaction transaction,
                                         Map<UUID, String> categories) {
        String date = transaction.getTransactionDate() != null
            ? transaction.getTransactionDate().format(DATE_FORMATTER)
            : "não informada";
        String type = transaction.getType() == TransactionType.EXPENSE ? "despesa" : "receita";
        String category = categoryLabel(transaction.getCategoryId(), categories);
        String description = valueOrDefault(transaction.getDescription(), "Sem descrição");
        String paymentMethod = valueOrDefault(transaction.getPaymentMethod(), "não informado");
        String content = (
            "Transação financeira. Tipo: %s. Data: %s. Descrição: %s. "
                + "Valor: %s. Categoria: %s. Forma de pagamento: %s. Fonte: %s."
        ).formatted(type, date, description, currency(transaction.getAmount()), category,
            paymentMethod, sourceName);

        Map<String, Object> metadata = baseMetadata(sourceType, sourceId, sourceName);
        metadata.put("transactionId", transaction.getId());
        metadata.put("chunkType", TRANSACTION_CHUNK);
        metadata.put("amount", transaction.getAmount());
        metadata.put("type", transaction.getType());
        metadata.put("date", transaction.getTransactionDate());
        metadata.put("category", category);
        metadata.put("description", description);

        return document(userId, sourceType, sourceId, transaction.getId(),
            TRANSACTION_CHUNK, content, metadata);
    }

    private List<RagDocument> summaryChunks(UUID userId,
                                            String sourceType,
                                            String sourceId,
                                            String sourceName,
                                            List<Transaction> transactions,
                                            Map<UUID, String> categories) {
        Map<YearMonth, List<Transaction>> byMonth = new LinkedHashMap<>();
        transactions.stream()
            .filter(transaction -> transaction.getTransactionDate() != null)
            .sorted(Comparator.comparing(Transaction::getTransactionDate))
            .forEach(transaction -> byMonth.computeIfAbsent(
                YearMonth.from(transaction.getTransactionDate()), ignored -> new ArrayList<>())
                .add(transaction));

        List<RagDocument> documents = new ArrayList<>();
        byMonth.forEach((month, monthlyTransactions) -> {
            documents.add(monthlySummary(
                userId, sourceType, sourceId, sourceName, month, monthlyTransactions));

            Map<String, List<Transaction>> byCategory = new LinkedHashMap<>();
            monthlyTransactions.forEach(transaction -> byCategory
                .computeIfAbsent(categoryLabel(transaction.getCategoryId(), categories),
                    ignored -> new ArrayList<>())
                .add(transaction));
            byCategory.forEach((category, categoryTransactions) ->
                documents.add(categorySummary(
                    userId, sourceType, sourceId, sourceName, month, category,
                    categoryTransactions)));
        });
        return documents;
    }

    private RagDocument monthlySummary(UUID userId,
                                       String sourceType,
                                       String sourceId,
                                       String sourceName,
                                       YearMonth month,
                                       List<Transaction> transactions) {
        BigDecimal income = total(transactions, TransactionType.INCOME);
        BigDecimal expenses = total(transactions, TransactionType.EXPENSE);
        BigDecimal balance = income.subtract(expenses);
        String period = periodLabel(month);
        String content = (
            "Resumo financeiro de %s na fonte %s. Receitas: %s. Despesas: %s. "
                + "Saldo: %s. Quantidade de transações: %d."
        ).formatted(period, sourceName, currency(income), currency(expenses),
            currency(balance), transactions.size());

        Map<String, Object> metadata = baseMetadata(sourceType, sourceId, sourceName);
        metadata.put("chunkType", MONTHLY_SUMMARY_CHUNK);
        metadata.put("period", month.toString());
        metadata.put("income", income);
        metadata.put("expenses", expenses);
        metadata.put("balance", balance);
        metadata.put("transactionCount", transactions.size());
        return document(userId, sourceType, sourceId, null,
            MONTHLY_SUMMARY_CHUNK, content, metadata);
    }

    private RagDocument categorySummary(UUID userId,
                                        String sourceType,
                                        String sourceId,
                                        String sourceName,
                                        YearMonth month,
                                        String category,
                                        List<Transaction> transactions) {
        BigDecimal income = total(transactions, TransactionType.INCOME);
        BigDecimal expenses = total(transactions, TransactionType.EXPENSE);
        String period = periodLabel(month);
        String content = (
            "Resumo da categoria %s em %s na fonte %s. Receitas: %s. "
                + "Despesas: %s. Quantidade de transações: %d."
        ).formatted(category, period, sourceName, currency(income), currency(expenses),
            transactions.size());

        Map<String, Object> metadata = baseMetadata(sourceType, sourceId, sourceName);
        metadata.put("chunkType", CATEGORY_SUMMARY_CHUNK);
        metadata.put("period", month.toString());
        metadata.put("category", category);
        metadata.put("income", income);
        metadata.put("expenses", expenses);
        metadata.put("transactionCount", transactions.size());
        return document(userId, sourceType, sourceId, null,
            CATEGORY_SUMMARY_CHUNK, content, metadata);
    }

    private RagDocument document(UUID userId,
                                 String sourceType,
                                 String sourceId,
                                 UUID transactionId,
                                 String chunkType,
                                 String content,
                                 Map<String, Object> metadata) {
        RagDocument document = new RagDocument();
        document.setUserId(userId);
        document.setSourceType(sourceType);
        document.setSourceId(sourceId);
        document.setTransactionId(transactionId);
        document.setChunkType(chunkType);
        document.setDocumentChunk(content);
        document.setContentHash(sha256(content));
        document.setMetadata(json(metadata));
        return document;
    }

    private Map<String, Object> baseMetadata(String sourceType,
                                             String sourceId,
                                             String sourceName) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("source", sourceType);
        metadata.put("sourceId", sourceId);
        metadata.put("sourceName", valueOrDefault(sourceName, sourceId));
        return metadata;
    }

    private Map<UUID, String> categoryNames() {
        Map<UUID, String> categories = new HashMap<>();
        for (TransactionCategory category : categoryRepository.findAll()) {
            categories.put(category.getId(), category.getName());
        }
        return categories;
    }

    private String categoryLabel(UUID categoryId, Map<UUID, String> categories) {
        if (categoryId == null) {
            return "Sem categoria";
        }
        return categories.getOrDefault(categoryId, "Categoria " + categoryId);
    }

    private BigDecimal total(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
            .filter(transaction -> transaction.getType() == type)
            .map(Transaction::getAmount)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String currency(BigDecimal value) {
        return NumberFormat.getCurrencyInstance(PT_BR)
            .format(value != null ? value : BigDecimal.ZERO);
    }

    private String periodLabel(YearMonth month) {
        return month.getMonth().getDisplayName(TextStyle.FULL, PT_BR)
            + " de " + month.getYear();
    }

    private String json(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Falha ao serializar metadados RAG", exception);
        }
    }

    private String sha256(String content) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não disponível", exception);
        }
    }

    private String valueOrDefault(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
