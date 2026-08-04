package com.financeai.backend.report;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportService {

    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public ReportService(TransactionRepository transactionRepository,
                         UserRepository userRepository) {
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public FinancialReportDto buildFinancialReport(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        TransactionRepository.TotalsProjection totals =
            transactionRepository.summarize(userId, null, null);
        BigDecimal totalIncome = scaled(totals.getTotalIncome());
        BigDecimal totalExpenses = scaled(totals.getTotalExpense());
        BigDecimal balance = totalIncome.subtract(totalExpenses);

        Map<String, FinancialReportDto.CategoryTotal> summaryByCategory = new HashMap<>();
        BigDecimal totalForPercentage = totalExpenses.compareTo(BigDecimal.ZERO) > 0
            ? totalExpenses
            : totalIncome;

        transactionRepository.summarizeExpensesByCategory(userId, null, null).forEach(category -> {
            BigDecimal amount = scaled(category.getAmount());
            BigDecimal percentage = safePercentage(amount, totalForPercentage);
            summaryByCategory.put(
                category.getCategoryCode(),
                new FinancialReportDto.CategoryTotal(amount, percentage));
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

    private BigDecimal scaled(BigDecimal value) {
        return (value != null ? value : BigDecimal.ZERO).setScale(SCALE, ROUNDING);
    }

    private BigDecimal safePercentage(BigDecimal value, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(SCALE, ROUNDING);
        }
        return value.multiply(ONE_HUNDRED)
            .divide(total, SCALE, ROUNDING);
    }
}
