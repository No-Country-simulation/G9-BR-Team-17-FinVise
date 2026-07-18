package com.financeai.backend;

import com.financeai.backend.common.SystemController;
import com.financeai.backend.integration.ai.AiServiceClient;
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
}
