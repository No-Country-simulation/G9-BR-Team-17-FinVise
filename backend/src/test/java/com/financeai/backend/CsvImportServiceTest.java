package com.financeai.backend;

import com.financeai.backend.importation.*;
import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.integration.objectstorage.ObjectStorageService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
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
    private TransactionCategorizationService categorizationService;
    @Mock
    private ImportedFileRepository importedFileRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ObjectStorageService objectStorageService;
    @Mock
    private CsvImportPersistenceService persistenceService;
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
        lenient().when(persistenceService.persist(
            any(), anyString(), anyString(), anyLong(), anyString(), anyList(), any(), anyList()
        )).thenAnswer(invocation -> {
            List<Transaction> transactions = invocation.getArgument(5);
            TransactionCategorizationService.CategorizationResult categorization =
                invocation.getArgument(6);
            List<String> errors = invocation.getArgument(7);
            return new ImportResultResponse(
                UUID.randomUUID(),
                invocation.getArgument(1),
                invocation.getArgument(2),
                ImportStatus.COMPLETED,
                transactions.size(),
                categorization.categorizedCount(),
                categorization.modelVersion(),
                errors);
        });
    }

    @Test
    void shouldImportValidCsv() throws Exception {
        // given
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(objectStorageService.store(any(InputStream.class), anyString(), anyLong())).thenReturn("stored.csv");

        MultipartFile file = new MockMultipartFile("file", "transacoes.csv", "text/csv", csvContent().getBytes(StandardCharsets.UTF_8));

        // when
        ImportResultResponse result = csvImportService.importTransactionsCsv(userId, file);

        // then
        assertThat(result.status()).isEqualTo(ImportStatus.COMPLETED);
        assertThat(result.processedCount()).isEqualTo(2);
        assertThat(result.errors()).isEmpty();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Transaction>> transactionCaptor = ArgumentCaptor.forClass(List.class);
        verify(persistenceService).persist(
            eq(userId), eq("transacoes.csv"), eq("stored.csv"), anyLong(),
            anyString(), transactionCaptor.capture(), any(), anyList());
        assertThat(transactionCaptor.getValue())
            .allMatch(t -> t.getUser() == null && t.getImportSourceId() == null);
        assertThat(transactionCaptor.getValue())
            .anyMatch(t -> "Supermercado".equals(t.getDescription()));
        verify(objectStorageService, never()).retrieve(anyString());
    }

    @Test
    void shouldReportErrorsForInvalidCsv() throws Exception {
        // given
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(objectStorageService.store(any(InputStream.class), anyString(), anyLong())).thenReturn("stored.csv");

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

        verifyNoInteractions(objectStorageService, persistenceService);
    }

    @Test
    void shouldImportFileWithOnlyExpensesWithoutCreatingAnImplicitAnalysis() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(objectStorageService.store(any(InputStream.class), anyString(), anyLong()))
            .thenReturn("stored.csv");
        String content = expenseOnlyCsvContent();
        MultipartFile file = new MockMultipartFile(
            "file", "despesas.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8));

        ImportResultResponse result = csvImportService.importTransactionsCsv(userId, file);

        assertThat(result.status()).isEqualTo(ImportStatus.COMPLETED);
        assertThat(result.processedCount()).isEqualTo(1);
        verify(persistenceService).persist(
            eq(userId), eq("despesas.csv"), eq("stored.csv"), anyLong(),
            anyString(), anyList(), any(), anyList());
    }

    @Test
    void shouldDeleteStoredFileWhenDatabasePersistenceFails() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(objectStorageService.store(any(InputStream.class), anyString(), anyLong()))
            .thenReturn("stored.csv");
        doThrow(new IllegalStateException("database unavailable"))
            .when(persistenceService).persist(
                any(), anyString(), anyString(), anyLong(), anyString(),
                anyList(), any(), anyList());
        MultipartFile file = new MockMultipartFile(
            "file", "transacoes.csv", "text/csv",
            csvContent().getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> csvImportService.importTransactionsCsv(userId, file))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("database unavailable");

        verify(objectStorageService).delete("stored.csv");
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

    private String expenseOnlyCsvContent() {
        return "description,amount,date,type,payment_method,recurrent\n" +
               "Aluguel,1200.00,2024-01-05,EXPENSE,BOLETO,true\n";
    }
}
