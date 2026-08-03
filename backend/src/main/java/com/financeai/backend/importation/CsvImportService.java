package com.financeai.backend.importation;

import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.fact.FinancialSourceConsistencyService;
import com.financeai.backend.integration.objectstorage.ObjectStorageService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class CsvImportService {

    private static final Logger log = LoggerFactory.getLogger(CsvImportService.class);

    private final TransactionRepository transactionRepository;
    private final TransactionCategorizationService categorizationService;
    private final ImportedFileRepository importedFileRepository;
    private final UserRepository userRepository;
    private final ObjectStorageService objectStorageService;
    private final FinancialSourceConsistencyService sourceConsistencyService;

    public CsvImportService(TransactionRepository transactionRepository,
                            TransactionCategorizationService categorizationService,
                            ImportedFileRepository importedFileRepository,
                            UserRepository userRepository,
                            ObjectStorageService objectStorageService,
                            FinancialSourceConsistencyService sourceConsistencyService) {
        this.transactionRepository = transactionRepository;
        this.categorizationService = categorizationService;
        this.importedFileRepository = importedFileRepository;
        this.userRepository = userRepository;
        this.objectStorageService = objectStorageService;
        this.sourceConsistencyService = sourceConsistencyService;
    }

    @Transactional
    public ImportResultResponse importTransactionsCsv(UUID userId, MultipartFile file) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.csv";
        byte[] fileContent;
        try {
            fileContent = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("FILE_READ_ERROR", "Falha ao ler arquivo enviado", e);
        }

        String contentHash = calculateSha256(fileContent);
        if (importedFileRepository.existsByUserIdAndContentHash(userId, contentHash)) {
            throw new BusinessException(
                "DUPLICATE_FILE",
                "Este mesmo arquivo CSV já foi importado. Nenhuma transação foi duplicada."
            );
        }

        String storedName = objectStorageService.store(
            new ByteArrayInputStream(fileContent), originalName, fileContent.length);

        ImportedFile importedFile = new ImportedFile();
        importedFile.setUser(user);
        importedFile.setOriginalName(originalName);
        importedFile.setStoredName(storedName);
        importedFile.setSizeBytes(file.getSize());
        importedFile.setContentHash(contentHash);
        importedFile.setStatus(ImportStatus.PROCESSING);
        importedFile = importedFileRepository.save(importedFile);

        List<String> errors = new ArrayList<>();
        int processedCount = 0;
        int categorizedCount = 0;
        String classificationModel = "NOT_APPLICABLE";
        List<Transaction> transactions = new ArrayList<>();

        try (InputStream storedData = objectStorageService.retrieve(storedName);
             CSVParser parser = CSVParser.parse(storedData, java.nio.charset.StandardCharsets.UTF_8,
                 CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setTrim(true)
                     .setIgnoreHeaderCase(true)
                     .build())) {

            int lineNumber = 2;
            for (CSVRecord record : parser) {
                try {
                    CsvTransactionRecord csvRecord = parseRecord(record);
                    transactions.add(buildTransaction(user, importedFile.getId(), csvRecord));
                } catch (Exception e) {
                    errors.add("Linha " + lineNumber + ": " + e.getMessage());
                    log.warn("Falha ao importar linha {} do arquivo {}", lineNumber, originalName, e);
                }
                lineNumber++;
            }

            TransactionCategorizationService.CategorizationResult categorization =
                categorizationService.categorize(transactions);
            transactionRepository.saveAllAndFlush(transactions);
            sourceConsistencyService.refresh(
                userId,
                TransactionSource.CSV_IMPORT,
                importedFile.getId(),
                importedFile.getOriginalName());
            processedCount = transactions.size();
            categorizedCount = categorization.categorizedCount();
            classificationModel = categorization.modelVersion();

        } catch (IOException e) {
            importedFile.setStatus(ImportStatus.FAILED);
            importedFile.setErrorMessage(e.getMessage());
            importedFileRepository.save(importedFile);
            throw new BusinessException("CSV_PARSE_ERROR", "Falha ao processar arquivo CSV", e);
        }

        if (errors.isEmpty()) {
            importedFile.setStatus(ImportStatus.COMPLETED);
        } else {
            importedFile.setStatus(ImportStatus.COMPLETED);
            importedFile.setErrorMessage(String.join("; ", errors));
        }
        importedFile.setProcessedCount(processedCount);
        importedFile.setCategorizedCount(categorizedCount);
        importedFileRepository.save(importedFile);

        return new ImportResultResponse(
            importedFile.getId(),
            importedFile.getOriginalName(),
            importedFile.getStoredName(),
            importedFile.getStatus(),
            processedCount,
            categorizedCount,
            classificationModel,
            errors
        );
    }

    private CsvTransactionRecord parseRecord(CSVRecord record) {
        String description = getValue(record, "description");
        if (description == null || description.isBlank()) {
            throw new IllegalArgumentException("Descrição é obrigatória");
        }

        String amountRaw = getValue(record, "amount");
        if (amountRaw == null || amountRaw.isBlank()) {
            throw new IllegalArgumentException("Valor é obrigatório");
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(amountRaw.replace(',', '.'));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Valor inválido: " + amountRaw);
        }

        if (amount.signum() == 0) {
            throw new IllegalArgumentException("Valor deve ser diferente de zero");
        }

        String dateRaw = getValue(record, "date");
        if (dateRaw == null || dateRaw.isBlank()) {
            throw new IllegalArgumentException("Data é obrigatória");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(dateRaw);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Data inválida (esperado ISO): " + dateRaw);
        }

        TransactionType type = parseType(getValue(record, "type"), amount);
        amount = amount.abs();
        String paymentMethod = getValue(record, "payment_method");
        Boolean recurrent = parseBoolean(getValue(record, "recurrent"));

        return new CsvTransactionRecord(description, amount, date, type, paymentMethod, recurrent);
    }

    private Transaction buildTransaction(User user, UUID importSourceId, CsvTransactionRecord record) {
        Transaction transaction = new Transaction();
        transaction.setUser(user);
        transaction.setDescription(record.description());
        transaction.setAmount(record.amount());
        transaction.setTransactionDate(record.date());
        transaction.setType(record.type());
        transaction.setPaymentMethod(record.paymentMethod());
        transaction.setRecurrent(record.recurrent() != null ? record.recurrent() : false);
        transaction.setSource("CSV_IMPORT");
        transaction.setImportSourceId(importSourceId);
        return transaction;
    }

    private String getValue(CSVRecord record, String header) {
        return record.isMapped(header) ? record.get(header) : null;
    }

    private TransactionType parseType(String value, BigDecimal amount) {
        if (value == null || value.isBlank()) {
            return amount.signum() < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        }
        String normalized = value.trim().toUpperCase();
        return switch (normalized) {
            case "INCOME", "RECEITA" -> TransactionType.INCOME;
            case "EXPENSE", "DESPESA" -> TransactionType.EXPENSE;
            default -> throw new IllegalArgumentException("Tipo invalido: " + value);
        };
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = value.trim().toLowerCase();
        return "true".equals(normalized) || "1".equals(normalized) || "yes".equals(normalized) || "sim".equals(normalized);
    }

    private String calculateSha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 não está disponível nesta JVM", e);
        }
    }
}
