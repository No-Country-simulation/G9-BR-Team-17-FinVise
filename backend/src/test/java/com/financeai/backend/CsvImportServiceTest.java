package com.financeai.backend;

import com.financeai.backend.importation.*;
import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.integration.objectstorage.ObjectStorageService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CsvImportServiceTest {

    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private TransactionCategorizationService categorizationService;
    @Mock
    private ImportedFileRepository importedFileRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ObjectStorageService objectStorageService;

    @InjectMocks
    private CsvImportService csvImportService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = new User();
        user.setId(userId);
        user.setEmail("test@example.com");
        user.setName("Test");
        user.setPasswordHash("hash");

        lenient().when(categorizationService.categorize(anyList())).thenAnswer(invocation -> {
            List<Transaction> transactions = invocation.getArgument(0);
            return new TransactionCategorizationService.CategorizationResult(
                transactions.size(), transactions.size(), "FALLBACK");
        });
    }

    @Test
    void shouldImportValidCsv() throws Exception {
        // given
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(objectStorageService.store(any(InputStream.class), anyString(), anyLong())).thenReturn("stored.csv");
        when(objectStorageService.retrieve("stored.csv")).thenReturn(new ByteArrayInputStream(csvContent().getBytes(StandardCharsets.UTF_8)));
        when(importedFileRepository.save(any(ImportedFile.class))).thenAnswer(invocation -> {
            ImportedFile file = invocation.getArgument(0);
            if (file.getId() == null) {
                file.setId(UUID.randomUUID());
            }
            return file;
        });
        when(transactionRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        MultipartFile file = new MockMultipartFile("file", "transacoes.csv", "text/csv", csvContent().getBytes(StandardCharsets.UTF_8));

        // when
        ImportResultResponse result = csvImportService.importTransactionsCsv(userId, file);

        // then
        assertThat(result.status()).isEqualTo(ImportStatus.COMPLETED);
        assertThat(result.processedCount()).isEqualTo(2);
        assertThat(result.errors()).isEmpty();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Transaction>> transactionCaptor = ArgumentCaptor.forClass(List.class);
        verify(transactionRepository).saveAll(transactionCaptor.capture());
        assertThat(transactionCaptor.getValue())
            .allMatch(t -> t.getUser().getId().equals(userId));
        assertThat(transactionCaptor.getValue())
            .anyMatch(t -> "Supermercado".equals(t.getDescription()));

        ArgumentCaptor<ImportedFile> importedFileCaptor = ArgumentCaptor.forClass(ImportedFile.class);
        verify(importedFileRepository, atLeast(2)).save(importedFileCaptor.capture());
        assertThat(importedFileCaptor.getAllValues())
            .anyMatch(imported -> imported.getProcessedCount() == 2
                && imported.getCategorizedCount() == 2);
    }

    @Test
    void shouldReportErrorsForInvalidCsv() throws Exception {
        // given
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(objectStorageService.store(any(InputStream.class), anyString(), anyLong())).thenReturn("stored.csv");
        when(objectStorageService.retrieve("stored.csv")).thenReturn(new ByteArrayInputStream(invalidCsvContent().getBytes(StandardCharsets.UTF_8)));
        when(importedFileRepository.save(any(ImportedFile.class))).thenAnswer(invocation -> {
            ImportedFile file = invocation.getArgument(0);
            if (file.getId() == null) {
                file.setId(UUID.randomUUID());
            }
            return file;
        });
        when(transactionRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        MultipartFile file = new MockMultipartFile("file", "invalido.csv", "text/csv", invalidCsvContent().getBytes(StandardCharsets.UTF_8));

        // when
        ImportResultResponse result = csvImportService.importTransactionsCsv(userId, file);

        // then
        assertThat(result.status()).isEqualTo(ImportStatus.COMPLETED);
        assertThat(result.processedCount()).isEqualTo(1);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).containsIgnoringCase("Linha 3");
    }

    @Test
    void shouldRejectTheSameCsvContentForTheSameUser() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(importedFileRepository.existsByUserIdAndContentHash(eq(userId), anyString()))
            .thenReturn(true);

        MultipartFile file = new MockMultipartFile(
            "file", "transacoes.csv", "text/csv", csvContent().getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> csvImportService.importTransactionsCsv(userId, file))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("mesmo arquivo CSV");

        verifyNoInteractions(objectStorageService, transactionRepository);
    }

    private String csvContent() {
        return "description,amount,date,type,payment_method,recurrent\n" +
               "Salário,5000.00,2024-01-01,INCOME,PIX,false\n" +
               "Supermercado,850.50,2024-01-10,EXPENSE,CARTAO,true\n";
    }

    private String invalidCsvContent() {
        return "description,amount,date,type,payment_method,recurrent\n" +
               "Aluguel,1200.00,2024-01-05,EXPENSE,BOLETO,false\n" +
               ",abc,2024-01-10,EXPENSE,CARTAO,true\n";
    }
}
