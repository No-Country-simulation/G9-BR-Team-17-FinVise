package com.financeai.backend;

import com.financeai.backend.report.ReportService;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportExportServiceTest {

    @Mock private TransactionRepository transactions;
    @Mock private UserRepository users;
    @Mock private TransactionRepository.TotalsProjection totals;
    @Mock private TransactionRepository.CategoryTotalProjection category;

    @Test
    void shouldExportAPlanilhaCompatibleCsv() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setName("Usuário Teste");
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(transactions.summarize(userId, null, null)).thenReturn(totals);
        when(totals.getTotalIncome()).thenReturn(new BigDecimal("5000.00"));
        when(totals.getTotalExpense()).thenReturn(new BigDecimal("3200.50"));
        when(transactions.summarizeExpensesByCategory(userId, null, null))
            .thenReturn(List.of(category));
        when(category.getCategoryCode()).thenReturn("ALIMENTACAO");
        when(category.getAmount()).thenReturn(new BigDecimal("800.25"));

        String csv = new String(
            new ReportService(transactions, users).exportFinancialReportCsv(userId),
            StandardCharsets.UTF_8);

        assertThat(csv)
            .startsWith("\uFEFFRelatório Financeiro FinVise")
            .contains("Receitas;5000,00")
            .contains("Despesas;3200,50")
            .contains("Saldo;1799,50")
            .contains("\"ALIMENTACAO\";800,25;25,00%");
    }
}
