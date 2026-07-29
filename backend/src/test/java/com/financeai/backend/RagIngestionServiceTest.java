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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RagIngestionServiceTest {

    @Mock
    private RagDocumentRepository ragDocumentRepository;

    private RagIngestionService ragIngestionService;

    @BeforeEach
    void setUp() {
        ragIngestionService = new RagIngestionService(ragDocumentRepository);
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

        verify(ragDocumentRepository).deleteByUserIdAndSourceTypeAndSourceId(userId, sourceType, sourceId);

        ArgumentCaptor<RagDocument> docCaptor = ArgumentCaptor.forClass(RagDocument.class);
        verify(ragDocumentRepository).save(docCaptor.capture());

        RagDocument savedDoc = docCaptor.getValue();
        assertThat(savedDoc.getUserId()).isEqualTo(userId);
        assertThat(savedDoc.getSourceType()).isEqualTo(sourceType);
        assertThat(savedDoc.getSourceId()).isEqualTo(sourceId);
        assertThat(savedDoc.getDocumentChunk())
                .contains("Transação [Despesa/Saída]")
                .contains("15/05/2026")
                .contains("Supermercado Extra")
                .contains("PIX");

        assertThat(savedDoc.getDocumentChunk().contains("150.75") || savedDoc.getDocumentChunk().contains("150,75")).isTrue();
    }
}
