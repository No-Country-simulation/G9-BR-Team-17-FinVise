package com.financeai.backend.importation;

import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/imports")
public class ImportController {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024L;

    private final CsvImportService csvImportService;
    private final ImportSourceService importSourceService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public ImportController(CsvImportService csvImportService,
                            ImportSourceService importSourceService,
                            AuthenticatedUserProvider authenticatedUserProvider) {
        this.csvImportService = csvImportService;
        this.importSourceService = importSourceService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @GetMapping("/sources")
    public ResponseEntity<ApiResponse<List<ImportSourceResponse>>> listSources() {
        return ResponseEntity.ok(ApiResponse.success(
            importSourceService.list(authenticatedUserProvider.getUserId())));
    }

    @PutMapping("/sources/{type}/{sourceId}/default")
    public ResponseEntity<ApiResponse<Void>> setDefaultSource(
        @PathVariable ImportSourceType type,
        @PathVariable UUID sourceId) {
        importSourceService.setDefault(authenticatedUserProvider.getUserId(), type, sourceId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/sources/{type}/{sourceId}")
    public ResponseEntity<ApiResponse<Void>> deleteSource(
        @PathVariable ImportSourceType type,
        @PathVariable UUID sourceId) {
        importSourceService.delete(authenticatedUserProvider.getUserId(), type, sourceId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping(value = "/transactions/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ImportResultResponse>> importTransactionsCsv(
        @RequestParam("file") MultipartFile file) {

        validateFile(file);
        ImportResultResponse result = csvImportService.importTransactionsCsv(
            authenticatedUserProvider.getUserId(), file);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_FILE", "O arquivo CSV é obrigatório");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo de 5MB");
        }
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        String contentType = file.getContentType() != null ? file.getContentType() : "";
        boolean csvByName = originalName.toLowerCase().endsWith(".csv");
        boolean csvByContent = "text/csv".equals(contentType) || "application/csv".equals(contentType);
        if (!csvByName && !csvByContent) {
            throw new BusinessException("INVALID_FILE_TYPE", "O arquivo deve ser do tipo CSV");
        }
    }
}
