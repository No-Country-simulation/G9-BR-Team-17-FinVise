package com.financeai.backend.rag;

import com.financeai.backend.security.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/rag")
public class RagController {

    private final RagIngestionService ragIngestionService;

    public RagController(RagIngestionService ragIngestionService) {
        this.ragIngestionService = ragIngestionService;
    }

    @PostMapping("/index-step")
    public ResponseEntity<Map<String, Object>> triggerIndexStep(@AuthenticationPrincipal UserPrincipal currentUser) {
        int indexedCount = ragIngestionService.indexStep(currentUser.getId());
        return ResponseEntity.ok(Map.of(
            "indexedCount", indexedCount,
            "status", indexedCount > 0 ? "PROGRESSING" : "COMPLETE"
        ));
    }
}
