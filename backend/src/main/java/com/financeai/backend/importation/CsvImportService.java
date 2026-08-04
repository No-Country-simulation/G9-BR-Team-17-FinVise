package com.financeai.backend.importation;

import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.integration.objectstorage.ObjectStorageService;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.UserRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
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

    private final TransactionCategorizationService categorizationService;
    private final ImportedFileRepository importedFileRepository;
    private final UserRepository userRepository;
    private final ObjectStorageService objectStorageService;
    private final CsvImportPersistenceService persistenceService;

    public CsvImportService(TransactionCategorizationService categorizationService,
                            ImportedFileRepository importedFileRepository,
                            UserRepository userRepository,
                            ObjectStorageService objectStorageService,
                            CsvImportPersistenceService persistenceService) {
        this.categorizationService = categorizationService;
        this.importedFileRepository = importedFileRepository;
        this.userRepository = userRepository;
        this.objectStorageService = objectStorageService;
        this.persistenceService = persistenceService;
    }

    public ImportResultResponse importTransactionsCsv(UUID userId, MultipartFile file) {
        userRepository.findById(userId)
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
            throw CsvImportPersistenceService.duplicateFile();
        }

        String storedName = objectStorageService.store(
            new ByteArrayInputStream(fileContent), originalName, fileContent.length);
        List<String> errors = new ArrayList<>();
        List<Transaction> transactions = new ArrayList<>();

        try (InputStream csvData = new ByteArrayInputStream(fileContent);
             CSVParser parser = CSVParser.parse(csvData, java.nio.charset.StandardCharsets.UTF_8,
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
                    transactions.add(buildTransaction(csvRecord));
                } catch (Exception e) {
                    errors.add("Linha " + lineNumber + ": " + e.getMessage());
                    log.warn("Falha ao importar linha {} do arquivo {}", lineNumber, originalName, e);
                }
                lineNumber++;
            }

            TransactionCategorizationService.CategorizationResult categorization =
                categorizationService.categorize(transactions);
            return persistenceService.persist(
                userId,
                originalName,
                storedName,
                file.getSize(),
                contentHash,
                transactions,
                categorization,
                List.copyOf(errors));
        } catch (IOException e) {
            cleanupStoredFile(storedName, e);
            throw new BusinessException("CSV_PARSE_ERROR", "Falha ao processar arquivo CSV", e);
        } catch (RuntimeException e) {
            cleanupStoredFile(storedName, e);
            throw e;
        }
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

    private Transaction buildTransaction(CsvTransactionRecord record) {
        Transaction transaction = new Transaction();
        transaction.setDescription(record.description());
        transaction.setAmount(record.amount());
        transaction.setTransactionDate(record.date());
        transaction.setType(record.type());
        transaction.setPaymentMethod(record.paymentMethod());
        transaction.setRecurrent(record.recurrent() != null ? record.recurrent() : false);
        transaction.setSource("CSV_IMPORT");
        return transaction;
    }

    private void cleanupStoredFile(String storedName, Exception originalFailure) {
        try {
            objectStorageService.delete(storedName);
        } catch (RuntimeException cleanupFailure) {
            originalFailure.addSuppressed(cleanupFailure);
            log.error("Falha ao remover arquivo {} após erro na importação", storedName, cleanupFailure);
        }
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
