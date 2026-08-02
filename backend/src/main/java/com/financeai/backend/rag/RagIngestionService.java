package com.financeai.backend.rag;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.fact.FinancialFactSnapshot;
import com.financeai.backend.fact.FinancialFactSnapshotRepository;
import com.financeai.backend.fact.FinancialFactsPayload;
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
    static final String FINANCIAL_OVERVIEW_CHUNK = "FINANCIAL_OVERVIEW";
    static final String MONTHLY_FACT_CHUNK = "MONTHLY_FACT";
    static final String CATEGORY_FACT_CHUNK = "CATEGORY_FACT";
    static final String FINANCIAL_RANKING_CHUNK = "FINANCIAL_RANKING";

    private static final Logger log = LoggerFactory.getLogger(RagIngestionService.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

    private final RagDocumentRepository ragDocumentRepository;
    private final AiServiceClient aiServiceClient;
    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final FinancialFactSnapshotRepository financialFactSnapshotRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    public RagIngestionService(RagDocumentRepository ragDocumentRepository,
                               AiServiceClient aiServiceClient,
                               TransactionRepository transactionRepository,
                               TransactionCategoryRepository categoryRepository,
                               FinancialFactSnapshotRepository financialFactSnapshotRepository,
                               ObjectMapper objectMapper,
                               ApplicationEventPublisher eventPublisher) {
        this.ragDocumentRepository = ragDocumentRepository;
        this.aiServiceClient = aiServiceClient;
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.financialFactSnapshotRepository = financialFactSnapshotRepository;
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
        documents.addAll(financialFactChunks(
            userId, sourceType, sourceId, effectiveSourceName));

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

    private List<RagDocument> financialFactChunks(UUID userId,
                                                   String sourceType,
                                                   String sourceId,
                                                   String sourceName) {
        if (sourceId == null || sourceId.isBlank()) {
            return List.of();
        }

        UUID normalizedSourceId;
        try {
            normalizedSourceId = UUID.fromString(sourceId);
        } catch (IllegalArgumentException exception) {
            log.debug("Origem RAG sem UUID; fatos financeiros não serão indexados: {}", sourceId);
            return List.of();
        }

        return financialFactSnapshotRepository.findByUserIdAndSourceId(userId, normalizedSourceId)
            .map(snapshot -> buildFinancialFactChunks(
                userId, sourceType, sourceId, sourceName, snapshot))
            .orElseGet(List::of);
    }

    private List<RagDocument> buildFinancialFactChunks(UUID userId,
                                                        String sourceType,
                                                        String sourceId,
                                                        String sourceName,
                                                        FinancialFactSnapshot snapshot) {
        FinancialFactsPayload facts = snapshot.getFacts();
        if (facts == null || facts.overview() == null) {
            return List.of();
        }

        List<RagDocument> documents = new ArrayList<>();
        documents.add(financialOverviewChunk(
            userId, sourceType, sourceId, sourceName, snapshot));
        facts.months().forEach(month -> documents.add(monthlyFactChunk(
            userId, sourceType, sourceId, sourceName, snapshot, month)));
        facts.categories().forEach(category -> documents.add(categoryFactChunk(
            userId, sourceType, sourceId, sourceName, snapshot, category)));
        if (facts.rankings() != null) {
            documents.add(financialRankingChunk(
                userId, sourceType, sourceId, sourceName, snapshot));
        }
        return documents;
    }

    private RagDocument financialOverviewChunk(UUID userId,
                                                String sourceType,
                                                String sourceId,
                                                String sourceName,
                                                FinancialFactSnapshot snapshot) {
        FinancialFactsPayload facts = snapshot.getFacts();
        FinancialFactsPayload.Overview overview = facts.overview();
        String content = (
            "Fatos financeiros consolidados da fonte %s no período de %s a %s. "
                + "Transações: %d, receitas: %d e despesas: %d. "
                + "Total de receitas: %s. Total de despesas: %s. Saldo: %s. "
                + "Receita média: %s e mediana: %s. "
                + "Despesa média: %s e mediana: %s. "
                + "Despesas recorrentes: %d, total recorrente: %s. "
                + "Despesas sem categoria: %d (%s%%)."
        ).formatted(
            sourceName,
            snapshot.getPeriodStart(),
            snapshot.getPeriodEnd(),
            overview.transactionCount(),
            overview.incomeCount(),
            overview.expenseCount(),
            currency(overview.totalIncome()),
            currency(overview.totalExpenses()),
            currency(overview.balance()),
            currency(overview.averageIncome()),
            currency(overview.medianIncome()),
            currency(overview.averageExpense()),
            currency(overview.medianExpense()),
            overview.recurringExpenseCount(),
            currency(overview.recurringExpenseTotal()),
            facts.dataQuality().uncategorizedExpenseCount(),
            facts.dataQuality().uncategorizedExpensePercentage()
        );

        Map<String, Object> metadata = factMetadata(
            sourceType, sourceId, sourceName, snapshot, FINANCIAL_OVERVIEW_CHUNK);
        metadata.put("transactionCount", overview.transactionCount());
        metadata.put("totalIncome", overview.totalIncome());
        metadata.put("totalExpenses", overview.totalExpenses());
        metadata.put("balance", overview.balance());
        return document(userId, sourceType, sourceId, null,
            FINANCIAL_OVERVIEW_CHUNK, content, metadata);
    }

    private RagDocument monthlyFactChunk(UUID userId,
                                         String sourceType,
                                         String sourceId,
                                         String sourceName,
                                         FinancialFactSnapshot snapshot,
                                         FinancialFactsPayload.MonthlyFact month) {
        String content = (
            "Fatos financeiros de %s na fonte %s. Transações: %d, receitas: %d "
                + "e despesas: %d. Total de receitas: %s. Total de despesas: %s. "
                + "Saldo: %s. Variação mensal das despesas: %s%%."
        ).formatted(
            periodLabel(month.period()),
            sourceName,
            month.transactionCount(),
            month.incomeCount(),
            month.expenseCount(),
            currency(month.totalIncome()),
            currency(month.totalExpenses()),
            currency(month.balance()),
            month.expenseVariationPercentage()
        );

        Map<String, Object> metadata = factMetadata(
            sourceType, sourceId, sourceName, snapshot, MONTHLY_FACT_CHUNK);
        metadata.put("period", month.period().toString());
        metadata.put("totalIncome", month.totalIncome());
        metadata.put("totalExpenses", month.totalExpenses());
        metadata.put("balance", month.balance());
        return document(userId, sourceType, sourceId, null,
            MONTHLY_FACT_CHUNK, content, metadata);
    }

    private RagDocument categoryFactChunk(UUID userId,
                                          String sourceType,
                                          String sourceId,
                                          String sourceName,
                                          FinancialFactSnapshot snapshot,
                                          FinancialFactsPayload.CategoryFact category) {
        String content = (
            "Fatos da categoria %s na fonte %s. Despesas: %s em %d transações, "
                + "representando %s%% do total. Média: %s, menor despesa: %s "
                + "e maior despesa: %s."
        ).formatted(
            category.name(),
            sourceName,
            currency(category.totalExpenses()),
            category.transactionCount(),
            category.percentage(),
            currency(category.averageExpense()),
            currency(category.minimumExpense()),
            currency(category.maximumExpense())
        );

        Map<String, Object> metadata = factMetadata(
            sourceType, sourceId, sourceName, snapshot, CATEGORY_FACT_CHUNK);
        metadata.put("categoryCode", category.code());
        metadata.put("categoryName", category.name());
        metadata.put("totalExpenses", category.totalExpenses());
        metadata.put("percentage", category.percentage());
        return document(userId, sourceType, sourceId, null,
            CATEGORY_FACT_CHUNK, content, metadata);
    }

    private RagDocument financialRankingChunk(UUID userId,
                                               String sourceType,
                                               String sourceId,
                                               String sourceName,
                                               FinancialFactSnapshot snapshot) {
        FinancialFactsPayload.Rankings rankings = snapshot.getFacts().rankings();
        String content = (
            "Rankings financeiros da fonte %s. Maior saldo mensal: %s. "
                + "Menor saldo mensal: %s. Maior despesa mensal: %s. "
                + "Menor despesa mensal: %s. Maiores despesas: %s. "
                + "Menores despesas: %s. Maiores receitas: %s. Menores receitas: %s."
        ).formatted(
            sourceName,
            monthlyRanking(rankings.highestBalanceMonth()),
            monthlyRanking(rankings.lowestBalanceMonth()),
            monthlyRanking(rankings.highestExpenseMonth()),
            monthlyRanking(rankings.lowestExpenseMonth()),
            transactionRanking(rankings.largestExpenses()),
            transactionRanking(rankings.smallestExpenses()),
            transactionRanking(rankings.largestIncomes()),
            transactionRanking(rankings.smallestIncomes())
        );

        Map<String, Object> metadata = factMetadata(
            sourceType, sourceId, sourceName, snapshot, FINANCIAL_RANKING_CHUNK);
        metadata.put("highestBalancePeriod", rankingPeriod(rankings.highestBalanceMonth()));
        metadata.put("lowestBalancePeriod", rankingPeriod(rankings.lowestBalanceMonth()));
        metadata.put("highestExpensePeriod", rankingPeriod(rankings.highestExpenseMonth()));
        metadata.put("lowestExpensePeriod", rankingPeriod(rankings.lowestExpenseMonth()));
        return document(userId, sourceType, sourceId, null,
            FINANCIAL_RANKING_CHUNK, content, metadata);
    }

    private Map<String, Object> factMetadata(String sourceType,
                                             String sourceId,
                                             String sourceName,
                                             FinancialFactSnapshot snapshot,
                                             String factType) {
        Map<String, Object> metadata = baseMetadata(sourceType, sourceId, sourceName);
        metadata.put("chunkType", factType);
        metadata.put("factSnapshotId", snapshot.getId());
        metadata.put("factSchemaVersion", snapshot.getSchemaVersion());
        metadata.put("periodStart", snapshot.getPeriodStart());
        metadata.put("periodEnd", snapshot.getPeriodEnd());
        return metadata;
    }

    private String monthlyRanking(FinancialFactsPayload.MonthlyFact month) {
        if (month == null) {
            return "não disponível";
        }
        return "%s, receitas %s, despesas %s e saldo %s".formatted(
            periodLabel(month.period()),
            currency(month.totalIncome()),
            currency(month.totalExpenses()),
            currency(month.balance()));
    }

    private String transactionRanking(List<FinancialFactsPayload.TransactionFact> transactions) {
        if (transactions == null || transactions.isEmpty()) {
            return "não disponível";
        }
        return transactions.stream()
            .limit(5)
            .map(transaction -> "%s em %s, %s".formatted(
                valueOrDefault(transaction.description(), "Sem descrição"),
                transaction.date(),
                currency(transaction.amount())))
            .collect(java.util.stream.Collectors.joining("; "));
    }

    private String rankingPeriod(FinancialFactsPayload.MonthlyFact month) {
        return month == null ? null : month.period().toString();
    }

    public int indexStep(UUID userId) {
        return indexStep(userId, List.of());
    }

    public int indexStep(UUID userId, List<String> sourceIds) {
        if (userId == null) {
            return 0;
        }
        try {
            int count = aiServiceClient.indexRagDocuments(
                userId.toString(), normalizedSourceIds(sourceIds));
            log.info("Indexação RAG concluída com {} vetores para o usuário {}", count, userId);
            return count;
        } catch (Exception exception) {
            log.warn("Falha na indexação RAG do usuário {}: {}", userId, exception.getMessage());
            return 0;
        }
    }

    public RagIndexStatusResponse indexStatus(UUID userId, List<String> sourceIds) {
        List<String> normalizedSources = normalizedSourceIds(sourceIds);
        long total = countDocuments(userId, normalizedSources, null);
        long pending = countDocuments(
            userId, normalizedSources, RagIndexStatus.PENDING);
        long processing = countDocuments(
            userId, normalizedSources, RagIndexStatus.PROCESSING);
        long indexed = countDocuments(
            userId, normalizedSources, RagIndexStatus.INDEXED);
        long failed = countDocuments(
            userId, normalizedSources, RagIndexStatus.FAILED);

        String status;
        if (total == 0) {
            status = "EMPTY";
        } else if (processing > 0) {
            status = "PROCESSING";
        } else if (pending > 0) {
            status = "PENDING";
        } else if (failed > 0) {
            status = "FAILED";
        } else if (indexed == total) {
            status = "COMPLETE";
        } else {
            status = "PENDING";
        }
        return new RagIndexStatusResponse(
            status, total, pending, processing, indexed, failed);
    }

    private long countDocuments(UUID userId,
                                List<String> sourceIds,
                                RagIndexStatus status) {
        if (sourceIds.isEmpty()) {
            return status == null
                ? ragDocumentRepository.countByUserId(userId)
                : ragDocumentRepository.countByUserIdAndIndexStatus(userId, status);
        }
        return status == null
            ? ragDocumentRepository.countByUserIdAndSourceIdIn(userId, sourceIds)
            : ragDocumentRepository.countByUserIdAndSourceIdInAndIndexStatus(
                userId, sourceIds, status);
    }

    private List<String> normalizedSourceIds(List<String> sourceIds) {
        if (sourceIds == null) {
            return List.of();
        }
        return sourceIds.stream()
            .filter(java.util.Objects::nonNull)
            .map(String::trim)
            .filter(sourceId -> !sourceId.isBlank())
            .distinct()
            .limit(100)
            .toList();
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
