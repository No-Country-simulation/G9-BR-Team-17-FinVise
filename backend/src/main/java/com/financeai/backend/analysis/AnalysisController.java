package com.financeai.backend.analysis;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.util.List;
import com.financeai.backend.transaction.TransactionSource;

@RestController
@RequestMapping("/api/v1/financial-analyses")
public class AnalysisController {

    private final AnalysisService analysisService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public AnalysisController(AnalysisService analysisService,
                              AuthenticatedUserProvider authenticatedUserProvider) {
        this.analysisService = analysisService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AnalysisResponse>> createAnalysis(
        @Valid @RequestBody CreateAnalysisRequest request) {
        AnalysisResponse response = analysisService.createAnalysis(
            authenticatedUserProvider.getUserId(), request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/from-transactions")
    public ResponseEntity<ApiResponse<AnalysisResponse>> analyzeStoredTransactions(
        @Valid @RequestBody AnalyzeStoredTransactionsRequest request) {
        AnalysisResponse response = analysisService.analyzeStoredTransactions(
            authenticatedUserProvider.getUserId(), request.model(), request.source(), request.importSourceId(),
            request.startDate(), request.endDate());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/models")
    public ResponseEntity<ApiResponse<List<ProfileModelOptionResponse>>> getAvailableModels() {
        return ResponseEntity.ok(ApiResponse.success(List.of(
            new ProfileModelOptionResponse(
                ProfileAnalysisModel.MACHINE_LEARNING,
                "Machine Learning",
                "Modelo treinado que identifica padrões combinados de renda, gastos e comportamento."),
            new ProfileModelOptionResponse(
                ProfileAnalysisModel.FINANCIAL_RULES,
                "Regras financeiras",
                "Modelo determinístico e explicável baseado em limites de saúde financeira.")
        )));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<java.util.List<AnalysisResponse>>> getAnalyses(
        @RequestParam(name = "source", required = false) TransactionSource source) {
        return ResponseEntity.ok(ApiResponse.success(
            analysisService.getAnalyses(authenticatedUserProvider.getUserId(), source)));
    }

    @GetMapping("/latest")
    public ResponseEntity<ApiResponse<AnalysisResponse>> getLatestAnalysis(
        @RequestParam(name = "source", required = false) TransactionSource source,
        @RequestParam(name = "importSourceId", required = false) UUID importSourceId) {
        return ResponseEntity.ok(ApiResponse.success(
            analysisService.getLatestAnalysis(
                authenticatedUserProvider.getUserId(), source, importSourceId)));
    }

    @GetMapping("/{analysisId}")
    public ResponseEntity<ApiResponse<AnalysisResponse>> getAnalysis(
        @PathVariable UUID analysisId) {
        AnalysisResponse response = analysisService.getAnalysis(
            authenticatedUserProvider.getUserId(), analysisId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
