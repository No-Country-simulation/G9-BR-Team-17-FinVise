package com.financeai.backend.openfinance;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class OpenFinancePersistenceService {

    private final OpenFinanceConnectionRepository connectionRepository;
    private final OpenFinanceTransactionWriter transactionWriter;
    private final UserRepository userRepository;
    private final FinancialSourceConsistencyService sourceConsistencyService;

    public OpenFinancePersistenceService(OpenFinanceConnectionRepository connectionRepository,
                                         OpenFinanceTransactionWriter transactionWriter,
                                         UserRepository userRepository,
                                         FinancialSourceConsistencyService sourceConsistencyService) {
        this.connectionRepository = connectionRepository;
        this.transactionWriter = transactionWriter;
        this.userRepository = userRepository;
        this.sourceConsistencyService = sourceConsistencyService;
    }

    @Transactional
    public PersistResult persist(UUID userId,
                                 String provider,
                                 String externalItemId,
                                 String displayName,
                                 List<Transaction> transactions) {
        transactionWriter.lockConnection(provider, externalItemId);

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));
        OpenFinanceConnection connection = connectionRepository
            .findByProviderAndExternalItemId(provider, externalItemId)
            .orElseGet(OpenFinanceConnection::new);
        if (connection.getUser() != null
            && !connection.getUser().getId().equals(userId)) {
            throw new AccessDeniedException(
                "A conexão Open Finance não pertence ao usuário autenticado");
        }

        connection.setUser(user);
        connection.setProvider(provider);
        connection.setExternalItemId(externalItemId);
        if (displayName != null && !displayName.isBlank()) {
            connection.setDisplayName(displayName);
        }
        connection.setStatus("SYNCING");
        connection = connectionRepository.saveAndFlush(connection);

        int insertedCount = transactionWriter.insertIgnoringConflicts(
            userId, connection.getId(), transactions);
        sourceConsistencyService.refresh(
            userId,
            TransactionSource.OPEN_FINANCE_PLUGGY,
            connection.getId(),
            connection.getDisplayName());

        connection.setStatus("CONNECTED");
        connection.setLastSyncAt(Instant.now());
        connectionRepository.save(connection);
        return new PersistResult(connection.getId(), insertedCount);
    }

    public record PersistResult(UUID connectionId, int insertedCount) {
    }
}
