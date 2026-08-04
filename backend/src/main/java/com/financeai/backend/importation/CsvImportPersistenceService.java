package com.financeai.backend.importation;

import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CsvImportPersistenceService {

    private final TransactionRepository transactionRepository;
    private final ImportedFileRepository importedFileRepository;
    private final UserRepository userRepository;
    private final FinancialSourceConsistencyService sourceConsistencyService;

    public CsvImportPersistenceService(TransactionRepository transactionRepository,
                                       ImportedFileRepository importedFileRepository,
                                       UserRepository userRepository,
                                       FinancialSourceConsistencyService sourceConsistencyService) {
        this.transactionRepository = transactionRepository;
        this.importedFileRepository = importedFileRepository;
        this.userRepository = userRepository;
        this.sourceConsistencyService = sourceConsistencyService;
    }

    @Transactional
    public ImportResultResponse persist(UUID userId,
                                        String originalName,
                                        String storedName,
                                        long sizeBytes,
                                        String contentHash,
                                        List<Transaction> transactions,
                                        TransactionCategorizationService.CategorizationResult categorization,
                                        List<String> errors) {
        if (importedFileRepository.existsByUserIdAndContentHash(userId, contentHash)) {
            throw duplicateFile();
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        ImportedFile importedFile = new ImportedFile();
        importedFile.setUser(user);
        importedFile.setOriginalName(originalName);
        importedFile.setStoredName(storedName);
        importedFile.setSizeBytes(sizeBytes);
        importedFile.setContentHash(contentHash);
        importedFile.setStatus(ImportStatus.PROCESSING);
        try {
            importedFile = importedFileRepository.saveAndFlush(importedFile);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateFile();
        }

        UUID importSourceId = importedFile.getId();
        transactions.forEach(transaction -> {
            transaction.setUser(user);
            transaction.setImportSourceId(importSourceId);
        });
        transactionRepository.saveAllAndFlush(transactions);
        sourceConsistencyService.refresh(
            userId,
            TransactionSource.CSV_IMPORT,
            importSourceId,
            originalName);

        importedFile.setStatus(ImportStatus.COMPLETED);
        importedFile.setErrorMessage(errors.isEmpty() ? null : String.join("; ", errors));
        importedFile.setProcessedCount(transactions.size());
        importedFile.setCategorizedCount(categorization.categorizedCount());
        importedFileRepository.save(importedFile);

        return new ImportResultResponse(
            importSourceId,
            originalName,
            storedName,
            ImportStatus.COMPLETED,
            transactions.size(),
            categorization.categorizedCount(),
            categorization.modelVersion(),
            errors
        );
    }

    static BusinessException duplicateFile() {
        return new BusinessException(
            "DUPLICATE_FILE",
            "Este mesmo arquivo CSV já foi importado. Nenhuma transação foi duplicada.");
    }
}
