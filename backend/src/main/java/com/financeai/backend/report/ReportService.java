package com.financeai.backend.report;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Comparator;
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

    @Transactional(readOnly = true)
    public byte[] exportFinancialReportCsv(UUID userId) {
        FinancialReportDto report = buildFinancialReport(userId);
        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append("Relatório Financeiro FinVise\r\n");
        csv.append("Gerado em;").append(escape(Instant.now().toString())).append("\r\n");
        csv.append("Usuário;").append(escape(report.userName())).append("\r\n\r\n");
        csv.append("Resumo;Valor\r\n");
        csv.append("Receitas;").append(decimal(report.totalIncome())).append("\r\n");
        csv.append("Despesas;").append(decimal(report.totalExpenses())).append("\r\n");
        csv.append("Saldo;").append(decimal(report.balance())).append("\r\n\r\n");
        csv.append("Categoria;Valor;Percentual\r\n");
        report.summaryByCategory().entrySet().stream()
            .sorted(Comparator.comparing(Map.Entry::getKey))
            .forEach(entry -> csv
                .append(escape(entry.getKey())).append(';')
                .append(decimal(entry.getValue().amount())).append(';')
                .append(decimal(entry.getValue().percentage())).append("%\r\n"));
        return csv.toString().getBytes(StandardCharsets.UTF_8);
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

    private String decimal(BigDecimal value) {
        return scaled(value).toPlainString().replace('.', ',');
    }

    private String escape(String value) {
        String safe = value == null ? "" : value;
        return '"' + safe.replace("\"", "\"\"") + '"';
    }
}
