package com.financeai.backend.transaction;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.importation.ImportedFileRepository;
import com.financeai.backend.integration.ai.*;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);

    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final AiServiceClient aiServiceClient;
    private final TransactionCategorizationService categorizationService;
    private final ImportedFileRepository importedFileRepository;
    private final FinancialSourceConsistencyService sourceConsistencyService;

    public TransactionService(TransactionRepository transactionRepository,
                              TransactionCategoryRepository categoryRepository,
                              UserRepository userRepository,
                              AiServiceClient aiServiceClient,
                              TransactionCategorizationService categorizationService,
                              ImportedFileRepository importedFileRepository,
                              FinancialSourceConsistencyService sourceConsistencyService) {
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.aiServiceClient = aiServiceClient;
        this.categorizationService = categorizationService;
        this.importedFileRepository = importedFileRepository;
        this.sourceConsistencyService = sourceConsistencyService;
    }

    @Transactional
    public TransactionClassificationResponse classifyTransactions(UUID userId, ClassifyTransactionsRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        List<TransactionClassificationRequest.TransactionPayload> payload = request.transactions().stream()
            .map(t -> new TransactionClassificationRequest.TransactionPayload(
                t.description(), t.amount(), t.paymentMethod(), t.recurrent(), t.source()))
            .toList();

        TransactionClassificationResult result = aiServiceClient.classifyTransactions(
            new TransactionClassificationRequest(payload));

        List<ClassifiedTransactionDto> classified = new ArrayList<>();
        String modelVersion = "FALLBACK";

        if (result != null && result.predictions() != null) {
            modelVersion = result.modelVersion() != null ? result.modelVersion() : "FALLBACK";
            List<TransactionClassificationResult.Prediction> items = result.predictions();
            for (int i = 0; i < items.size() && i < request.transactions().size(); i++) {
                TransactionDto original = request.transactions().get(i);
                TransactionClassificationResult.Prediction item = items.get(i);
                String code = item.category() != null ? item.category() : "OUTROS";
                classified.add(new ClassifiedTransactionDto(
                    null,
                    original.description(),
                    original.amount(),
                    original.date(),
                    original.type(),
                    code,
                    code,
                    item.confidence()
                ));
            }
        } else {
            for (TransactionDto t : request.transactions()) {
                classified.add(new ClassifiedTransactionDto(
                    null,
                    t.description(),
                    t.amount(),
                    t.date(),
                    t.type(),
                    classifyByRules(t),
                    null,
                    0.0
                ));
            }
        }

        return new TransactionClassificationResponse(classified, modelVersion);
    }

    private String classifyByRules(TransactionDto transaction) {
        String description = transaction.description().toLowerCase();
        if (description.contains("supermercado") || description.contains("mercado") || description.contains("restaurante") || description.contains("lanche")) {
            return "ALIMENTACAO";
        }
        if (description.contains("combustivel") || description.contains("gasolina") || description.contains("uber") || description.contains("transporte")) {
            return "TRANSPORTE";
        }
        if (description.contains("stream") || description.contains("netflix") || description.contains("cinema") || description.contains("lazer")) {
            return "LAZER";
        }
        if (description.contains("farmacia") || description.contains("medico") || description.contains("saude")) {
            return "SAUDE";
        }
        if (description.contains("aluguel") || description.contains("condominio")) {
            return "MORADIA";
        }
        return "OUTROS";
    }

    @Transactional(readOnly = true)
    public List<Transaction> findByUserId(UUID userId) {
        return transactionRepository.findByUserIdOrderByTransactionDateDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<Transaction> findByUserIdAndPeriod(UUID userId, LocalDate start, LocalDate end) {
        return transactionRepository.findByUserIdAndTransactionDateBetweenOrderByTransactionDateDesc(userId, start, end);
    }

    @Transactional(readOnly = true)
    public TransactionPageResponse getTransactions(UUID userId,
                                                   TransactionType type,
                                                   TransactionSource source,
                                                   UUID importSourceId,
                                                   String category,
                                                   LocalDate startDate,
                                                   LocalDate endDate,
                                                   int page,
                                                   int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        Pageable pageable = PageRequest.of(safePage, safeSize,
            Sort.by(Sort.Order.desc("transactionDate"), Sort.Order.desc("createdAt")));

        Specification<Transaction> specification = (root, query, criteriaBuilder) ->
            criteriaBuilder.equal(root.get("user").get("id"), userId);
        if (type != null) {
            specification = specification.and((root, query, criteriaBuilder) ->
                criteriaBuilder.equal(root.get("type"), type));
        }
        if (source != null) {
            specification = specification.and((root, query, criteriaBuilder) ->
                criteriaBuilder.equal(root.get("source"), source.name()));
        }
        if (importSourceId != null) {
            specification = specification.and((root, query, criteriaBuilder) ->
                criteriaBuilder.equal(root.get("importSourceId"), importSourceId));
        }
        if (startDate != null) {
            specification = specification.and((root, query, criteriaBuilder) ->
                criteriaBuilder.greaterThanOrEqualTo(root.get("transactionDate"), startDate));
        }
        if (endDate != null) {
            specification = specification.and((root, query, criteriaBuilder) ->
                criteriaBuilder.lessThanOrEqualTo(root.get("transactionDate"), endDate));
        }
        if (category != null && !category.isBlank()) {
            Optional<TransactionCategory> requestedCategory = categoryRepository.findByCode(
                category.trim().toUpperCase(Locale.ROOT));
            if (requestedCategory.isEmpty()) {
                return new TransactionPageResponse(List.of(), 0, 0, safeSize, safePage);
            }
            UUID categoryId = requestedCategory.get().getId();
            specification = specification.and((root, query, criteriaBuilder) ->
                criteriaBuilder.equal(root.get("categoryId"), categoryId));
        }

        Page<Transaction> resultPage = transactionRepository.findAll(specification, pageable);
        Map<UUID, String> categoryCodes = categoryRepository.findAll().stream()
            .collect(Collectors.toMap(TransactionCategory::getId, TransactionCategory::getCode));
        List<TransactionResponse> content = resultPage.getContent().stream()
            .map(transaction -> toResponse(transaction, categoryCodes))
            .toList();

        return new TransactionPageResponse(
            content,
            resultPage.getTotalElements(),
            resultPage.getTotalPages(),
            resultPage.getSize(),
            resultPage.getNumber());
    }

    @Transactional
    public TransactionReclassificationResponse reclassifyImportedTransactions(UUID userId) {
        userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("UsuÃ¡rio", userId));
        UUID othersCategoryId = categoryRepository.findByCode("OUTROS")
            .map(TransactionCategory::getId)
            .orElse(null);
        if (othersCategoryId == null) {
            return new TransactionReclassificationResponse(0, 0, "NOT_APPLICABLE");
        }

        List<Transaction> transactions = transactionRepository
            .findByUserIdAndSourceAndCategoryId(userId, "CSV_IMPORT", othersCategoryId);
        Set<UUID> affectedSourceIds = transactions.stream()
            .map(Transaction::getImportSourceId)
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        TransactionCategorizationService.CategorizationResult result =
            categorizationService.categorize(transactions);
        transactionRepository.saveAllAndFlush(transactions);
        affectedSourceIds.forEach(sourceId -> sourceConsistencyService.refresh(
            userId,
            TransactionSource.CSV_IMPORT,
            sourceId,
            importedFileRepository.findByIdAndUserId(sourceId, userId)
                .map(file -> file.getOriginalName())
                .orElse(sourceId.toString())));
        return new TransactionReclassificationResponse(
            result.processedCount(), result.categorizedCount(), result.modelVersion());
    }

    @Transactional(readOnly = true)
    public TransactionSummaryResponse getSummary(UUID userId,
                                                 TransactionSource source,
                                                 UUID importSourceId) {
        TransactionRepository.TotalsProjection totals = transactionRepository.summarize(
            userId, sourceName(source), sourceId(importSourceId));
        BigDecimal income = defaultAmount(totals.getTotalIncome());
        BigDecimal expense = defaultAmount(totals.getTotalExpense());
        return new TransactionSummaryResponse(income, expense, income.subtract(expense));
    }

    @Transactional(readOnly = true)
    public List<MonthlyTransactionSummaryResponse> getMonthlySummary(UUID userId,
                                                                     TransactionSource source,
                                                                     UUID importSourceId) {
        List<TransactionRepository.MonthlyTotalsProjection> rows =
            transactionRepository.summarizeByMonth(
                userId, sourceName(source), sourceId(importSourceId));
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<YearMonth, TransactionRepository.MonthlyTotalsProjection> totalsByMonth = rows.stream()
            .collect(Collectors.toMap(
                row -> YearMonth.parse(row.getMonthValue()),
                row -> row));
        YearMonth first = YearMonth.parse(rows.getFirst().getMonthValue());
        YearMonth last = YearMonth.parse(rows.getLast().getMonthValue());
        List<MonthlyTransactionSummaryResponse> result = new ArrayList<>();
        for (YearMonth month = first; !month.isAfter(last); month = month.plusMonths(1)) {
            TransactionRepository.MonthlyTotalsProjection row = totalsByMonth.get(month);
            BigDecimal income = row != null ? defaultAmount(row.getIncome()) : BigDecimal.ZERO;
            BigDecimal expense = row != null ? defaultAmount(row.getExpense()) : BigDecimal.ZERO;
            result.add(new MonthlyTransactionSummaryResponse(
                month, income, expense, income.subtract(expense)));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<CategorySpendingResponse> getCategorySummary(UUID userId,
                                                             TransactionSource source,
                                                             UUID importSourceId) {
        return transactionRepository.summarizeExpensesByCategory(
                userId, sourceName(source), sourceId(importSourceId)).stream()
            .map(row -> new CategorySpendingResponse(
                row.getCategoryCode(), defaultAmount(row.getAmount())))
            .toList();
    }

    private String sourceName(TransactionSource source) {
        return source != null ? source.name() : null;
    }

    private String sourceId(UUID importSourceId) {
        return importSourceId != null ? importSourceId.toString() : null;
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private TransactionResponse toResponse(Transaction transaction, Map<UUID, String> categoryCodes) {
        return new TransactionResponse(
            transaction.getId(),
            transaction.getDescription(),
            transaction.getAmount(),
            transaction.getTransactionDate(),
            transaction.getType(),
            transaction.getCategoryId() == null
                ? "OUTROS"
                : categoryCodes.getOrDefault(transaction.getCategoryId(), "OUTROS"),
            transaction.getSource(),
            transaction.getCreatedAt()
        );
    }

    private String categoryCodeOf(Transaction transaction) {
        if (transaction.getCategoryId() == null) {
            return "OUTROS";
        }
        return categoryRepository.findById(transaction.getCategoryId())
            .map(TransactionCategory::getCode)
            .orElse("OUTROS");
    }
}
