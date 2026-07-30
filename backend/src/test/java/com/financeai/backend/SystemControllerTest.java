package com.financeai.backend;

import com.financeai.backend.common.SystemController;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.ModelStatusResult;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SystemControllerTest {

    @Test
    void shouldReturnServiceUnavailableWhenAiServiceDoesNotRespond() {
        AiServiceClient aiServiceClient = mock(AiServiceClient.class);
        when(aiServiceClient.getModelStatus()).thenReturn(null);
        SystemController controller = new SystemController(aiServiceClient);

        ResponseEntity<?> response = controller.getModelStatus();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat(((Map<?, ?>) response.getBody()).get("status")).isEqualTo("UNAVAILABLE");
    }

    @Test
    void shouldReturnServiceUnavailableWhenRequiredModelsAreNotReady() {
        AiServiceClient aiServiceClient = mock(AiServiceClient.class);
        ModelStatusResult modelStatus = new ModelStatusResult(
            "DEGRADED",
            "production",
            true,
            "2026-07-30T22:00:00Z",
            Map.of("status", "FALLBACK"),
            Map.of("status", "FALLBACK"),
            Map.of("enabled", true)
        );
        when(aiServiceClient.getModelStatus()).thenReturn(modelStatus);
        SystemController controller = new SystemController(aiServiceClient);

        ResponseEntity<?> response = controller.getModelStatus();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isEqualTo(modelStatus);
    }
}
