package com.financeai.backend;

import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.importation.CsvImportPersistenceService;
import com.financeai.backend.importation.ImportResultResponse;
import com.financeai.backend.importation.ImportStatus;
import com.financeai.backend.importation.ImportedFile;
import com.financeai.backend.importation.ImportedFileRepository;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CsvImportPersistenceServiceTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private ImportedFileRepository importedFileRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FinancialSourceConsistencyService sourceConsistencyService;
    @InjectMocks
    private CsvImportPersistenceService service;

    @Test
    void shouldPersistSourceTransactionsAndDerivedDataAtomically() {
        UUID userId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        Transaction transaction = new Transaction();
        ImportedFile importedFile = new ImportedFile();
        importedFile.setId(sourceId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(importedFileRepository.saveAndFlush(any(ImportedFile.class)))
            .thenReturn(importedFile);
        TransactionCategorizationService.CategorizationResult categorization =
            new TransactionCategorizationService.CategorizationResult(1, 1, "model-v1");

        ImportResultResponse response = service.persist(
            userId,
            "transacoes.csv",
            "stored.csv",
            100,
            "hash",
            List.of(transaction),
            categorization,
            List.of());

        assertThat(response.status()).isEqualTo(ImportStatus.COMPLETED);
        assertThat(transaction.getUser()).isSameAs(user);
        assertThat(transaction.getImportSourceId()).isEqualTo(sourceId);
        verify(transactionRepository).saveAllAndFlush(List.of(transaction));
        verify(sourceConsistencyService).refresh(
            userId, TransactionSource.CSV_IMPORT, sourceId, "transacoes.csv");
        verify(importedFileRepository).save(importedFile);
    }

    @Test
    void shouldRejectDuplicateInsideThePersistenceTransaction() {
        UUID userId = UUID.randomUUID();
        when(importedFileRepository.existsByUserIdAndContentHash(userId, "hash"))
            .thenReturn(true);

        assertThatThrownBy(() -> service.persist(
            userId,
            "transacoes.csv",
            "stored.csv",
            100,
            "hash",
            List.of(),
            new TransactionCategorizationService.CategorizationResult(0, 0, "N/A"),
            List.of()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("mesmo arquivo CSV");

        verify(transactionRepository, never()).saveAllAndFlush(any());
        verify(sourceConsistencyService, never()).refresh(any(), any(), any(), any());
    }

    @Test
    void shouldTranslateConcurrentDuplicateConstraint() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(importedFileRepository.saveAndFlush(any(ImportedFile.class)))
            .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.persist(
            userId,
            "transacoes.csv",
            "stored.csv",
            100,
            "hash",
            List.of(),
            new TransactionCategorizationService.CategorizationResult(0, 0, "N/A"),
            List.of()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("mesmo arquivo CSV");
    }
}
