package com.financeai.backend.analysis;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.indicator.FinancialIndicator;
import com.financeai.backend.indicator.FinancialIndicatorRepository;
import com.financeai.backend.indicator.SpendingSummary;
import com.financeai.backend.indicator.SpendingSummaryRepository;
import com.financeai.backend.integration.ai.*;
import com.financeai.backend.recommendation.Recommendation;
import com.financeai.backend.recommendation.RecommendationDto;
import com.financeai.backend.recommendation.RecommendationEngine;
import com.financeai.backend.recommendation.RecommendationRepository;
import com.financeai.backend.transaction.*;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalysisService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisService.class);
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);
    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

    private final FinancialAnalysisRepository analysisRepository;
    private final FinancialIndicatorRepository indicatorRepository;
    private final SpendingSummaryRepository spendingSummaryRepository;
    private final RecommendationRepository recommendationRepository;
    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final AiServiceClient aiServiceClient;
    private final RecommendationEngine recommendationEngine;
    private final TransactionOperations transactionOperations;

    public AnalysisService(FinancialAnalysisRepository analysisRepository,
                           FinancialIndicatorRepository indicatorRepository,
                           SpendingSummaryRepository spendingSummaryRepository,
                           RecommendationRepository recommendationRepository,
                           TransactionRepository transactionRepository,
                           TransactionCategoryRepository categoryRepository,
                           UserRepository userRepository,
                           AiServiceClient aiServiceClient,
                           RecommendationEngine recommendationEngine,
                           TransactionOperations transactionOperations) {
        this.analysisRepository = analysisRepository;
        this.indicatorRepository = indicatorRepository;
        this.spendingSummaryRepository = spendingSummaryRepository;
        this.recommendationRepository = recommendationRepository;
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.aiServiceClient = aiServiceClient;
        this.recommendationEngine = recommendationEngine;
        this.transactionOperations = transactionOperations;
    }

    public AnalysisResponse createAnalysis(UUID userId, CreateAnalysisRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        List<Transaction> classifiedTransactions = classifyTransactions(user, request.transactions());

        Map<String, BigDecimal> spendingByCategory = calculateSpendingByCategory(classifiedTransactions);
        BigDecimal totalExpenses = spendingByCategory.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal monthlyIncome = request.monthlyIncome();
        BigDecimal debtLevelPercentage = request.debtLevelPercentage();
        BigDecimal financialReserve = request.financialReserve();

        FinancialIndicator indicator = calculateIndicators(
            monthlyIncome, totalExpenses, debtLevelPercentage, financialReserve,
            spendingByCategory, classifiedTransactions, request.savingFrequency());

        ProfileAnalysisResult profileResult = callProfileAnalysis(
            ProfileAnalysisModel.MACHINE_LEARNING,
            monthlyIncome,
            debtLevelPercentage,
            request.savingFrequency(),
            financialReserve,
            indicator,
            (int) classifiedTransactions.stream().filter(t -> t.getType() == TransactionType.EXPENSE).count()
        );

        Map<String, String> modelVersions = buildModelVersions(profileResult);

        return Objects.requireNonNull(transactionOperations.execute(status -> {
            User managedUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));
            classifiedTransactions.forEach(transaction -> transaction.setUser(managedUser));
            transactionRepository.saveAll(classifiedTransactions);
            return persistAnalysis(
                managedUser,
                currentPeriod(),
                profileResult,
                indicator,
                totalExpenses,
                spendingByCategory,
                toClassifiedDtos(classifiedTransactions, spendingByCategory),
                modelVersions);
        }));
    }

    public AnalysisResponse analyzeStoredTransactions(UUID userId,
                                                      ProfileAnalysisModel model,
                                                      TransactionSource source,
                                                      UUID importSourceId,
                                                      LocalDate startDate,
                                                      LocalDate endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new BusinessException("INVALID_PERIOD", "A data inicial não pode ser posterior à data final");
        }

        userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        List<Transaction> transactions;
        if (importSourceId != null) {
            transactions = transactionRepository
                .findByUserIdAndImportSourceIdOrderByTransactionDateDesc(userId, importSourceId)
                .stream()
                .filter(transaction -> source.name().equals(transaction.getSource()))
                .filter(transaction -> startDate == null
                    || !transaction.getTransactionDate().isBefore(startDate))
                .filter(transaction -> endDate == null
                    || !transaction.getTransactionDate().isAfter(endDate))
                .toList();
        } else if (startDate != null || endDate != null) {
            LocalDate effectiveStart = startDate != null ? startDate : LocalDate.of(1970, 1, 1);
            LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now();
            transactions = transactionRepository
                .findByUserIdAndSourceAndTransactionDateBetweenOrderByTransactionDateDesc(
                    userId, source.name(), effectiveStart, effectiveEnd);
        } else {
            transactions = transactionRepository
                .findByUserIdAndSourceOrderByTransactionDateDesc(userId, source.name());
        }

        if (transactions.isEmpty()) {
            throw new BusinessException(
                "NO_TRANSACTIONS",
                "Importe transações por CSV ou Open Finance antes de gerar a análise");
        }

        LocalDate oldestDate = transactions.stream()
            .map(Transaction::getTransactionDate)
            .min(LocalDate::compareTo)
            .orElseThrow();
        LocalDate newestDate = transactions.stream()
            .map(Transaction::getTransactionDate)
            .max(LocalDate::compareTo)
            .orElseThrow();
        YearMonth firstMonth = YearMonth.from(oldestDate);
        YearMonth lastMonth = YearMonth.from(newestDate);
        int monthCount = Math.max(1, (int) ChronoUnit.MONTHS.between(firstMonth, lastMonth) + 1);
        BigDecimal monthDivisor = BigDecimal.valueOf(monthCount);

        BigDecimal totalIncome = sumByType(transactions, TransactionType.INCOME);
        BigDecimal totalExpenses = sumByType(transactions, TransactionType.EXPENSE);
        BigDecimal monthlyIncome = totalIncome.divide(monthDivisor, SCALE, ROUNDING);
        BigDecimal monthlyExpenses = totalExpenses.divide(monthDivisor, SCALE, ROUNDING);
        if (monthlyIncome.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(
                "NO_INCOME_TRANSACTIONS",
                "Não há transações de receita suficientes para calcular o perfil financeiro");
        }

        Map<String, BigDecimal> spendingByCategory = calculateSpendingByCategory(transactions)
            .entrySet().stream()
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                entry -> entry.getValue().divide(monthDivisor, SCALE, ROUNDING)
            ));

        BigDecimal debtExpenses = spendingByCategory.getOrDefault("DIVIDAS", BigDecimal.ZERO);
        BigDecimal debtLevelPercentage = safePercentage(debtExpenses, monthlyIncome)
            .min(ONE_HUNDRED);
        BigDecimal estimatedReserve = totalIncome.subtract(totalExpenses).max(BigDecimal.ZERO);
        String savingFrequency = deriveSavingFrequency(transactions, firstMonth, lastMonth);

        FinancialIndicator indicator = calculateIndicators(
            monthlyIncome,
            monthlyExpenses,
            debtLevelPercentage,
            estimatedReserve,
            spendingByCategory,
            transactions,
            savingFrequency
        );
        indicator.setRecurringExpensesCount((int) Math.round(
            transactions.stream().filter(t -> Boolean.TRUE.equals(t.getRecurrent())).count()
                / (double) monthCount));
        indicator.setVariationPercentage(calculateExpenseVariation(transactions, firstMonth, lastMonth));

        int averageExpenseCount = (int) Math.round(
            transactions.stream().filter(t -> t.getType() == TransactionType.EXPENSE).count()
                / (double) monthCount);
        ProfileAnalysisResult profileResult = callProfileAnalysis(
            model,
            monthlyIncome,
            debtLevelPercentage,
            savingFrequency,
            estimatedReserve,
            indicator,
            averageExpenseCount
        );

        Map<String, String> modelVersions = buildModelVersions(profileResult);
        modelVersions.put("transactionClassifier", "PERSISTED_CATEGORIES");
        modelVersions.put("analysisModel", model.name());
        modelVersions.put("transactionSource", source.name());
        if (importSourceId != null) {
            modelVersions.put("importSourceId", importSourceId.toString());
        }

        return Objects.requireNonNull(transactionOperations.execute(status -> {
            User managedUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));
            return persistAnalysis(
                managedUser,
                firstMonth + ".." + lastMonth,
                profileResult,
                indicator,
                monthlyExpenses,
                spendingByCategory,
                Collections.emptyList(),
                modelVersions);
        }));
    }

    @Transactional(readOnly = true)
    public AnalysisResponse getAnalysis(UUID userId, UUID analysisId) {
        FinancialAnalysis analysis = analysisRepository.findByIdAndUserId(analysisId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Análise", analysisId));

        FinancialIndicator indicator = indicatorRepository.findByAnalysisId(analysisId)
            .orElseThrow(() -> new ResourceNotFoundException("Indicadores", analysisId));

        List<SpendingSummary> summaries = spendingSummaryRepository.findByAnalysisId(analysisId);
        Map<String, BigDecimal> spendingByCategory = summaries.stream()
            .collect(Collectors.toMap(SpendingSummary::getCategoryCode, SpendingSummary::getAmount));

        List<Recommendation> recommendations = recommendationRepository.findByAnalysisIdOrderByPriorityDesc(analysisId);

        Map<String, String> modelVersions = analysis.getModelVersions() != null
            ? new HashMap<>(analysis.getModelVersions())
            : Collections.emptyMap();

        return buildResponse(analysis, indicator, spendingByCategory,
            Collections.emptyList(), recommendations, modelVersions);
    }

    @Transactional(readOnly = true)
    public AnalysisResponse getLatestAnalysis(UUID userId,
                                              TransactionSource source,
                                              UUID importSourceId) {
        return analysisRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .filter(analysis -> source == null || hasSource(analysis, source))
            .filter(analysis -> importSourceId == null || hasImportSource(analysis, importSourceId))
            .findFirst()
            .map(analysis -> getAnalysis(userId, analysis.getId()))
            .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<AnalysisResponse> getAnalyses(UUID userId, TransactionSource source) {
        return analysisRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .filter(analysis -> source == null || hasSource(analysis, source))
            .map(analysis -> getAnalysis(userId, analysis.getId()))
            .toList();
    }

    private boolean hasSource(FinancialAnalysis analysis, TransactionSource source) {
        return analysis.getModelVersions() != null
            && source.name().equals(analysis.getModelVersions().get("transactionSource"));
    }

    private boolean hasImportSource(FinancialAnalysis analysis, UUID importSourceId) {
        return analysis.getModelVersions() != null
            && importSourceId.toString().equals(
                analysis.getModelVersions().get("importSourceId"));
    }

    private List<Transaction> classifyTransactions(User user, List<TransactionDto> transactionDtos) {
        List<TransactionClassificationRequest.TransactionPayload> payload = transactionDtos.stream()
            .map(t -> new TransactionClassificationRequest.TransactionPayload(
                t.description(), t.amount(), t.paymentMethod(), t.recurrent(), t.source()))
            .toList();

        TransactionClassificationResult classificationResult = aiServiceClient.classifyTransactions(
            new TransactionClassificationRequest(payload));

        List<Transaction> transactions = new ArrayList<>();
        for (int i = 0; i < transactionDtos.size(); i++) {
            TransactionDto dto = transactionDtos.get(i);
            Transaction transaction = new Transaction();
            transaction.setUser(user);
            transaction.setDescription(dto.description());
            transaction.setAmount(dto.amount());
            transaction.setTransactionDate(dto.date());
            transaction.setType(dto.type());
            transaction.setPaymentMethod(dto.paymentMethod());
            transaction.setRecurrent(dto.recurrent() != null ? dto.recurrent() : false);
            transaction.setSource("ANALYSIS");

            String categoryCode = resolveCategoryCode(classificationResult, i, dto);
            categoryRepository.findByCode(categoryCode)
                .ifPresent(cat -> transaction.setCategoryId(cat.getId()));

            transactions.add(transaction);
        }
        return transactions;
    }

    private AnalysisResponse persistAnalysis(User user,
                                             String analysisPeriod,
                                             ProfileAnalysisResult profileResult,
                                             FinancialIndicator indicator,
                                             BigDecimal summaryTotal,
                                             Map<String, BigDecimal> spendingByCategory,
                                             List<ClassifiedTransactionDto> classifiedTransactions,
                                             Map<String, String> modelVersions) {
        FinancialAnalysis analysis = new FinancialAnalysis();
        analysis.setUser(user);
        analysis.setAnalysisPeriod(analysisPeriod);
        analysis.setProfileClassification(profileResult.classification());
        analysis.setScore(profileResult.score());
        analysis.setConfidence(profileResult.confidence());
        analysis.setModelVersions(modelVersions);
        analysis = analysisRepository.save(analysis);

        indicator.setAnalysis(analysis);
        indicatorRepository.save(indicator);
        spendingSummaryRepository.saveAll(
            buildSpendingSummaries(analysis, summaryTotal, spendingByCategory));
        List<Recommendation> recommendations =
            recommendationEngine.generateRecommendations(analysis, indicator);
        recommendationRepository.saveAll(recommendations);

        return buildResponse(
            analysis,
            indicator,
            spendingByCategory,
            classifiedTransactions,
            recommendations,
            modelVersions);
    }

    private String resolveCategoryCode(TransactionClassificationResult result, int index, TransactionDto dto) {
        if (result != null && result.predictions() != null
            && index < result.predictions().size()) {
            String code = result.predictions().get(index).category();
            if (code != null && !code.isBlank()) {
                return code.toUpperCase();
            }
        }
        return fallbackCategoryCode(dto.description());
    }

    private String fallbackCategoryCode(String description) {
        String desc = description.toLowerCase();
        if (desc.contains("supermercado") || desc.contains("mercado") || desc.contains("restaurante")) {
            return "ALIMENTACAO";
        }
        if (desc.contains("combustivel") || desc.contains("gasolina") || desc.contains("uber")) {
            return "TRANSPORTE";
        }
        if (desc.contains("stream") || desc.contains("netflix") || desc.contains("cinema")) {
            return "LAZER";
        }
        return "OUTROS";
    }

    private Map<String, BigDecimal> calculateSpendingByCategory(List<Transaction> transactions) {
        return transactions.stream()
            .filter(t -> t.getType() == TransactionType.EXPENSE)
            .collect(Collectors.groupingBy(
                this::categoryCodeOf,
                Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
            ));
    }

    private String categoryCodeOf(Transaction transaction) {
        if (transaction.getCategoryId() == null) {
            return "OUTROS";
        }
        return categoryRepository.findById(transaction.getCategoryId())
            .map(TransactionCategory::getCode)
            .orElse("OUTROS");
    }

    private FinancialIndicator calculateIndicators(BigDecimal monthlyIncome,
                                                   BigDecimal totalExpenses,
                                                   BigDecimal debtLevelPercentage,
                                                   BigDecimal financialReserve,
                                                   Map<String, BigDecimal> spendingByCategory,
                                                   List<Transaction> transactions,
                                                   String savingFrequency) {
        FinancialIndicator indicator = new FinancialIndicator();
        indicator.setMonthlyIncome(monthlyIncome);
        indicator.setTotalIncome(monthlyIncome);
        indicator.setTotalExpenses(totalExpenses);
        indicator.setMonthlyBalance(monthlyIncome.subtract(totalExpenses));

        indicator.setIncomeCommitmentPercentage(
            safePercentage(totalExpenses, monthlyIncome));
        indicator.setDebtLevelPercentage(debtLevelPercentage);

        BigDecimal savingsRate = calculateEstimatedSavingsRate(monthlyIncome, totalExpenses, savingFrequency);
        indicator.setSavingsRatePercentage(savingsRate);

        BigDecimal fixedExpenses = spendingByCategory.getOrDefault("MORADIA", BigDecimal.ZERO)
            .add(spendingByCategory.getOrDefault("DIVIDAS", BigDecimal.ZERO))
            .add(spendingByCategory.getOrDefault("SAUDE", BigDecimal.ZERO));
        indicator.setFixedExpensesPercentage(safePercentage(fixedExpenses, totalExpenses));

        BigDecimal nonEssential = spendingByCategory.getOrDefault("LAZER", BigDecimal.ZERO)
            .add(spendingByCategory.getOrDefault("COMPRAS", BigDecimal.ZERO))
            .add(spendingByCategory.getOrDefault("SERVICOS", BigDecimal.ZERO));
        indicator.setNonEssentialExpensesPercentage(safePercentage(nonEssential, totalExpenses));

        long recurringCount = transactions.stream()
            .filter(t -> Boolean.TRUE.equals(t.getRecurrent()))
            .count();
        indicator.setRecurringExpensesCount((int) recurringCount);

        indicator.setTopCategory(spendingByCategory.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("OUTROS"));

        indicator.setVariationPercentage(BigDecimal.ZERO);
        indicator.setReserveInMonths(safeDivide(financialReserve, totalExpenses));

        return indicator;
    }

    private BigDecimal calculateEstimatedSavingsRate(BigDecimal monthlyIncome,
                                                     BigDecimal totalExpenses,
                                                     String savingFrequency) {
        BigDecimal baseRate = safePercentage(monthlyIncome.subtract(totalExpenses), monthlyIncome);
        BigDecimal frequencyFactor = switch (SavingFrequency.valueOf(savingFrequency)) {
            case LOW -> BigDecimal.valueOf(-2);
            case MEDIUM -> BigDecimal.ZERO;
            case HIGH -> BigDecimal.valueOf(2);
        };
        return baseRate.add(frequencyFactor).max(BigDecimal.ZERO).setScale(SCALE, ROUNDING);
    }

    private ProfileAnalysisResult callProfileAnalysis(ProfileAnalysisModel model,
                                                      BigDecimal monthlyIncome,
                                                      BigDecimal debtLevelPercentage,
                                                      String savingFrequency,
                                                      BigDecimal financialReserve,
                                                      FinancialIndicator indicator,
                                                      Integer transactionsExpenseCount) {
        ProfileAnalysisRequest.ProfileIndicators profileIndicators =
            new ProfileAnalysisRequest.ProfileIndicators(
                indicator.getIncomeCommitmentPercentage(),
                indicator.getSavingsRatePercentage(),
                indicator.getFixedExpensesPercentage(),
                indicator.getNonEssentialExpensesPercentage(),
                indicator.getRecurringExpensesCount(),
                transactionsExpenseCount,
                indicator.getVariationPercentage(),
                indicator.getReserveInMonths()
            );
        ProfileAnalysisRequest request = new ProfileAnalysisRequest(
            model.name(), monthlyIncome, debtLevelPercentage, savingFrequency, financialReserve, profileIndicators);

        ProfileAnalysisResult result = aiServiceClient.analyzeProfile(request);
        if (result == null) {
            return fallbackProfileResult();
        }
        return result;
    }

    private ProfileAnalysisResult fallbackProfileResult() {
        return new ProfileAnalysisResult(
            "EM_OBSERVACAO",
            BigDecimal.valueOf(62.00),
            BigDecimal.valueOf(0.82),
            List.of("Nível de endividamento moderado", "Baixa frequência de poupança"),
            "FALLBACK",
            "ai-service indisponível"
        );
    }

    private Map<String, String> buildModelVersions(ProfileAnalysisResult profileResult) {
        Map<String, String> versions = new HashMap<>();
        versions.put("transactionClassifier", "FALLBACK");
        versions.put("profileClassifier", profileResult.modelVersion() != null
            ? profileResult.modelVersion() : "FALLBACK");
        return versions;
    }

    private List<SpendingSummary> buildSpendingSummaries(FinancialAnalysis analysis,
                                                         BigDecimal totalExpenses,
                                                         Map<String, BigDecimal> spendingByCategory) {
        return spendingByCategory.entrySet().stream()
            .map(entry -> {
                SpendingSummary summary = new SpendingSummary();
                summary.setAnalysis(analysis);
                summary.setCategoryCode(entry.getKey());
                summary.setAmount(entry.getValue());
                summary.setPercentage(safePercentage(entry.getValue(), totalExpenses));
                return summary;
            })
            .toList();
    }

    private AnalysisResponse buildResponse(FinancialAnalysis analysis,
                                           FinancialIndicator indicator,
                                           Map<String, BigDecimal> spendingByCategory,
                                           List<ClassifiedTransactionDto> classifiedTransactions,
                                           List<Recommendation> recommendations,
                                           Map<String, String> modelVersions) {
        Map<String, AnalysisResponse.CategorySummaryDto> summaryDto = spendingByCategory.entrySet().stream()
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                e -> new AnalysisResponse.CategorySummaryDto(
                    e.getValue(),
                    safePercentage(e.getValue(), indicator.getTotalExpenses()))
            ));

        FinancialProfileDto profile = new FinancialProfileDto(
            analysis.getProfileClassification(),
            analysis.getScore(),
            analysis.getConfidence(),
            Collections.emptyList()
        );

        IndicatorDto indicators = new IndicatorDto(
            indicator.getMonthlyIncome(),
            indicator.getTotalExpenses(),
            indicator.getIncomeCommitmentPercentage(),
            indicator.getDebtLevelPercentage(),
            indicator.getSavingsRatePercentage(),
            indicator.getRecurringExpensesCount(),
            indicator.getFixedExpensesPercentage(),
            indicator.getNonEssentialExpensesPercentage(),
            indicator.getReserveInMonths()
        );

        List<RecommendationDto> recommendationDtos = recommendations.stream()
            .map(r -> new RecommendationDto(
                r.getId(), r.getTitle(), r.getDescription(), r.getReason(),
                r.getPriority(), r.getCategory(), r.getExpectedImpact(),
                r.getSuggestedAmount(), r.getRelatedIndicator(), r.getCreatedAt()))
            .toList();

        return new AnalysisResponse(
            analysis.getId(),
            analysis.getUser().getId(),
            profile,
            indicators,
            summaryDto,
            classifiedTransactions,
            recommendationDtos,
            modelVersions,
            analysis.getCreatedAt()
        );
    }

    private List<ClassifiedTransactionDto> toClassifiedDtos(List<Transaction> transactions,
                                                            Map<String, BigDecimal> spendingByCategory) {
        return transactions.stream()
            .map(t -> new ClassifiedTransactionDto(
                t.getId(),
                t.getDescription(),
                t.getAmount(),
                t.getTransactionDate(),
                t.getType(),
                categoryCodeOf(t),
                t.getCategoryId() != null
                    ? categoryRepository.findById(t.getCategoryId()).map(TransactionCategory::getName).orElse(null)
                    : null,
                null
            ))
            .toList();
    }

    private BigDecimal safePercentage(BigDecimal value, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(SCALE, ROUNDING);
        }
        return value.multiply(ONE_HUNDRED)
            .divide(total, SCALE, ROUNDING);
    }

    private BigDecimal sumByType(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
            .filter(transaction -> transaction.getType() == type)
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String deriveSavingFrequency(List<Transaction> transactions,
                                         YearMonth firstMonth,
                                         YearMonth lastMonth) {
        Map<YearMonth, BigDecimal> balances = new HashMap<>();
        transactions.forEach(transaction -> {
            YearMonth month = YearMonth.from(transaction.getTransactionDate());
            BigDecimal signedAmount = transaction.getType() == TransactionType.INCOME
                ? transaction.getAmount()
                : transaction.getAmount().negate();
            balances.merge(month, signedAmount, BigDecimal::add);
        });

        int totalMonths = Math.max(1, (int) ChronoUnit.MONTHS.between(firstMonth, lastMonth) + 1);
        long positiveMonths = balances.values().stream()
            .filter(balance -> balance.compareTo(BigDecimal.ZERO) > 0)
            .count();
        double positiveRatio = positiveMonths / (double) totalMonths;
        if (positiveRatio >= 0.75) return SavingFrequency.HIGH.name();
        if (positiveRatio >= 0.40) return SavingFrequency.MEDIUM.name();
        return SavingFrequency.LOW.name();
    }

    private BigDecimal calculateExpenseVariation(List<Transaction> transactions,
                                                  YearMonth firstMonth,
                                                  YearMonth lastMonth) {
        Map<YearMonth, BigDecimal> monthlyExpenses = transactions.stream()
            .filter(transaction -> transaction.getType() == TransactionType.EXPENSE)
            .collect(Collectors.groupingBy(
                transaction -> YearMonth.from(transaction.getTransactionDate()),
                Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
            ));
        BigDecimal first = monthlyExpenses.getOrDefault(firstMonth, BigDecimal.ZERO);
        BigDecimal last = monthlyExpenses.getOrDefault(lastMonth, BigDecimal.ZERO);
        return first.compareTo(BigDecimal.ZERO) == 0
            ? BigDecimal.ZERO.setScale(SCALE, ROUNDING)
            : safePercentage(last.subtract(first), first);
    }

    private BigDecimal safeDivide(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(SCALE, ROUNDING);
        }
        return numerator.divide(denominator, SCALE, ROUNDING);
    }

    private String currentPeriod() {
        return LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }

}
