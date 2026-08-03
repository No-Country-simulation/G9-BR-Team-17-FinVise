package com.financeai.backend;

import com.financeai.backend.fact.FinancialFactSnapshot;
import com.financeai.backend.fact.FinancialFactSnapshotRepository;
import com.financeai.backend.fact.FinancialFactsPayload;
import com.financeai.backend.rag.RagDocument;
import com.financeai.backend.rag.RagDocumentRepository;
import com.financeai.backend.rag.RagIngestionService;
import com.financeai.backend.rag.RagIndexQueueRepository;
import com.financeai.backend.rag.RagIndexStatus;
import com.financeai.backend.rag.RagIndexStatusCount;
import com.financeai.backend.rag.RagIndexStatusResponse;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private RagIndexQueueRepository ragIndexQueueRepository;

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
            ragIndexQueueRepository);
        lenient().when(ragDocumentRepository.findByUserIdAndSourceTypeAndSourceId(
            any(UUID.class), anyString(), anyString())).thenReturn(List.of());
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
        ragIngestionService.ingestTransactions(userId, sourceType, sourceId, List.of(txn));

        verify(ragDocumentRepository, never())
            .deleteByUserIdAndSourceTypeAndSourceId(userId, sourceType, sourceId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RagDocument>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(ragDocumentRepository).saveAllAndFlush(listCaptor.capture());

        RagDocument savedDoc = listCaptor.getValue().get(0);
        assertThat(listCaptor.getValue())
            .extracting(RagDocument::getChunkType)
            .containsExactlyInAnyOrder(
                "TRANSACTION", "MONTHLY_SUMMARY", "CATEGORY_SUMMARY");
        assertThat(savedDoc.getUserId()).isEqualTo(userId);
        assertThat(savedDoc.getSourceType()).isEqualTo(sourceType);
        assertThat(savedDoc.getSourceId()).isEqualTo(sourceId);
        assertThat(savedDoc.getTransactionId()).isEqualTo(txn.getId());
        assertThat(savedDoc.getChunkKey()).isEqualTo("transaction:" + txn.getId());
        assertThat(savedDoc.getSchemaVersion()).isEqualTo("2.0");
        assertThat(savedDoc.getDocumentChunk())
                .contains("Transação financeira")
                .contains("Tipo: despesa")
                .contains("15/05/2026")
                .contains("Supermercado Extra")
                .contains("PIX");

        assertThat(savedDoc.getDocumentChunk().contains("150.75") || savedDoc.getDocumentChunk().contains("150,75")).isTrue();
        verify(ragIndexQueueRepository).enqueue(userId);
    }

    @Test
    void shouldLimitManualIndexStepToOneBatch() {
        UUID userId = UUID.randomUUID();
        when(aiServiceClient.indexRagBatchOrThrow(userId.toString(), List.of("fonte-123")))
            .thenReturn(new AiServiceClient.RagIndexResponse(200, userId.toString(), true));

        int indexed = ragIngestionService.indexStep(userId, List.of("fonte-123"));

        assertThat(indexed).isEqualTo(200);
        verify(aiServiceClient).indexRagBatchOrThrow(
            userId.toString(), List.of("fonte-123"));
    }

    @Test
    void shouldUpdateChangedTransactionAndInvalidateItsEmbedding() {
        UUID userId = UUID.randomUUID();
        UUID transactionId = UUID.randomUUID();
        String sourceType = "OPEN_FINANCE";
        String sourceId = "connection-123";
        Transaction transaction = new Transaction();
        transaction.setId(transactionId);
        transaction.setDescription("Compra atualizada");
        transaction.setAmount(new BigDecimal("75.00"));
        transaction.setTransactionDate(LocalDate.of(2026, 7, 30));
        transaction.setType(TransactionType.EXPENSE);

        RagDocument existing = new RagDocument();
        existing.setUserId(userId);
        existing.setSourceType(sourceType);
        existing.setSourceId(sourceId);
        existing.setTransactionId(transactionId);
        existing.setChunkType("TRANSACTION");
        existing.setChunkKey("transaction:" + transactionId);
        existing.setSchemaVersion("2.0");
        existing.setContentHash("conteudo-antigo");
        existing.setDocumentChunk("Conteúdo antigo");
        existing.setMetadata("{}");
        existing.setEmbeddingModel("text-embedding-3-small");
        existing.setIndexStatus(RagIndexStatus.INDEXED);
        when(ragDocumentRepository.findByUserIdAndSourceTypeAndSourceId(
            userId, sourceType, sourceId)).thenReturn(List.of(existing));

        ragIngestionService.ingestTransactions(
            userId, sourceType, sourceId, List.of(transaction));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RagDocument>> documents = ArgumentCaptor.forClass(List.class);
        verify(ragDocumentRepository).saveAllAndFlush(documents.capture());
        assertThat(documents.getValue())
            .filteredOn(document -> ("transaction:" + transactionId)
                .equals(document.getChunkKey()))
            .singleElement()
            .satisfies(document -> {
                assertThat(document.getId()).isEqualTo(existing.getId());
                assertThat(document.getDocumentChunk()).contains("Compra atualizada");
                assertThat(document.getEmbeddingModel()).isNull();
                assertThat(document.getIndexStatus()).isEqualTo(RagIndexStatus.PENDING);
            });
        verify(ragIndexQueueRepository).enqueue(userId);
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
        verify(ragDocumentRepository).saveAllAndFlush(documents.capture());

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
        when(ragDocumentRepository.summarizeIndexStatusByUserIdAndSourceIdIn(
            userId, sourceIds)).thenReturn(List.of(
                new RagIndexStatusCount(RagIndexStatus.PENDING, 1L),
                new RagIndexStatusCount(RagIndexStatus.PROCESSING, 1L),
                new RagIndexStatusCount(RagIndexStatus.INDEXED, 3L)
            ));

        RagIndexStatusResponse response =
            ragIngestionService.indexStatus(userId, sourceIds);

        assertThat(response.status()).isEqualTo("PROCESSING");
        assertThat(response.totalDocuments()).isEqualTo(5);
        assertThat(response.pendingDocuments()).isEqualTo(1);
        assertThat(response.processingDocuments()).isEqualTo(1);
        assertThat(response.indexedDocuments()).isEqualTo(3);
        assertThat(response.failedDocuments()).isZero();
        verify(ragDocumentRepository, times(1))
            .summarizeIndexStatusByUserIdAndSourceIdIn(userId, sourceIds);
    }

    @Test
    void shouldNotReportCompleteWhenIndexingFailed() {
        UUID userId = UUID.randomUUID();
        when(ragDocumentRepository.summarizeIndexStatusByUserId(userId))
            .thenReturn(List.of(
                new RagIndexStatusCount(RagIndexStatus.INDEXED, 3L),
                new RagIndexStatusCount(RagIndexStatus.FAILED, 1L)
            ));

        RagIndexStatusResponse response =
            ragIngestionService.indexStatus(userId, List.of());

        assertThat(response.status()).isEqualTo("FAILED");
        assertThat(response.failedDocuments()).isEqualTo(1);
        verify(ragDocumentRepository, times(1)).summarizeIndexStatusByUserId(userId);
    }

    @Test
    void shouldOnlyAddNewTransactionChunkOnIncrementalIngestion() {
        UUID userId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        Transaction first = transaction(
            "Compra inicial", "40.00", LocalDate.of(2026, 7, 1));
        Transaction second = transaction(
            "Compra incremental", "75.00", LocalDate.of(2026, 7, 30));

        when(transactionRepository
            .findByUserIdAndImportSourceIdOrderByTransactionDateDesc(userId, sourceId))
            .thenReturn(List.of(first), List.of(second, first));

        ragIngestionService.ingestTransactions(
            userId,
            "OPEN_FINANCE",
            sourceId.toString(),
            "Conta principal",
            List.of(first)
        );

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RagDocument>> batches = ArgumentCaptor.forClass(List.class);
        verify(ragDocumentRepository).saveAllAndFlush(batches.capture());
        List<RagDocument> firstBatch = batches.getValue();
        when(ragDocumentRepository.findByUserIdAndSourceTypeAndSourceId(
            userId, "OPEN_FINANCE", sourceId.toString())).thenReturn(firstBatch);
        clearInvocations(ragDocumentRepository);

        ragIngestionService.ingestTransactions(
            userId,
            "OPEN_FINANCE",
            sourceId.toString(),
            "Conta principal",
            List.of(second)
        );

        verify(ragDocumentRepository).saveAllAndFlush(batches.capture());
        List<RagDocument> incrementalBatch = batches.getValue();

        assertThat(firstBatch)
            .filteredOn(document -> "TRANSACTION".equals(document.getChunkType()))
            .extracting(RagDocument::getTransactionId)
            .containsExactly(first.getId());
        assertThat(incrementalBatch)
            .filteredOn(document -> "TRANSACTION".equals(document.getChunkType()))
            .extracting(RagDocument::getTransactionId)
            .containsExactly(second.getId());
        assertThat(incrementalBatch)
            .filteredOn(document -> "MONTHLY_SUMMARY".equals(document.getChunkType()))
            .singleElement()
            .satisfies(document -> {
                assertThat(document.getDocumentChunk())
                    .contains("Quantidade de transações: 2");
                assertThat(document.getIndexStatus()).isEqualTo(RagIndexStatus.PENDING);
            });
        verify(ragIndexQueueRepository, times(2)).enqueue(userId);
    }

    @Test
    void shouldPreserveUnchangedChunksWithoutCreatingAnotherJob() {
        UUID userId = UUID.randomUUID();
        String sourceId = "fonte-legada";
        Transaction transaction = transaction(
            "Compra estável", "50.00", LocalDate.of(2026, 7, 10));

        ragIngestionService.ingestTransactions(
            userId, "CSV_IMPORT", sourceId, "extrato.csv", List.of(transaction));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RagDocument>> documents = ArgumentCaptor.forClass(List.class);
        verify(ragDocumentRepository).saveAllAndFlush(documents.capture());
        when(ragDocumentRepository.findByUserIdAndSourceTypeAndSourceId(
            userId, "CSV_IMPORT", sourceId)).thenReturn(documents.getValue());
        clearInvocations(ragDocumentRepository, ragIndexQueueRepository);

        ragIngestionService.ingestTransactions(
            userId, "CSV_IMPORT", sourceId, "extrato.csv", List.of(transaction));

        verify(ragDocumentRepository, never()).saveAllAndFlush(any());
        verify(ragDocumentRepository, never()).deleteAll(anyCollection());
        verifyNoInteractions(ragIndexQueueRepository);
    }

    @Test
    void shouldDeleteOnlyChunksThatAreNoLongerPartOfTheSource() {
        UUID userId = UUID.randomUUID();
        String sourceId = "fonte-atualizada";
        Transaction transaction = transaction(
            "Compra nova", "90.00", LocalDate.of(2026, 8, 10));
        RagDocument stale = new RagDocument();
        stale.setChunkKey("monthly-summary:2026-07");
        stale.setSchemaVersion("2.0");
        stale.setContentHash("antigo");
        when(ragDocumentRepository.findByUserIdAndSourceTypeAndSourceId(
            userId, "CSV_IMPORT", sourceId)).thenReturn(List.of(stale));

        ragIngestionService.ingestTransactions(
            userId, "CSV_IMPORT", sourceId, "extrato.csv", List.of(transaction));

        var ordered = inOrder(ragDocumentRepository, ragIndexQueueRepository);
        ordered.verify(ragDocumentRepository).saveAllAndFlush(anyList());
        ordered.verify(ragDocumentRepository).deleteAll(anyCollection());
        ordered.verify(ragIndexQueueRepository).enqueue(userId);
        verify(ragDocumentRepository).deleteAll(argThat(documents ->
            documents.iterator().next() == stale));
    }

    private Transaction transaction(String description,
                                    String amount,
                                    LocalDate date) {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setDescription(description);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setTransactionDate(date);
        transaction.setType(TransactionType.EXPENSE);
        return transaction;
    }
}
