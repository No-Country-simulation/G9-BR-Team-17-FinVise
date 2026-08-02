package com.financeai.backend.rag;

import com.financeai.backend.auth.AuthenticatedUserProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/rag")
public class RagController {

    private final RagIngestionService ragIngestionService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public RagController(RagIngestionService ragIngestionService,
                         AuthenticatedUserProvider authenticatedUserProvider) {
        this.ragIngestionService = ragIngestionService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @PostMapping("/index-step")
    public ResponseEntity<Map<String, Object>> triggerIndexStep(
        @RequestParam(required = false) List<String> sourceIds
    ) {
        var userId = authenticatedUserProvider.getUserId();
        int indexedCount = ragIngestionService.indexStep(userId, sourceIds);
        RagIndexStatusResponse indexStatus = ragIngestionService.indexStatus(userId, sourceIds);
        return ResponseEntity.ok(Map.of(
            "indexedCount", indexedCount,
            "status", indexStatus.status(),
            "totalDocuments", indexStatus.totalDocuments(),
            "pendingDocuments", indexStatus.pendingDocuments(),
            "processingDocuments", indexStatus.processingDocuments(),
            "indexedDocuments", indexStatus.indexedDocuments(),
            "failedDocuments", indexStatus.failedDocuments()
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<RagIndexStatusResponse> indexStatus(
        @RequestParam(required = false) List<String> sourceIds
    ) {
        return ResponseEntity.ok(ragIngestionService.indexStatus(
            authenticatedUserProvider.getUserId(), sourceIds));
    }
}
