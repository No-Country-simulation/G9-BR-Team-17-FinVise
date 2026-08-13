package com.financeai.backend.openfinance;

import com.financeai.backend.analysis.AnalysisResponse;
import com.financeai.backend.analysis.AnalysisService;
import com.financeai.backend.analysis.ProfileAnalysisModel;
import com.financeai.backend.config.OpenFinanceProperties;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.UserRepository;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class OpenFinanceService {
    private static final String SOURCE = "OPEN_FINANCE_PLUGGY";

    private final OpenFinanceProperties properties;
    private final PluggyClient pluggyClient;
    private final OpenFinanceConnectionRepository connectionRepository;
    private final TransactionRepository transactionRepository;
    private final TransactionCategorizationService categorizationService;
    private final UserRepository userRepository;
    private final AnalysisService analysisService;
    private final OpenFinancePersistenceService persistenceService;

    public OpenFinanceService(OpenFinanceProperties properties,
                              PluggyClient pluggyClient,
                              OpenFinanceConnectionRepository connectionRepository,
                              TransactionRepository transactionRepository,
                              TransactionCategorizationService categorizationService,
                              UserRepository userRepository,
                              AnalysisService analysisService,
                              OpenFinancePersistenceService persistenceService) {
        this.properties = properties;
        this.pluggyClient = pluggyClient;
        this.connectionRepository = connectionRepository;
        this.transactionRepository = transactionRepository;
        this.categorizationService = categorizationService;
        this.userRepository = userRepository;
        this.analysisService = analysisService;
        this.persistenceService = persistenceService;
    }

    public OpenFinanceStatusResponse status() {
        return new OpenFinanceStatusResponse(
            properties.isConfigured(), properties.getProvider(), properties.isIncludeSandbox());
    }

    public OpenFinanceConnectTokenResponse createConnectToken(UUID userId) {
        userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));
        return new OpenFinanceConnectTokenResponse(
            pluggyClient.createConnectToken(userId.toString()),
            properties.getProvider(),
            properties.isIncludeSandbox());
    }

    public OpenFinanceSyncResponse synchronize(UUID userId,
                                               String itemId,
                                               ProfileAnalysisModel model) {
        userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));
        UUID ownerId = connectionRepository
            .findOwnerIdByProviderAndExternalItemId(properties.getProvider(), itemId)
            .orElse(null);
        if (ownerId != null && !ownerId.equals(userId)) {
            throw new AccessDeniedException(
                "A conexão Open Finance não pertence ao usuário autenticado");
        }

        PluggyClient.PluggySyncData syncData = pluggyClient.fetchTransactions(
            itemId, userId.toString());
        List<PluggyClient.PluggyTransaction> providerTransactions = syncData.transactions();
        List<Transaction> mappedTransactions = new ArrayList<>();
        for (PluggyClient.PluggyTransaction providerTransaction : providerTransactions) {
            String externalId = itemId + ":" + providerTransaction.id();
            Transaction transaction = mapTransaction(externalId, providerTransaction);
            if (transaction == null) {
                continue;
            }
            mappedTransactions.add(transaction);
        }

        Set<String> existingExternalIds = mappedTransactions.isEmpty()
            ? Set.of()
            : transactionRepository.findExistingExternalIds(
                userId,
                SOURCE,
                mappedTransactions.stream().map(Transaction::getExternalId).toList());
        Set<String> uniqueExternalIds = new HashSet<>();
        List<Transaction> newTransactions = mappedTransactions.stream()
            .filter(transaction -> !existingExternalIds.contains(transaction.getExternalId()))
            .filter(transaction -> uniqueExternalIds.add(transaction.getExternalId()))
            .toList();

        categorizationService.categorize(newTransactions);
        OpenFinancePersistenceService.PersistResult persisted = persistenceService.persist(
            userId,
            properties.getProvider(),
            itemId,
            syncData.displayName(),
            newTransactions);

        AnalysisResponse analysis = analysisService.analyzeStoredTransactions(
            userId, model, TransactionSource.OPEN_FINANCE_PLUGGY,
            persisted.connectionId(), null, null, null);
        return new OpenFinanceSyncResponse(
            persisted.insertedCount(),
            providerTransactions.size() - persisted.insertedCount(),
            analysis);
    }

    private Transaction mapTransaction(String externalId,
                                       PluggyClient.PluggyTransaction source) {
        TransactionType type = resolveType(source);
        if (type == null || source.amount().signum() == 0) return null;

        Transaction transaction = new Transaction();
        transaction.setExternalId(externalId);
        transaction.setDescription(source.description());
        transaction.setAmount(source.amount().abs());
        transaction.setTransactionDate(source.date());
        transaction.setType(type);
        transaction.setRecurrent(false);
        transaction.setSource(SOURCE);
        return transaction;
    }

    private TransactionType resolveType(PluggyClient.PluggyTransaction transaction) {
        String accountType = value(transaction.accountType());
        String type = value(transaction.type());
        if ("CREDIT".equals(accountType)) {
            // Charges are positive in Pluggy credit-card accounts. Negative values are bill
            // payments/credits and are ignored to avoid counting the bank counterpart twice.
            return transaction.amount().signum() > 0 ? TransactionType.EXPENSE : null;
        }
        if ("CREDIT".equals(type)) return TransactionType.INCOME;
        if ("DEBIT".equals(type)) return TransactionType.EXPENSE;
        return transaction.amount().signum() < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    }

    private String value(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
