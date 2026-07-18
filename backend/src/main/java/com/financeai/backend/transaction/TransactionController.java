package com.financeai.backend.transaction;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public TransactionController(TransactionService transactionService,
                                 AuthenticatedUserProvider authenticatedUserProvider) {
        this.transactionService = transactionService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<TransactionPageResponse>> getTransactions(
        @RequestParam(name = "type", required = false) TransactionType type,
        @RequestParam(name = "source", required = false) TransactionSource source,
        @RequestParam(name = "importSourceId", required = false) UUID importSourceId,
        @RequestParam(name = "category", required = false) String category,
        @RequestParam(name = "startDate", required = false) LocalDate startDate,
        @RequestParam(name = "endDate", required = false) LocalDate endDate,
        @RequestParam(name = "page", defaultValue = "0") int page,
        @RequestParam(name = "size", defaultValue = "50") int size) {
        UUID effectiveUserId = authenticatedUserProvider.getUserId();
        return ResponseEntity.ok(ApiResponse.success(transactionService.getTransactions(
            effectiveUserId, type, source, importSourceId, category, startDate, endDate, page, size)));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<TransactionSummaryResponse>> getSummary(
        @RequestParam(name = "source", required = false) TransactionSource source,
        @RequestParam(name = "importSourceId", required = false) UUID importSourceId) {
        UUID effectiveUserId = authenticatedUserProvider.getUserId();
        return ResponseEntity.ok(ApiResponse.success(
            transactionService.getSummary(effectiveUserId, source, importSourceId)));
    }

    @GetMapping("/monthly-summary")
    public ResponseEntity<ApiResponse<java.util.List<MonthlyTransactionSummaryResponse>>> getMonthlySummary(
        @RequestParam(name = "source") TransactionSource source,
        @RequestParam(name = "importSourceId", required = false) UUID importSourceId) {
        UUID effectiveUserId = authenticatedUserProvider.getUserId();
        return ResponseEntity.ok(ApiResponse.success(
            transactionService.getMonthlySummary(effectiveUserId, source, importSourceId)));
    }

    @GetMapping("/category-summary")
    public ResponseEntity<ApiResponse<java.util.List<CategorySpendingResponse>>> getCategorySummary(
        @RequestParam(name = "source") TransactionSource source,
        @RequestParam(name = "importSourceId", required = false) UUID importSourceId) {
        UUID effectiveUserId = authenticatedUserProvider.getUserId();
        return ResponseEntity.ok(ApiResponse.success(
            transactionService.getCategorySummary(effectiveUserId, source, importSourceId)));
    }

    @PostMapping("/reclassify-imported")
    public ResponseEntity<ApiResponse<TransactionReclassificationResponse>> reclassifyImported() {
        UUID effectiveUserId = authenticatedUserProvider.getUserId();
        return ResponseEntity.ok(ApiResponse.success(
            transactionService.reclassifyImportedTransactions(effectiveUserId)));
    }

    @PostMapping("/classify")
    public ResponseEntity<ApiResponse<TransactionClassificationResponse>> classify(
        @Valid @RequestBody ClassifyTransactionsRequest request) {
        UUID effectiveUserId = authenticatedUserProvider.getUserId();
        TransactionClassificationResponse response = transactionService.classifyTransactions(effectiveUserId, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
