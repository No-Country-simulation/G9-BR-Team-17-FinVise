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
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
    private final com.financeai.backend.rag.RagIngestionService ragIngestionService;

    public OpenFinanceService(OpenFinanceProperties properties,
                              PluggyClient pluggyClient,
                              OpenFinanceConnectionRepository connectionRepository,
                              TransactionRepository transactionRepository,
                              TransactionCategorizationService categorizationService,
                              UserRepository userRepository,
                              AnalysisService analysisService,
                              com.financeai.backend.rag.RagIngestionService ragIngestionService) {
        this.properties = properties;
        this.pluggyClient = pluggyClient;
        this.connectionRepository = connectionRepository;
        this.transactionRepository = transactionRepository;
        this.categorizationService = categorizationService;
        this.userRepository = userRepository;
        this.analysisService = analysisService;
        this.ragIngestionService = ragIngestionService;
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

    @Transactional
    public OpenFinanceSyncResponse synchronize(UUID userId,
                                               String itemId,
                                               ProfileAnalysisModel model) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));
        OpenFinanceConnection existingConnection = connectionRepository
            .findByProviderAndExternalItemId(properties.getProvider(), itemId)
            .orElse(null);
        if (existingConnection != null
            && !existingConnection.getUser().getId().equals(userId)) {
            throw new AccessDeniedException(
                "A conexão Open Finance não pertence ao usuário autenticado");
        }

        PluggyClient.PluggySyncData syncData = pluggyClient.fetchTransactions(
            itemId, userId.toString());
        List<PluggyClient.PluggyTransaction> providerTransactions = syncData.transactions();
        OpenFinanceConnection connection = existingConnection != null
            ? existingConnection
            : new OpenFinanceConnection();
        connection.setUser(user);
        connection.setProvider(properties.getProvider());
        connection.setExternalItemId(itemId);
        if (syncData.displayName() != null && !syncData.displayName().isBlank()) {
            connection.setDisplayName(syncData.displayName());
        }
        connection.setStatus("SYNCING");
        connection = connectionRepository.save(connection);

        List<Transaction> newTransactions = new ArrayList<>();
        int skipped = 0;

        for (PluggyClient.PluggyTransaction providerTransaction : providerTransactions) {
            String externalId = itemId + ":" + providerTransaction.id();
            if (transactionRepository.existsByUserIdAndSourceAndExternalId(userId, SOURCE, externalId)) {
                skipped++;
                continue;
            }
            Transaction transaction = mapTransaction(
                user, connection.getId(), externalId, providerTransaction);
            if (transaction == null) {
                skipped++;
                continue;
            }
            newTransactions.add(transaction);
        }

        categorizationService.categorize(newTransactions);
        transactionRepository.saveAll(newTransactions);
        if (!newTransactions.isEmpty()) {
            ragIngestionService.ingestTransactions(
                userId,
                "OPEN_FINANCE",
                connection.getId().toString(),
                connection.getDisplayName(),
                newTransactions);
        }

        connection.setStatus("CONNECTED");
        connection.setLastSyncAt(Instant.now());
        connectionRepository.save(connection);

        AnalysisResponse analysis = analysisService.analyzeStoredTransactions(
            userId, model, TransactionSource.OPEN_FINANCE_PLUGGY, connection.getId(), null, null);
        return new OpenFinanceSyncResponse(newTransactions.size(), skipped, analysis);
    }

    private Transaction mapTransaction(User user,
                                       UUID importSourceId,
                                       String externalId,
                                       PluggyClient.PluggyTransaction source) {
        TransactionType type = resolveType(source);
        if (type == null || source.amount().signum() == 0) return null;

        Transaction transaction = new Transaction();
        transaction.setUser(user);
        transaction.setExternalId(externalId);
        transaction.setDescription(source.description());
        transaction.setAmount(source.amount().abs());
        transaction.setTransactionDate(source.date());
        transaction.setType(type);
        transaction.setRecurrent(false);
        transaction.setSource(SOURCE);
        transaction.setImportSourceId(importSourceId);
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
