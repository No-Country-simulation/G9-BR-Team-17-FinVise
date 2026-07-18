package com.financeai.backend;

import com.financeai.backend.importation.ImportSourceService;
import com.financeai.backend.importation.ImportSourceType;
import com.financeai.backend.importation.ImportedFile;
import com.financeai.backend.importation.ImportedFileRepository;
import com.financeai.backend.integration.objectstorage.ObjectStorageService;
import com.financeai.backend.openfinance.OpenFinanceConnectionRepository;
import com.financeai.backend.transaction.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImportSourceServiceTest {
    @Mock
    private ImportedFileRepository importedFileRepository;
    @Mock
    private OpenFinanceConnectionRepository connectionRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private ObjectStorageService objectStorageService;
    @InjectMocks
    private ImportSourceService service;

    @Test
    void shouldSetCsvAsTheOnlyDefaultSource() {
        UUID userId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        ImportedFile file = new ImportedFile();
        when(importedFileRepository.findByIdAndUserId(sourceId, userId))
            .thenReturn(Optional.of(file));

        service.setDefault(userId, ImportSourceType.CSV, sourceId);

        verify(importedFileRepository).clearDefaultForUser(userId);
        verify(connectionRepository).clearDefaultForUser(userId);
        verify(importedFileRepository).save(file);
        assertThat(file.getDefaultSource()).isTrue();
    }

    @Test
    void shouldDeleteCsvAndItsIndexedTransactions() {
        UUID userId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        ImportedFile file = new ImportedFile();
        file.setStoredName("stored.csv");
        when(importedFileRepository.findByIdAndUserId(sourceId, userId))
            .thenReturn(Optional.of(file));

        service.delete(userId, ImportSourceType.CSV, sourceId);

        verify(transactionRepository).deleteByUserIdAndImportSourceId(userId, sourceId);
        verify(objectStorageService).delete("stored.csv");
        verify(importedFileRepository).delete(file);
    }
}
