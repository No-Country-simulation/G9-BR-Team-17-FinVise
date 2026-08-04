package com.financeai.backend;

import com.financeai.backend.auth.AuthenticatedUserProvider;
import com.financeai.backend.common.exception.GlobalExceptionHandler;
import com.financeai.backend.rag.RagController;
import com.financeai.backend.rag.RagIndexQueueOperationsService;
import com.financeai.backend.rag.RagIndexQueueStatusResponse;
import com.financeai.backend.rag.RagIngestionService;
import com.financeai.backend.rag.RagQueueOperationConflictException;
import com.financeai.backend.rag.RagReprocessResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class RagControllerTest {

    private final UUID userId = UUID.randomUUID();
    private RagIndexQueueOperationsService operationsService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        RagIngestionService ingestionService = mock(RagIngestionService.class);
        operationsService = mock(RagIndexQueueOperationsService.class);
        AuthenticatedUserProvider userProvider = mock(AuthenticatedUserProvider.class);
        when(userProvider.getUserId()).thenReturn(userId);
        mockMvc = standaloneSetup(
            new RagController(ingestionService, operationsService, userProvider))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    void shouldReturnQueueStatusForAuthenticatedUser() throws Exception {
        Instant now = Instant.parse("2026-08-03T12:00:00Z");
        when(operationsService.status(userId)).thenReturn(new RagIndexQueueStatusResponse(
            "DEAD_LETTER", 5, true, now, null, now, "falha permanente", 2, now));

        mockMvc.perform(get("/api/v1/rag/queue"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DEAD_LETTER"))
            .andExpect(jsonPath("$.attempts").value(5))
            .andExpect(jsonPath("$.deadLetteredAt").exists())
            .andExpect(jsonPath("$.manualReprocessCount").value(2));
    }

    @Test
    void shouldQueueForcedManualReprocessing() throws Exception {
        when(operationsService.reprocess(userId, true)).thenReturn(
            new RagReprocessResponse(true, true, 42, "PENDING"));

        mockMvc.perform(post("/api/v1/rag/reprocess")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"force\":true}"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.queued").value(true))
            .andExpect(jsonPath("$.force").value(true))
            .andExpect(jsonPath("$.resetDocuments").value(42))
            .andExpect(jsonPath("$.queueStatus").value("PENDING"));
    }

    @Test
    void shouldReturnConflictWhenJobIsProcessing() throws Exception {
        when(operationsService.reprocess(userId, false)).thenThrow(
            new RagQueueOperationConflictException("A indexacao RAG ja esta em processamento"));

        mockMvc.perform(post("/api/v1/rag/reprocess")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RAG_QUEUE_CONFLICT"));
    }
}
