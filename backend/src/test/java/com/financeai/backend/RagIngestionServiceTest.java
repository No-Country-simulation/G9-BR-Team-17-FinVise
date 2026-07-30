package com.financeai.backend;

import com.financeai.backend.fact.FinancialFactSnapshot;
import com.financeai.backend.fact.FinancialFactSnapshotRepository;
import com.financeai.backend.fact.FinancialFactsPayload;
import com.financeai.backend.rag.RagDocument;
import com.financeai.backend.rag.RagDocumentRepository;
import com.financeai.backend.rag.RagIngestionService;
import com.financeai.backend.rag.RagIndexStatus;
import com.financeai.backend.rag.RagIndexStatusResponse;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.financeai.backend.integration.ai.AiServiceClient;

@ExtendWith(MockitoExtension.class)
class RagIngestionServiceTest {

    @Mock
    private RagDocumentRepository ragDocumentRepository;

    @Mock
    private AiServiceClient aiServiceClient;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private TransactionCategoryRepository categoryRepository;

    @Mock
    private FinancialFactSnapshotRepository financialFactSnapshotRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private RagIngestionService ragIngestionService;

    @BeforeEach
    void setUp() {
        ragIngestionService = new RagIngestionService(
            ragDocumentRepository,
            aiServiceClient,
            transactionRepository,
            categoryRepository,
            financialFactSnapshotRepository,
            new ObjectMapper().findAndRegisterModules(),
            eventPublisher);
    }

    @Test
    @DisplayName("Deve formatar transação e persistir documento RAG com sucesso")
    void shouldFormatAndPersistRagDocument() {
        UUID userId = UUID.randomUUID();
        String sourceType = "CSV_IMPORT";
        String sourceId = "import-123";

        Transaction txn = new Transaction();
        txn.setId(UUID.randomUUID());
        txn.setDescription("Supermercado Extra");
        txn.setAmount(new BigDecimal("150.75"));
        txn.setTransactionDate(LocalDate.of(2026, 5, 15));
        txn.setType(TransactionType.EXPENSE);
        txn.setPaymentMethod("PIX");
        when(ragDocumentRepository.findTransactionIdsBySource(userId, sourceType, sourceId))
            .thenReturn(Set.of());

        ragIngestionService.ingestTransactions(userId, sourceType, sourceId, List.of(txn));

        verify(ragDocumentRepository, never())
            .deleteByUserIdAndSourceTypeAndSourceId(userId, sourceType, sourceId);
        verify(ragDocumentRepository)
            .deleteDerivedChunks(userId, sourceType, sourceId, "TRANSACTION");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RagDocument>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(ragDocumentRepository).saveAll(listCaptor.capture());

        RagDocument savedDoc = listCaptor.getValue().get(0);
        assertThat(listCaptor.getValue())
            .extracting(RagDocument::getChunkType)
            .containsExactlyInAnyOrder(
                "TRANSACTION", "MONTHLY_SUMMARY", "CATEGORY_SUMMARY");
        assertThat(savedDoc.getUserId()).isEqualTo(userId);
        assertThat(savedDoc.getSourceType()).isEqualTo(sourceType);
        assertThat(savedDoc.getSourceId()).isEqualTo(sourceId);
        assertThat(savedDoc.getTransactionId()).isEqualTo(txn.getId());
        assertThat(savedDoc.getDocumentChunk())
                .contains("Transação financeira")
                .contains("Tipo: despesa")
                .contains("15/05/2026")
                .contains("Supermercado Extra")
                .contains("PIX");

        assertThat(savedDoc.getDocumentChunk().contains("150.75") || savedDoc.getDocumentChunk().contains("150,75")).isTrue();
        verify(eventPublisher).publishEvent(any(com.financeai.backend.rag.RagIndexRequestedEvent.class));
    }

    @Test
    void shouldNotDuplicateTransactionsAlreadyIndexedForTheSource() {
        UUID userId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        String sourceType = "OPEN_FINANCE";
        String sourceId = "connection-123";
        Transaction transaction = new Transaction();
        transaction.setId(transactionId);

        when(ragDocumentRepository.findTransactionIdsBySource(userId, sourceType, sourceId))
            .thenReturn(Set.of(transactionId));

        ragIngestionService.ingestTransactions(
            userId, sourceType, sourceId, List.of(transaction));

        verify(ragDocumentRepository, never()).saveAll(any());
    }

    @Test
    void shouldIndexPersistedFinancialFacts() {
        UUID userId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setDescription("Mercado");
        transaction.setAmount(new BigDecimal("250.00"));
        transaction.setTransactionDate(LocalDate.of(2024, 12, 10));
        transaction.setType(TransactionType.EXPENSE);

        FinancialFactsPayload.MonthlyFact month = new FinancialFactsPayload.MonthlyFact(
            YearMonth.of(2024, 12),
            2,
            1,
            1,
            new BigDecimal("3000.00"),
            new BigDecimal("250.00"),
            new BigDecimal("2750.00"),
            BigDecimal.ZERO
        );
        FinancialFactsPayload facts = new FinancialFactsPayload(
            new FinancialFactsPayload.Overview(
                2,
                1,
                1,
                new BigDecimal("3000.00"),
                new BigDecimal("250.00"),
                new BigDecimal("2750.00"),
                new BigDecimal("3000.00"),
                new BigDecimal("250.00"),
                new BigDecimal("3000.00"),
                new BigDecimal("250.00"),
                0,
                BigDecimal.ZERO
            ),
            List.of(month),
            List.of(new FinancialFactsPayload.CategoryFact(
                "ALIMENTACAO",
                "Alimentação",
                1,
                new BigDecimal("250.00"),
                new BigDecimal("100.00"),
                new BigDecimal("250.00"),
                new BigDecimal("250.00"),
                new BigDecimal("250.00")
            )),
            new FinancialFactsPayload.Rankings(
                month,
                month,
                month,
                month,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
            ),
            new FinancialFactsPayload.DataQuality(0, BigDecimal.ZERO, 1)
        );
        FinancialFactSnapshot snapshot = new FinancialFactSnapshot();
        snapshot.setId(UUID.randomUUID());
        snapshot.setSourceId(sourceId);
        snapshot.setSourceType("CSV_IMPORT");
        snapshot.setSchemaVersion("1.0");
        snapshot.setPeriodStart(LocalDate.of(2024, 12, 1));
        snapshot.setPeriodEnd(LocalDate.of(2024, 12, 31));
        snapshot.setFacts(facts);

        when(ragDocumentRepository.findTransactionIdsBySource(
            userId, "CSV_IMPORT", sourceId.toString())).thenReturn(Set.of());
        when(financialFactSnapshotRepository.findByUserIdAndSourceId(userId, sourceId))
            .thenReturn(Optional.of(snapshot));

        ragIngestionService.ingestTransactions(
            userId,
            "CSV_IMPORT",
            sourceId.toString(),
            "dezembro.csv",
            List.of(transaction)
        );

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RagDocument>> documents = ArgumentCaptor.forClass(List.class);
        verify(ragDocumentRepository).saveAll(documents.capture());

        assertThat(documents.getValue())
            .extracting(RagDocument::getChunkType)
            .contains(
                "FINANCIAL_OVERVIEW",
                "MONTHLY_FACT",
                "CATEGORY_FACT",
                "FINANCIAL_RANKING"
            );
        assertThat(documents.getValue())
            .filteredOn(document -> "FINANCIAL_RANKING".equals(document.getChunkType()))
            .singleElement()
            .extracting(RagDocument::getDocumentChunk)
            .asString()
            .contains("Maior saldo mensal")
            .contains("dezembro de 2024");
    }

    @Test
    void shouldReportProcessingWhileDocumentsArePending() {
        UUID userId = UUID.randomUUID();
        List<String> sourceIds = List.of("arquivo-1");
        when(ragDocumentRepository.countByUserIdAndSourceIdIn(userId, sourceIds))
            .thenReturn(5L);
        when(ragDocumentRepository.countByUserIdAndSourceIdInAndIndexStatus(
            eq(userId), eq(sourceIds), any(RagIndexStatus.class)))
            .thenAnswer(invocation -> switch (
                invocation.getArgument(2, RagIndexStatus.class)) {
                case PENDING, PROCESSING -> 1L;
                case INDEXED -> 3L;
                case FAILED -> 0L;
            });

        RagIndexStatusResponse response =
            ragIngestionService.indexStatus(userId, sourceIds);

        assertThat(response.status()).isEqualTo("PROCESSING");
        assertThat(response.totalDocuments()).isEqualTo(5);
        assertThat(response.pendingDocuments()).isEqualTo(1);
        assertThat(response.processingDocuments()).isEqualTo(1);
        assertThat(response.indexedDocuments()).isEqualTo(3);
        assertThat(response.failedDocuments()).isZero();
    }

    @Test
    void shouldNotReportCompleteWhenIndexingFailed() {
        UUID userId = UUID.randomUUID();
        when(ragDocumentRepository.countByUserId(userId)).thenReturn(4L);
        when(ragDocumentRepository.countByUserIdAndIndexStatus(
            eq(userId), any(RagIndexStatus.class)))
            .thenAnswer(invocation -> switch (
                invocation.getArgument(1, RagIndexStatus.class)) {
                case INDEXED -> 3L;
                case FAILED -> 1L;
                case PENDING, PROCESSING -> 0L;
            });

        RagIndexStatusResponse response =
            ragIngestionService.indexStatus(userId, List.of());

        assertThat(response.status()).isEqualTo("FAILED");
        assertThat(response.failedDocuments()).isEqualTo(1);
    }
}
