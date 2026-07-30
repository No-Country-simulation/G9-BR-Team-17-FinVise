package com.financeai.backend;

import com.financeai.backend.rag.RagDocument;
import com.financeai.backend.rag.RagDocumentRepository;
import com.financeai.backend.rag.RagIngestionService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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

    private RagIngestionService ragIngestionService;

    @BeforeEach
    void setUp() {
        ragIngestionService = new RagIngestionService(ragDocumentRepository, aiServiceClient);
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

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RagDocument>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(ragDocumentRepository).saveAll(listCaptor.capture());

        RagDocument savedDoc = listCaptor.getValue().get(0);
        assertThat(savedDoc.getUserId()).isEqualTo(userId);
        assertThat(savedDoc.getSourceType()).isEqualTo(sourceType);
        assertThat(savedDoc.getSourceId()).isEqualTo(sourceId);
        assertThat(savedDoc.getTransactionId()).isEqualTo(txn.getId());
        assertThat(savedDoc.getDocumentChunk())
                .contains("Transação [Despesa/Saída]")
                .contains("15/05/2026")
                .contains("Supermercado Extra")
                .contains("PIX");

        assertThat(savedDoc.getDocumentChunk().contains("150.75") || savedDoc.getDocumentChunk().contains("150,75")).isTrue();
    }

    @Test
    void shouldSkipTransactionsAlreadyIndexedForTheSource() {
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
}
