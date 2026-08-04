package com.financeai.backend;

import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.importation.ImportedFile;
import com.financeai.backend.importation.ImportedFileRepository;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionService;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionReclassificationConsistencyTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private TransactionCategoryRepository categoryRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AiServiceClient aiServiceClient;
    @Mock
    private TransactionCategorizationService categorizationService;
    @Mock
    private ImportedFileRepository importedFileRepository;
    @Mock
    private FinancialSourceConsistencyService sourceConsistencyService;
    @InjectMocks
    private TransactionService service;

    @Test
    void shouldRefreshEveryAffectedSourceAfterReclassification() {
        UUID userId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        UUID firstSourceId = UUID.randomUUID();
        UUID secondSourceId = UUID.randomUUID();
        TransactionCategory others = new TransactionCategory();
        others.setId(categoryId);
        Transaction first = transaction(firstSourceId);
        Transaction second = transaction(secondSourceId);
        List<Transaction> transactions = List.of(first, second);
        ImportedFile firstFile = importedFile("primeiro.csv");
        ImportedFile secondFile = importedFile("segundo.csv");

        when(userRepository.findById(userId)).thenReturn(Optional.of(new User()));
        when(categoryRepository.findByCode("OUTROS")).thenReturn(Optional.of(others));
        when(transactionRepository.findByUserIdAndSourceAndCategoryId(
            userId, "CSV_IMPORT", categoryId)).thenReturn(transactions);
        when(categorizationService.categorize(transactions)).thenReturn(
            new TransactionCategorizationService.CategorizationResult(2, 2, "1.1.0"));
        when(importedFileRepository.findByIdAndUserId(firstSourceId, userId))
            .thenReturn(Optional.of(firstFile));
        when(importedFileRepository.findByIdAndUserId(secondSourceId, userId))
            .thenReturn(Optional.of(secondFile));

        service.reclassifyImportedTransactions(userId);

        verify(transactionRepository).saveAllAndFlush(transactions);
        verify(sourceConsistencyService).refresh(
            userId, TransactionSource.CSV_IMPORT, firstSourceId, "primeiro.csv");
        verify(sourceConsistencyService).refresh(
            userId, TransactionSource.CSV_IMPORT, secondSourceId, "segundo.csv");
    }

    private Transaction transaction(UUID sourceId) {
        Transaction transaction = new Transaction();
        transaction.setImportSourceId(sourceId);
        return transaction;
    }

    private ImportedFile importedFile(String name) {
        ImportedFile file = new ImportedFile();
        file.setOriginalName(name);
        return file;
    }
}
