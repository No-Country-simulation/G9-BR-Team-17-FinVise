package com.financeai.backend;

import com.financeai.backend.fact.FinancialFactSnapshot;
import com.financeai.backend.fact.FinancialFactSnapshotRepository;
import com.financeai.backend.fact.FinancialFactsPayload;
import com.financeai.backend.fact.FinancialFactsService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinancialFactsServiceTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private TransactionCategoryRepository categoryRepository;
    @Mock
    private FinancialFactSnapshotRepository snapshotRepository;

    private FinancialFactsService service;
    private UUID userId;
    private UUID sourceId;
    private User user;
    private TransactionCategory food;
    private TransactionCategory housing;

    @BeforeEach
    void setUp() {
        service = new FinancialFactsService(
            transactionRepository, categoryRepository, snapshotRepository);
        userId = UUID.randomUUID();
        sourceId = UUID.randomUUID();
        user = new User();
        user.setId(userId);
        food = category("ALIMENTACAO", "Alimentação");
        housing = category("MORADIA", "Moradia");
    }

    @Test
    void shouldConsolidateFactsForSelectedSource() {
        List<Transaction> transactions = List.of(
            transaction("Salário", "5000.00", "2024-01-01",
                TransactionType.INCOME, null, false),
            transaction("Mercado", "100.00", "2024-01-05",
                TransactionType.EXPENSE, food, false),
            transaction("Restaurante", "300.00", "2024-01-15",
                TransactionType.EXPENSE, food, false),
            transaction("Salário", "4000.00", "2024-02-01",
                TransactionType.INCOME, null, false),
            transaction("Aluguel", "600.00", "2024-02-05",
                TransactionType.EXPENSE, housing, true)
        );
        when(transactionRepository.findByUserIdAndImportSourceIdOrderByTransactionDateDesc(
            userId, sourceId)).thenReturn(transactions);
        when(categoryRepository.findAll()).thenReturn(List.of(food, housing));
        when(snapshotRepository.findByUserIdAndSourceTypeAndSourceId(
            userId, TransactionSource.CSV_IMPORT.name(), sourceId))
            .thenReturn(Optional.empty());
        when(snapshotRepository.save(org.mockito.ArgumentMatchers.any(FinancialFactSnapshot.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        service.rebuild(userId, TransactionSource.CSV_IMPORT, sourceId);

        ArgumentCaptor<FinancialFactSnapshot> captor =
            ArgumentCaptor.forClass(FinancialFactSnapshot.class);
        verify(snapshotRepository).save(captor.capture());
        FinancialFactSnapshot snapshot = captor.getValue();
        FinancialFactsPayload facts = snapshot.getFacts();

        assertThat(snapshot.getSchemaVersion()).isEqualTo("1.0");
        assertThat(snapshot.getPeriodStart()).isEqualTo(LocalDate.of(2024, 1, 1));
        assertThat(snapshot.getPeriodEnd()).isEqualTo(LocalDate.of(2024, 2, 5));
        assertThat(facts.overview().transactionCount()).isEqualTo(5);
        assertThat(facts.overview().totalIncome()).isEqualByComparingTo("9000.00");
        assertThat(facts.overview().totalExpenses()).isEqualByComparingTo("1000.00");
        assertThat(facts.overview().medianExpense()).isEqualByComparingTo("300.00");
        assertThat(facts.overview().recurringExpenseTotal()).isEqualByComparingTo("600.00");
        assertThat(facts.months()).extracting(FinancialFactsPayload.MonthlyFact::period)
            .containsExactly(YearMonth.of(2024, 1), YearMonth.of(2024, 2));
        assertThat(facts.rankings().highestExpenseMonth().period())
            .isEqualTo(YearMonth.of(2024, 2));
        assertThat(facts.rankings().lowestBalanceMonth().period())
            .isEqualTo(YearMonth.of(2024, 2));
        assertThat(facts.rankings().smallestExpenses().getFirst().description())
            .isEqualTo("Mercado");
        assertThat(facts.categories()).extracting(FinancialFactsPayload.CategoryFact::code)
            .containsExactly("MORADIA", "ALIMENTACAO");
        assertThat(facts.dataQuality().uncategorizedExpenseCount()).isZero();
    }

    @Test
    void shouldRemoveSnapshotWhenSourceHasNoTransactions() {
        when(transactionRepository.findByUserIdAndImportSourceIdOrderByTransactionDateDesc(
            userId, sourceId)).thenReturn(List.of());

        Optional<FinancialFactSnapshot> result =
            service.rebuild(userId, TransactionSource.CSV_IMPORT, sourceId);

        assertThat(result).isEmpty();
        verify(snapshotRepository).deleteByUserIdAndSourceTypeAndSourceId(
            userId, TransactionSource.CSV_IMPORT.name(), sourceId);
    }

    private TransactionCategory category(String code, String name) {
        TransactionCategory category = new TransactionCategory();
        category.setId(UUID.randomUUID());
        category.setCode(code);
        category.setName(name);
        return category;
    }

    private Transaction transaction(String description,
                                    String amount,
                                    String date,
                                    TransactionType type,
                                    TransactionCategory category,
                                    boolean recurrent) {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setUser(user);
        transaction.setImportSourceId(sourceId);
        transaction.setSource(TransactionSource.CSV_IMPORT.name());
        transaction.setDescription(description);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setTransactionDate(LocalDate.parse(date));
        transaction.setType(type);
        transaction.setCategoryId(category == null ? null : category.getId());
        transaction.setRecurrent(recurrent);
        return transaction;
    }
}
