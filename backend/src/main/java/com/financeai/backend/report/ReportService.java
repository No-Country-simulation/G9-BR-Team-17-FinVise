package com.financeai.backend.report;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportService {

    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final UserRepository userRepository;

    public ReportService(TransactionRepository transactionRepository,
                         TransactionCategoryRepository categoryRepository,
                         UserRepository userRepository) {
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public FinancialReportDto buildFinancialReport(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        List<Transaction> transactions = transactionRepository.findByUserIdOrderByTransactionDateDesc(userId);

        BigDecimal totalIncome = sumByType(transactions, TransactionType.INCOME);
        BigDecimal totalExpenses = sumByType(transactions, TransactionType.EXPENSE);
        BigDecimal balance = totalIncome.subtract(totalExpenses);

        Map<String, FinancialReportDto.CategoryTotal> summaryByCategory = new HashMap<>();
        Map<String, BigDecimal> categoryTotals = groupByCategory(transactions);

        BigDecimal totalForPercentage = totalExpenses.compareTo(BigDecimal.ZERO) > 0
            ? totalExpenses
            : totalIncome;

        categoryTotals.forEach((code, amount) -> {
            BigDecimal percentage = safePercentage(amount, totalForPercentage);
            summaryByCategory.put(code, new FinancialReportDto.CategoryTotal(amount, percentage));
        });

        return new FinancialReportDto(
            userId,
            user.getName(),
            totalIncome,
            totalExpenses,
            balance,
            summaryByCategory
        );
    }

    private BigDecimal sumByType(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
            .filter(t -> t.getType() == type)
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(SCALE, ROUNDING);
    }

    private Map<String, BigDecimal> groupByCategory(List<Transaction> transactions) {
        Map<String, BigDecimal> result = new HashMap<>();
        for (Transaction transaction : transactions) {
            String code = categoryCodeOf(transaction);
            result.merge(code, transaction.getAmount(), BigDecimal::add);
        }
        return result;
    }

    private String categoryCodeOf(Transaction transaction) {
        UUID categoryId = transaction.getCategoryId();
        if (categoryId == null) {
            return "OUTROS";
        }
        return categoryRepository.findById(categoryId)
            .map(TransactionCategory::getCode)
            .orElse("OUTROS");
    }

    private BigDecimal safePercentage(BigDecimal value, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(SCALE, ROUNDING);
        }
        return value.multiply(ONE_HUNDRED)
            .divide(total, SCALE, ROUNDING);
    }
}
