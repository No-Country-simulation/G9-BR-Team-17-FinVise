package com.financeai.backend.common;

import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.ModelStatusResult;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class SystemController {

    private final AiServiceClient aiServiceClient;

    public SystemController(AiServiceClient aiServiceClient) {
        this.aiServiceClient = aiServiceClient;
    }

    @GetMapping("/model-status")
    public ResponseEntity<?> getModelStatus() {
        ModelStatusResult result = aiServiceClient.getModelStatus();
        if (result == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "status", "UNAVAILABLE",
                "message", "AI service não respondeu"
            ));
        }
        if (result.modelsRequired() && !"READY".equals(result.status())) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(result);
        }
        return ResponseEntity.ok(result);
    }
}
