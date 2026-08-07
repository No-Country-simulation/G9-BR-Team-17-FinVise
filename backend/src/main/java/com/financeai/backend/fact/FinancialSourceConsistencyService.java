package com.financeai.backend.fact;

import com.financeai.backend.analysis.FinancialAnalysisRepository;
import com.financeai.backend.rag.RagDocumentRepository;
import com.financeai.backend.rag.RagIngestionService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Mantém os dados derivados de uma fonte financeira sincronizados com suas transações.
 * Toda mutação persistida deve passar por este serviço na mesma transação de banco.
 */
@Service
public class FinancialSourceConsistencyService {

    private final FinancialFactsService financialFactsService;
    private final FinancialFactSnapshotRepository snapshotRepository;
    private final TransactionRepository transactionRepository;
    private final RagIngestionService ragIngestionService;
    private final RagDocumentRepository ragDocumentRepository;
    private final FinancialAnalysisRepository analysisRepository;

    public FinancialSourceConsistencyService(FinancialFactsService financialFactsService,
                                             FinancialFactSnapshotRepository snapshotRepository,
                                             TransactionRepository transactionRepository,
                                             RagIngestionService ragIngestionService,
                                             RagDocumentRepository ragDocumentRepository,
                                             FinancialAnalysisRepository analysisRepository) {
        this.financialFactsService = financialFactsService;
        this.snapshotRepository = snapshotRepository;
        this.transactionRepository = transactionRepository;
        this.ragIngestionService = ragIngestionService;
        this.ragDocumentRepository = ragDocumentRepository;
        this.analysisRepository = analysisRepository;
    }

    @Transactional
    public void refresh(UUID userId,
                        TransactionSource source,
                        UUID sourceId,
                        String sourceName) {
        financialFactsService.rebuild(userId, source, sourceId);
        List<Transaction> transactions = transactionRepository
            .findByUserIdAndImportSourceIdOrderByTransactionDateDesc(userId, sourceId);
        ragIngestionService.ingestTransactions(
            userId,
            ragSourceType(source),
            sourceId.toString(),
            sourceName,
            transactions);
    }

    @Transactional
    public void removeDerivedData(UUID userId,
                                  TransactionSource source,
                                  UUID sourceId) {
        snapshotRepository.deleteByUserIdAndSourceTypeAndSourceId(
            userId, source.name(), sourceId);
        ragDocumentRepository.deleteByUserIdAndSourceTypeAndSourceId(
            userId, ragSourceType(source), sourceId.toString());
        analysisRepository.deleteByUserIdAndImportSourceId(
            userId, sourceId.toString());
    }

    private String ragSourceType(TransactionSource source) {
        return source == TransactionSource.OPEN_FINANCE_PLUGGY
            ? "OPEN_FINANCE"
            : "CSV_IMPORT";
    }
}
