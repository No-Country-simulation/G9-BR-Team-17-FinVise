package com.financeai.backend.rag;

import com.financeai.backend.auth.AuthenticatedUserProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<Map<String, Object>> triggerIndexStep() {
        int indexedCount = ragIngestionService.indexStep(authenticatedUserProvider.getUserId());
        return ResponseEntity.ok(Map.of(
            "indexedCount", indexedCount,
            "status", indexedCount > 0 ? "PROGRESSING" : "COMPLETE"
        ));
    }
}
