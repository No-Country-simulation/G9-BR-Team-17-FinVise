package com.financeai.backend;

import com.financeai.backend.fact.FinancialFactSnapshotRepository;
import com.financeai.backend.fact.FinancialFactsService;
import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.rag.RagDocumentRepository;
import com.financeai.backend.rag.RagIngestionService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinancialSourceConsistencyServiceTest {

    @Mock
    private FinancialFactsService financialFactsService;
    @Mock
    private FinancialFactSnapshotRepository snapshotRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private RagIngestionService ragIngestionService;
    @Mock
    private RagDocumentRepository ragDocumentRepository;
    @InjectMocks
    private FinancialSourceConsistencyService service;

    @Test
    void shouldRebuildSnapshotBeforeReconcilingRagDocuments() {
        UUID userId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        List<Transaction> transactions = List.of(new Transaction());
        when(transactionRepository
            .findByUserIdAndImportSourceIdOrderByTransactionDateDesc(userId, sourceId))
            .thenReturn(transactions);

        service.refresh(userId, TransactionSource.CSV_IMPORT, sourceId, "extrato.csv");

        var ordered = inOrder(financialFactsService, transactionRepository, ragIngestionService);
        ordered.verify(financialFactsService)
            .rebuild(userId, TransactionSource.CSV_IMPORT, sourceId);
        ordered.verify(transactionRepository)
            .findByUserIdAndImportSourceIdOrderByTransactionDateDesc(userId, sourceId);
        ordered.verify(ragIngestionService).ingestTransactions(
            userId, "CSV_IMPORT", sourceId.toString(), "extrato.csv", transactions);
    }

    @Test
    void shouldRemoveSnapshotAndRagDocumentsForOpenFinanceSource() {
        UUID userId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();

        service.removeDerivedData(
            userId, TransactionSource.OPEN_FINANCE_PLUGGY, sourceId);

        verify(snapshotRepository).deleteByUserIdAndSourceTypeAndSourceId(
            userId, "OPEN_FINANCE_PLUGGY", sourceId);
        verify(ragDocumentRepository).deleteByUserIdAndSourceTypeAndSourceId(
            userId, "OPEN_FINANCE", sourceId.toString());
    }
}
