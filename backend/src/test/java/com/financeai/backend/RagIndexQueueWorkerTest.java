package com.financeai.backend;

import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.rag.RagIndexJob;
import com.financeai.backend.rag.RagIndexQueueProperties;
import com.financeai.backend.rag.RagIndexQueueRepository;
import com.financeai.backend.rag.RagIndexQueueWorker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RagIndexQueueWorkerTest {

    @Mock
    private RagIndexQueueRepository queueRepository;

    @Mock
    private AiServiceClient aiServiceClient;

    private RagIndexQueueProperties properties;
    private RagIndexQueueWorker worker;

    @BeforeEach
    void setUp() {
        properties = new RagIndexQueueProperties();
        worker = new RagIndexQueueWorker(queueRepository, properties, aiServiceClient);
    }

    @Test
    void shouldReturnWithoutCallingAiWhenQueueIsEmpty() {
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.empty());

        worker.processNext();

        verifyNoInteractions(aiServiceClient);
    }

    @Test
    void shouldCompleteClaimedJobAfterSynchronousIndexing() {
        RagIndexJob job = job(0);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagDocumentsOrThrow(job.userId().toString(), List.of()))
            .thenReturn(12);
        when(queueRepository.complete(job)).thenReturn(true);

        worker.processNext();

        verify(queueRepository).complete(job);
        verify(queueRepository, never()).fail(any(), anyInt(), anyInt(), anyLong(), anyString());
    }

    @Test
    void shouldScheduleRetryWithExponentialBackoff() {
        RagIndexJob job = job(2);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagDocumentsOrThrow(job.userId().toString(), List.of()))
            .thenThrow(new IllegalStateException("AI Service indisponível"));
        when(queueRepository.fail(any(), anyInt(), anyInt(), anyLong(), anyString()))
            .thenReturn(true);

        worker.processNext();

        verify(queueRepository).fail(
            job,
            3,
            properties.getMaxAttempts(),
            8000,
            "AI Service indisponível");
        verify(queueRepository, never()).complete(any());
    }

    @Test
    void shouldCapRetryDelayAtConfiguredMaximum() {
        properties.setRetryBaseDelayMs(2000);
        properties.setRetryMaxDelayMs(5000);

        assertThat(properties.retryDelayMs(1)).isEqualTo(2000);
        assertThat(properties.retryDelayMs(2)).isEqualTo(4000);
        assertThat(properties.retryDelayMs(3)).isEqualTo(5000);
        assertThat(properties.retryDelayMs(30)).isEqualTo(5000);
    }

    private RagIndexJob job(int attempts) {
        return new RagIndexJob(
            UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), attempts);
    }
}
