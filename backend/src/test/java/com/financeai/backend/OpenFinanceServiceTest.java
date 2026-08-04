package com.financeai.backend;

import com.financeai.backend.analysis.AnalysisService;
import com.financeai.backend.analysis.ProfileAnalysisModel;
import com.financeai.backend.config.OpenFinanceProperties;
import com.financeai.backend.openfinance.OpenFinanceConnectionRepository;
import com.financeai.backend.openfinance.OpenFinancePersistenceService;
import com.financeai.backend.openfinance.OpenFinanceService;
import com.financeai.backend.openfinance.OpenFinanceSyncResponse;
import com.financeai.backend.openfinance.PluggyClient;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.springframework.security.access.AccessDeniedException;

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
    private OpenFinancePersistenceService persistenceService;
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
        when(properties.getProvider()).thenReturn("PLUGGY");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.findOwnerIdByProviderAndExternalItemId("PLUGGY", itemId))
            .thenReturn(Optional.of(userId));

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
        when(transactionRepository.findExistingExternalIds(
            eq(userId), eq("OPEN_FINANCE_PLUGGY"), any()))
            .thenReturn(Set.of(itemId + ":old"));
        when(persistenceService.persist(
            eq(userId), eq("PLUGGY"), eq(itemId), eq("Conta principal"), any()))
            .thenReturn(new OpenFinancePersistenceService.PersistResult(connectionId, 1));

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
                assertThat(transaction.getImportSourceId()).isNull();
            });
        verify(persistenceService).persist(
            userId, "PLUGGY", itemId, "Conta principal", transactions.getValue());
        verify(analysisService).analyzeStoredTransactions(
            eq(userId), eq(ProfileAnalysisModel.FINANCIAL_RULES),
            any(), eq(connectionId), eq(null), eq(null));
    }

    @Test
    void shouldRejectAnotherUsersConnectionBeforeCallingPluggy() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(properties.getProvider()).thenReturn("PLUGGY");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.findOwnerIdByProviderAndExternalItemId(
            "PLUGGY", "item-private"))
            .thenReturn(Optional.of(UUID.randomUUID()));

        assertThatThrownBy(() -> service.synchronize(
            userId, "item-private", ProfileAnalysisModel.FINANCIAL_RULES))
            .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(pluggyClient, categorizationService, persistenceService, analysisService);
    }
}
