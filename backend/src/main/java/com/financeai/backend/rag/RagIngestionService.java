package com.financeai.backend.rag;

import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.transaction.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class RagIngestionService {

    private static final Logger log = LoggerFactory.getLogger(RagIngestionService.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final RagDocumentRepository ragDocumentRepository;
    private final AiServiceClient aiServiceClient;

    public RagIngestionService(RagDocumentRepository ragDocumentRepository,
                               AiServiceClient aiServiceClient) {
        this.ragDocumentRepository = ragDocumentRepository;
        this.aiServiceClient = aiServiceClient;
    }

    @Transactional
    public void ingestTransactions(UUID userId, String sourceType, String sourceId, List<Transaction> transactions) {
        if (transactions == null || transactions.isEmpty()) {
            return;
        }

        log.info("Ingestando {} transações no repositório RAG do usuário {} (Origem: {}, Id: {})",
                transactions.size(), userId, sourceType, sourceId);

        // Limpa chunks anteriores desta mesma fonte se necessário para reimportação idempotente
        if (sourceId != null && !sourceId.isBlank()) {
            ragDocumentRepository.deleteByUserIdAndSourceTypeAndSourceId(userId, sourceType, sourceId);
        }

        List<RagDocument> docsToSave = new java.util.ArrayList<>(transactions.size());
        for (Transaction txn : transactions) {
            String chunkText = formatTransactionToChunk(txn, sourceType);
            String metadataJson = buildMetadataJson(txn, sourceType);

            RagDocument doc = new RagDocument();
            doc.setUserId(userId);
            doc.setSourceType(sourceType);
            doc.setSourceId(sourceId);
            doc.setDocumentChunk(chunkText);
            doc.setMetadata(metadataJson);

            docsToSave.add(doc);
        }
        ragDocumentRepository.saveAll(docsToSave);

        log.info("Ingestão de {} documentos RAG concluída com sucesso para o usuário {}.", docsToSave.size(), userId);
    }

    public int indexStep(UUID userId) {
        if (userId == null) {
            return 0;
        }
        try {
            int count = aiServiceClient.indexRagDocuments(userId.toString());
            log.info("Passo de indexação RAG concluído no pgvector com {} vetores para o usuário {}", count, userId);
            return count;
        } catch (Exception e) {
            log.warn("Falha ao executar passo de indexação RAG para o usuário {}: {}", userId, e.getMessage());
            return 0;
        }
    }

    private String buildMetadataJson(Transaction txn, String sourceType) {
        // Escape description for safe JSON embedding
        String description = txn.getDescription() != null
                ? txn.getDescription().replace("\\", "\\\\").replace("\"", "\\\"")
                : "";
        String dateStr = txn.getTransactionDate() != null
                ? txn.getTransactionDate().format(DATE_FORMATTER)
                : "";
        String categoryId = txn.getCategoryId() != null ? txn.getCategoryId().toString() : "";

        return String.format(
                java.util.Locale.US,
                "{\"transactionId\":\"%s\",\"amount\":%.2f,\"type\":\"%s\",\"source\":\"%s\",\"date\":\"%s\",\"category\":\"%s\",\"description\":\"%s\"}",
                txn.getId() != null ? txn.getId() : "",
                txn.getAmount() != null ? txn.getAmount().doubleValue() : 0.0,
                txn.getType() != null ? txn.getType().name() : "",
                sourceType,
                dateStr,
                categoryId,
                description
        );
    }

    private String formatTransactionToChunk(Transaction txn, String sourceType) {
        String dateStr = txn.getTransactionDate() != null
                ? txn.getTransactionDate().format(DATE_FORMATTER)
                : "Data não informada";

        String typeStr = txn.getType() != null && txn.getType().name().equalsIgnoreCase("EXPENSE")
                ? "Despesa/Saída"
                : "Receita/Entrada";

        return String.format(
                "Transação [%s] em %s: %s no valor de R$ %.2f (Forma de Pagamento: %s, Origem: %s).",
                typeStr,
                dateStr,
                txn.getDescription() != null ? txn.getDescription() : "Sem descrição",
                txn.getAmount() != null ? txn.getAmount().doubleValue() : 0.0,
                txn.getPaymentMethod() != null ? txn.getPaymentMethod() : "Não informado",
                sourceType
        );
    }
}
