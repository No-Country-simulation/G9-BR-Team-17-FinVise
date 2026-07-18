package com.financeai.backend.report;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportService reportService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public ReportController(ReportService reportService,
                            AuthenticatedUserProvider authenticatedUserProvider) {
        this.reportService = reportService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @GetMapping("/financial/{userId}")
    public ResponseEntity<ApiResponse<FinancialReportDto>> getFinancialReport(@PathVariable UUID userId) {
        FinancialReportDto report = reportService.buildFinancialReport(
            authenticatedUserProvider.requireCurrentUser(userId));
        return ResponseEntity.ok(ApiResponse.success(report));
    }

    @PostMapping("/financial/{userId}/export")
    public ResponseEntity<ApiResponse<String>> exportFinancialReport(@PathVariable UUID userId) {
        reportService.buildFinancialReport(authenticatedUserProvider.requireCurrentUser(userId));
        return ResponseEntity.ok(ApiResponse.success("Exportação de relatório em desenvolvimento"));
    }
}
