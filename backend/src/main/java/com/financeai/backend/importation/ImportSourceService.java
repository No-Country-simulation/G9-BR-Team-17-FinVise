package com.financeai.backend.importation;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.integration.objectstorage.ObjectStorageService;
import com.financeai.backend.openfinance.OpenFinanceConnection;
import com.financeai.backend.openfinance.OpenFinanceConnectionRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class ImportSourceService {
    private static final String OPEN_FINANCE_SOURCE = "OPEN_FINANCE_PLUGGY";

    private final ImportedFileRepository importedFileRepository;
    private final OpenFinanceConnectionRepository connectionRepository;
    private final TransactionRepository transactionRepository;
    private final FinancialSourceConsistencyService sourceConsistencyService;
    private final ObjectStorageService objectStorageService;

    public ImportSourceService(ImportedFileRepository importedFileRepository,
                               OpenFinanceConnectionRepository connectionRepository,
                               TransactionRepository transactionRepository,
                               FinancialSourceConsistencyService sourceConsistencyService,
                               ObjectStorageService objectStorageService) {
        this.importedFileRepository = importedFileRepository;
        this.connectionRepository = connectionRepository;
        this.transactionRepository = transactionRepository;
        this.sourceConsistencyService = sourceConsistencyService;
        this.objectStorageService = objectStorageService;
    }

    @Transactional(readOnly = true)
    public List<ImportSourceResponse> list(UUID userId) {
        List<ImportSourceResponse> sources = new ArrayList<>();

        importedFileRepository.findByUserIdOrderByCreatedAtDesc(userId).forEach(file ->
            sources.add(new ImportSourceResponse(
                file.getId(),
                "CSV",
                file.getOriginalName(),
                null,
                file.getStatus().name(),
                value(file.getProcessedCount()),
                value(file.getCategorizedCount()),
                file.getSizeBytes(),
                file.getCreatedAt(),
                file.getUpdatedAt(),
                file.getErrorMessage(),
                Boolean.TRUE.equals(file.getDefaultSource())
            ))
        );

        connectionRepository.findByUserIdOrderByCreatedAtDesc(userId).forEach(connection -> {
            long transactionCount = transactionRepository.countByOpenFinanceItem(
                userId, OPEN_FINANCE_SOURCE, connection.getExternalItemId());
            sources.add(new ImportSourceResponse(
                connection.getId(),
                "OPEN_FINANCE",
                displayName(connection.getDisplayName(), connection.getExternalItemId()),
                connection.getProvider(),
                connection.getStatus(),
                transactionCount,
                transactionCount,
                null,
                connection.getCreatedAt(),
                connection.getLastSyncAt(),
                null,
                Boolean.TRUE.equals(connection.getDefaultSource())
            ));
        });

        sources.sort(Comparator.comparing(ImportSourceResponse::createdAt).reversed());
        return sources;
    }

    @Transactional
    public void setDefault(UUID userId, ImportSourceType type, UUID sourceId) {
        importedFileRepository.clearDefaultForUser(userId);
        connectionRepository.clearDefaultForUser(userId);

        if (type == ImportSourceType.CSV) {
            ImportedFile file = importedFileRepository.findByIdAndUserId(sourceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Arquivo importado", sourceId));
            file.setDefaultSource(true);
            importedFileRepository.save(file);
            return;
        }

        OpenFinanceConnection connection = connectionRepository.findByIdAndUserId(sourceId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Conta Open Finance", sourceId));
        connection.setDefaultSource(true);
        connectionRepository.save(connection);
    }

    @Transactional
    public void delete(UUID userId, ImportSourceType type, UUID sourceId) {
        if (type == ImportSourceType.CSV) {
            ImportedFile file = importedFileRepository.findByIdAndUserId(sourceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Arquivo importado", sourceId));
            transactionRepository.deleteByUserIdAndImportSourceId(userId, sourceId);
            sourceConsistencyService.removeDerivedData(
                userId, TransactionSource.CSV_IMPORT, sourceId);
            objectStorageService.delete(file.getStoredName());
            importedFileRepository.delete(file);
            return;
        }

        OpenFinanceConnection connection = connectionRepository.findByIdAndUserId(sourceId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Conta Open Finance", sourceId));
        transactionRepository.deleteByUserIdAndImportSourceId(userId, sourceId);
        sourceConsistencyService.removeDerivedData(
            userId, TransactionSource.OPEN_FINANCE_PLUGGY, sourceId);
        connectionRepository.delete(connection);
    }

    private long value(Integer count) {
        return count != null ? count.longValue() : 0L;
    }

    private String displayName(String displayName, String externalItemId) {
        if (displayName != null && !displayName.isBlank()) return displayName;
        String suffix = externalItemId.length() > 6
            ? externalItemId.substring(externalItemId.length() - 6)
            : externalItemId;
        return "Conta Open Finance • " + suffix;
    }
}
