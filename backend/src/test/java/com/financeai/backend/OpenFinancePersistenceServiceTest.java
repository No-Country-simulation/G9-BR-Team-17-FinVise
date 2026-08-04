package com.financeai.backend;

import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.openfinance.OpenFinanceConnection;
import com.financeai.backend.openfinance.OpenFinanceConnectionRepository;
import com.financeai.backend.openfinance.OpenFinancePersistenceService;
import com.financeai.backend.openfinance.OpenFinanceTransactionWriter;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenFinancePersistenceServiceTest {

    @Mock
    private OpenFinanceConnectionRepository connectionRepository;
    @Mock
    private OpenFinanceTransactionWriter transactionWriter;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FinancialSourceConsistencyService sourceConsistencyService;
    @InjectMocks
    private OpenFinancePersistenceService service;

    @Test
    void shouldSerializeConcurrentSyncAndIgnoreTransactionConflicts() {
        UUID userId = UUID.randomUUID();
        UUID connectionId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        OpenFinanceConnection connection = new OpenFinanceConnection();
        connection.setUser(user);
        setConnectionId(connection, connectionId);
        Transaction transaction = new Transaction();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.findByProviderAndExternalItemId("PLUGGY", "item-1"))
            .thenReturn(Optional.of(connection));
        when(connectionRepository.saveAndFlush(connection)).thenReturn(connection);
        when(transactionWriter.insertIgnoringConflicts(
            userId, connectionId, List.of(transaction))).thenReturn(0);

        OpenFinancePersistenceService.PersistResult result = service.persist(
            userId, "PLUGGY", "item-1", "Conta", List.of(transaction));

        assertThat(result.connectionId()).isEqualTo(connectionId);
        assertThat(result.insertedCount()).isZero();
        InOrder order = inOrder(transactionWriter, connectionRepository, sourceConsistencyService);
        order.verify(transactionWriter).lockConnection("PLUGGY", "item-1");
        order.verify(connectionRepository).findByProviderAndExternalItemId("PLUGGY", "item-1");
        order.verify(transactionWriter).insertIgnoringConflicts(
            userId, connectionId, List.of(transaction));
        order.verify(sourceConsistencyService).refresh(
            userId, TransactionSource.OPEN_FINANCE_PLUGGY, connectionId, "Conta");
        verify(connectionRepository).save(connection);
    }

    private void setConnectionId(OpenFinanceConnection connection, UUID id) {
        try {
            var field = OpenFinanceConnection.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(connection, id);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError(exception);
        }
    }
}
