package com.financeai.backend;

import com.financeai.backend.analysis.AnalysisService;
import com.financeai.backend.analysis.ProfileAnalysisModel;
import com.financeai.backend.config.OpenFinanceProperties;
import com.financeai.backend.openfinance.OpenFinanceConnection;
import com.financeai.backend.openfinance.OpenFinanceConnectionRepository;
import com.financeai.backend.openfinance.OpenFinanceService;
import com.financeai.backend.openfinance.OpenFinanceSyncResponse;
import com.financeai.backend.openfinance.PluggyClient;
import com.financeai.backend.rag.RagIngestionService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenFinanceServiceTest {

    @Mock
    private OpenFinanceProperties properties;
    @Mock
    private PluggyClient pluggyClient;
    @Mock
    private OpenFinanceConnectionRepository connectionRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private TransactionCategorizationService categorizationService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AnalysisService analysisService;
    @Mock
    private RagIngestionService ragIngestionService;
    @InjectMocks
    private OpenFinanceService service;

    @Test
    @SuppressWarnings("unchecked")
    void shouldOnlyPersistNewTransactionsOnIncrementalSync() {
        UUID userId = UUID.randomUUID();
        UUID connectionId = UUID.randomUUID();
        String itemId = "item-123";
        User user = new User();
        user.setId(userId);
        OpenFinanceConnection connection = org.mockito.Mockito.mock(
            OpenFinanceConnection.class);
        when(connection.getUser()).thenReturn(user);
        when(connection.getId()).thenReturn(connectionId);
        when(properties.getProvider()).thenReturn("PLUGGY");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.findByProviderAndExternalItemId("PLUGGY", itemId))
            .thenReturn(Optional.of(connection));
        when(connectionRepository.save(connection)).thenReturn(connection);

        PluggyClient.PluggyTransaction existing =
            new PluggyClient.PluggyTransaction(
                "old", "Compra antiga", BigDecimal.valueOf(-40),
                LocalDate.of(2026, 7, 1), "DEBIT", "BANK");
        PluggyClient.PluggyTransaction fresh =
            new PluggyClient.PluggyTransaction(
                "new", "Compra nova", BigDecimal.valueOf(-75),
                LocalDate.of(2026, 7, 30), "DEBIT", "BANK");
        when(pluggyClient.fetchTransactions(itemId, userId.toString()))
            .thenReturn(new PluggyClient.PluggySyncData(
                List.of(existing, fresh), "Conta principal"));
        when(transactionRepository.existsByUserIdAndSourceAndExternalId(
            userId, "OPEN_FINANCE_PLUGGY", itemId + ":old")).thenReturn(true);
        when(transactionRepository.existsByUserIdAndSourceAndExternalId(
            userId, "OPEN_FINANCE_PLUGGY", itemId + ":new")).thenReturn(false);

        OpenFinanceSyncResponse response = service.synchronize(
            userId, itemId, ProfileAnalysisModel.FINANCIAL_RULES);

        assertThat(response.importedCount()).isEqualTo(1);
        assertThat(response.skippedCount()).isEqualTo(1);
        ArgumentCaptor<List<Transaction>> transactions = ArgumentCaptor.forClass(List.class);
        verify(categorizationService).categorize(transactions.capture());
        assertThat(transactions.getValue())
            .singleElement()
            .satisfies(transaction -> {
                assertThat(transaction.getExternalId()).isEqualTo(itemId + ":new");
                assertThat(transaction.getAmount()).isEqualByComparingTo("75");
                assertThat(transaction.getImportSourceId()).isEqualTo(connectionId);
            });
        verify(transactionRepository).saveAll(transactions.getValue());
        verify(ragIngestionService).ingestTransactions(
            userId, "OPEN_FINANCE", connectionId.toString(), null, transactions.getValue());
        verify(connection).setLastSyncAt(any(Instant.class));
        verify(analysisService).analyzeStoredTransactions(
            eq(userId), eq(ProfileAnalysisModel.FINANCIAL_RULES),
            any(), eq(connectionId), eq(null), eq(null));
    }
}
