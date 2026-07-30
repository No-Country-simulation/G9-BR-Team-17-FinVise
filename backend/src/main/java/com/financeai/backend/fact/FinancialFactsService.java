package com.financeai.backend.fact;

import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.transaction.TransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FinancialFactsService {

    static final String SCHEMA_VERSION = "1.0";
    static final int RANKING_LIMIT = 20;
    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final FinancialFactSnapshotRepository snapshotRepository;

    public FinancialFactsService(TransactionRepository transactionRepository,
                                 TransactionCategoryRepository categoryRepository,
                                 FinancialFactSnapshotRepository snapshotRepository) {
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.snapshotRepository = snapshotRepository;
    }

    @Transactional
    public Optional<FinancialFactSnapshot> rebuild(UUID userId,
                                                   TransactionSource source,
                                                   UUID sourceId) {
        List<Transaction> transactions = transactionRepository
            .findByUserIdAndImportSourceIdOrderByTransactionDateDesc(userId, sourceId)
            .stream()
            .filter(transaction -> source.name().equals(transaction.getSource()))
            .toList();

        if (transactions.isEmpty()) {
            snapshotRepository.deleteByUserIdAndSourceTypeAndSourceId(
                userId, source.name(), sourceId);
            return Optional.empty();
        }

        Map<UUID, TransactionCategory> categories = categoryRepository.findAll().stream()
            .collect(Collectors.toMap(TransactionCategory::getId, Function.identity()));
        LocalDate periodStart = transactions.stream()
            .map(Transaction::getTransactionDate)
            .min(LocalDate::compareTo)
            .orElseThrow();
        LocalDate periodEnd = transactions.stream()
            .map(Transaction::getTransactionDate)
            .max(LocalDate::compareTo)
            .orElseThrow();

        FinancialFactSnapshot snapshot = snapshotRepository
            .findByUserIdAndSourceTypeAndSourceId(userId, source.name(), sourceId)
            .orElseGet(FinancialFactSnapshot::new);
        snapshot.setUser(transactions.getFirst().getUser());
        snapshot.setSourceType(source.name());
        snapshot.setSourceId(sourceId);
        snapshot.setSchemaVersion(SCHEMA_VERSION);
        snapshot.setPeriodStart(periodStart);
        snapshot.setPeriodEnd(periodEnd);
        snapshot.setFacts(buildPayload(transactions, categories, periodStart, periodEnd));
        return Optional.of(snapshotRepository.save(snapshot));
    }

    private FinancialFactsPayload buildPayload(List<Transaction> transactions,
                                                Map<UUID, TransactionCategory> categories,
                                                LocalDate periodStart,
                                                LocalDate periodEnd) {
        List<Transaction> incomes = byType(transactions, TransactionType.INCOME);
        List<Transaction> expenses = byType(transactions, TransactionType.EXPENSE);
        List<Transaction> recurringExpenses = expenses.stream()
            .filter(transaction -> Boolean.TRUE.equals(transaction.getRecurrent()))
            .toList();

        BigDecimal totalIncome = sum(incomes);
        BigDecimal totalExpenses = sum(expenses);
        FinancialFactsPayload.Overview overview = new FinancialFactsPayload.Overview(
            transactions.size(),
            incomes.size(),
            expenses.size(),
            totalIncome,
            totalExpenses,
            totalIncome.subtract(totalExpenses),
            average(incomes),
            average(expenses),
            median(incomes),
            median(expenses),
            recurringExpenses.size(),
            sum(recurringExpenses)
        );

        List<FinancialFactsPayload.MonthlyFact> months =
            buildMonthlyFacts(transactions, periodStart, periodEnd);
        List<FinancialFactsPayload.CategoryFact> categoryFacts =
            buildCategoryFacts(expenses, categories, totalExpenses);
        FinancialFactsPayload.Rankings rankings = buildRankings(
            months, incomes, expenses, recurringExpenses, categories);

        long uncategorized = expenses.stream()
            .filter(transaction -> "OUTROS".equals(categoryCode(transaction, categories)))
            .count();
        FinancialFactsPayload.DataQuality dataQuality = new FinancialFactsPayload.DataQuality(
            Math.toIntExact(uncategorized),
            percentage(BigDecimal.valueOf(uncategorized), BigDecimal.valueOf(expenses.size())),
            months.size()
        );
        return new FinancialFactsPayload(overview, months, categoryFacts, rankings, dataQuality);
    }

    private List<FinancialFactsPayload.MonthlyFact> buildMonthlyFacts(
        List<Transaction> transactions,
        LocalDate periodStart,
        LocalDate periodEnd
    ) {
        Map<YearMonth, List<Transaction>> byMonth = transactions.stream()
            .collect(Collectors.groupingBy(transaction ->
                YearMonth.from(transaction.getTransactionDate())));
        List<FinancialFactsPayload.MonthlyFact> result = new ArrayList<>();
        BigDecimal previousExpenses = null;
        YearMonth firstMonth = YearMonth.from(periodStart);
        YearMonth lastMonth = YearMonth.from(periodEnd);

        for (YearMonth month = firstMonth; !month.isAfter(lastMonth); month = month.plusMonths(1)) {
            List<Transaction> monthTransactions = byMonth.getOrDefault(month, List.of());
            List<Transaction> incomes = byType(monthTransactions, TransactionType.INCOME);
            List<Transaction> expenses = byType(monthTransactions, TransactionType.EXPENSE);
            BigDecimal totalIncome = sum(incomes);
            BigDecimal totalExpenses = sum(expenses);
            BigDecimal variation = previousExpenses == null
                ? BigDecimal.ZERO.setScale(SCALE)
                : variationPercentage(totalExpenses, previousExpenses);
            result.add(new FinancialFactsPayload.MonthlyFact(
                month,
                monthTransactions.size(),
                incomes.size(),
                expenses.size(),
                totalIncome,
                totalExpenses,
                totalIncome.subtract(totalExpenses),
                variation
            ));
            previousExpenses = totalExpenses;
        }
        return List.copyOf(result);
    }

    private List<FinancialFactsPayload.CategoryFact> buildCategoryFacts(
        List<Transaction> expenses,
        Map<UUID, TransactionCategory> categories,
        BigDecimal totalExpenses
    ) {
        Map<String, List<Transaction>> grouped = expenses.stream()
            .collect(Collectors.groupingBy(transaction -> categoryCode(transaction, categories)));
        return grouped.entrySet().stream()
            .map(entry -> {
                List<Transaction> categoryExpenses = entry.getValue();
                BigDecimal categoryTotal = sum(categoryExpenses);
                List<BigDecimal> amounts = sortedAmounts(categoryExpenses);
                return new FinancialFactsPayload.CategoryFact(
                    entry.getKey(),
                    categoryName(categoryExpenses.getFirst(), categories),
                    categoryExpenses.size(),
                    categoryTotal,
                    percentage(categoryTotal, totalExpenses),
                    average(categoryExpenses),
                    amounts.getFirst(),
                    amounts.getLast()
                );
            })
            .sorted(Comparator.comparing(
                FinancialFactsPayload.CategoryFact::totalExpenses).reversed())
            .toList();
    }

    private FinancialFactsPayload.Rankings buildRankings(
        List<FinancialFactsPayload.MonthlyFact> months,
        List<Transaction> incomes,
        List<Transaction> expenses,
        List<Transaction> recurringExpenses,
        Map<UUID, TransactionCategory> categories
    ) {
        Comparator<FinancialFactsPayload.MonthlyFact> byExpenses =
            Comparator.comparing(FinancialFactsPayload.MonthlyFact::totalExpenses)
                .thenComparing(FinancialFactsPayload.MonthlyFact::period);
        Comparator<FinancialFactsPayload.MonthlyFact> byBalance =
            Comparator.comparing(FinancialFactsPayload.MonthlyFact::balance)
                .thenComparing(FinancialFactsPayload.MonthlyFact::period);
        return new FinancialFactsPayload.Rankings(
            months.stream().max(byExpenses).orElse(null),
            months.stream().min(byExpenses).orElse(null),
            months.stream().max(byBalance).orElse(null),
            months.stream().min(byBalance).orElse(null),
            rankTransactions(expenses, categories, true),
            rankTransactions(expenses, categories, false),
            rankTransactions(incomes, categories, true),
            rankTransactions(incomes, categories, false),
            rankTransactions(recurringExpenses, categories, false)
        );
    }

    private List<FinancialFactsPayload.TransactionFact> rankTransactions(
        List<Transaction> transactions,
        Map<UUID, TransactionCategory> categories,
        boolean ascending
    ) {
        Comparator<Transaction> comparator = Comparator
            .comparing(Transaction::getAmount)
            .thenComparing(Transaction::getTransactionDate)
            .thenComparing(transaction -> transaction.getId() == null
                ? new UUID(0, 0)
                : transaction.getId());
        if (!ascending) {
            comparator = comparator.reversed();
        }
        return transactions.stream()
            .sorted(comparator)
            .limit(RANKING_LIMIT)
            .map(transaction -> new FinancialFactsPayload.TransactionFact(
                transaction.getId(),
                transaction.getDescription(),
                transaction.getAmount(),
                transaction.getTransactionDate(),
                transaction.getType(),
                categoryCode(transaction, categories)
            ))
            .toList();
    }

    private List<Transaction> byType(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
            .filter(transaction -> transaction.getType() == type)
            .toList();
    }

    private BigDecimal sum(List<Transaction> transactions) {
        return transactions.stream()
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add);
    }

    private BigDecimal average(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return BigDecimal.ZERO.setScale(SCALE);
        }
        return sum(transactions).divide(
            BigDecimal.valueOf(transactions.size()), SCALE, ROUNDING);
    }

    private BigDecimal median(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return BigDecimal.ZERO.setScale(SCALE);
        }
        List<BigDecimal> amounts = sortedAmounts(transactions);
        int middle = amounts.size() / 2;
        if (amounts.size() % 2 != 0) {
            return amounts.get(middle).setScale(SCALE, ROUNDING);
        }
        return amounts.get(middle - 1)
            .add(amounts.get(middle))
            .divide(BigDecimal.valueOf(2), SCALE, ROUNDING);
    }

    private List<BigDecimal> sortedAmounts(List<Transaction> transactions) {
        return transactions.stream()
            .map(Transaction::getAmount)
            .sorted()
            .toList();
    }

    private BigDecimal variationPercentage(BigDecimal current, BigDecimal previous) {
        if (previous.signum() == 0) {
            return BigDecimal.ZERO.setScale(SCALE);
        }
        return current.subtract(previous)
            .multiply(ONE_HUNDRED)
            .divide(previous, SCALE, ROUNDING);
    }

    private BigDecimal percentage(BigDecimal value, BigDecimal total) {
        if (total.signum() == 0) {
            return BigDecimal.ZERO.setScale(SCALE);
        }
        return value.multiply(ONE_HUNDRED).divide(total, SCALE, ROUNDING);
    }

    private String categoryCode(Transaction transaction,
                                Map<UUID, TransactionCategory> categories) {
        TransactionCategory category = categories.get(transaction.getCategoryId());
        return category == null ? "OUTROS" : category.getCode();
    }

    private String categoryName(Transaction transaction,
                                Map<UUID, TransactionCategory> categories) {
        TransactionCategory category = categories.get(transaction.getCategoryId());
        return category == null ? "Outros" : category.getName();
    }
}
