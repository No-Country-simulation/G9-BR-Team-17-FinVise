package com.financeai.backend.report;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
    public ResponseEntity<byte[]> exportFinancialReport(@PathVariable UUID userId) {
        byte[] csv = reportService.exportFinancialReportCsv(
            authenticatedUserProvider.requireCurrentUser(userId));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv;charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment()
            .filename("finvise-relatorio-financeiro.csv")
            .build());
        headers.setCacheControl("no-store");
        return ResponseEntity.ok().headers(headers).body(csv);
    }
}
