package com.financeai.backend;

import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.rag.RagIndexJob;
import com.financeai.backend.rag.RagIndexQueueMetrics;
import com.financeai.backend.rag.RagIndexQueueProperties;
import com.financeai.backend.rag.RagIndexQueueRepository;
import com.financeai.backend.rag.RagIndexQueueWorker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.client.HttpClientErrorException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ScheduledFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RagIndexQueueWorkerTest {

    @Mock
    private RagIndexQueueRepository queueRepository;

    @Mock
    private AiServiceClient aiServiceClient;

    @Mock
    private RagIndexQueueMetrics metrics;

    @Mock
    private TaskScheduler heartbeatScheduler;

    @Mock
    private ScheduledFuture<?> heartbeatFuture;

    private RagIndexQueueProperties properties;
    private RagIndexQueueWorker worker;

    @BeforeEach
    void setUp() {
        properties = new RagIndexQueueProperties();
        lenient().doReturn(heartbeatFuture).when(heartbeatScheduler).scheduleAtFixedRate(
            any(Runnable.class), any(Duration.class));
        worker = new RagIndexQueueWorker(
            queueRepository,
            properties,
            aiServiceClient,
            metrics,
            heartbeatScheduler);
    }

    @Test
    void shouldReturnWithoutCallingAiWhenQueueIsEmpty() {
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.empty());

        worker.processNext();

        verifyNoInteractions(aiServiceClient);
    }

    @Test
    void shouldDrainAllBatchesBeforeCompletingTheJob() {
        RagIndexJob job = job(0);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagBatchOrThrow(job.userId().toString(), List.of()))
            .thenReturn(
                new AiServiceClient.RagIndexResponse(200, job.userId().toString(), true),
                new AiServiceClient.RagIndexResponse(25, job.userId().toString(), false));
        when(queueRepository.complete(job)).thenReturn(true);

        worker.processNext();

        verify(aiServiceClient, times(2))
            .indexRagBatchOrThrow(job.userId().toString(), List.of());
        verify(queueRepository).complete(job);
        verify(queueRepository, never()).continueAfterDrainLimit(any());
        verify(metrics).succeeded();
        verify(heartbeatFuture, atLeastOnce()).cancel(false);
    }

    @Test
    void shouldReleaseJobAfterConfiguredDrainLimit() {
        properties.setMaxBatchesPerDrain(1);
        RagIndexJob job = job(1);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagBatchOrThrow(job.userId().toString(), List.of()))
            .thenReturn(new AiServiceClient.RagIndexResponse(
                200, job.userId().toString(), true));
        when(queueRepository.continueAfterDrainLimit(job)).thenReturn(true);

        worker.processNext();

        verify(queueRepository).continueAfterDrainLimit(job);
        verify(queueRepository, never()).complete(any());
        verify(metrics).drainLimited();
    }

    @Test
    void shouldFailWhenAiReportsPendingDocumentsWithoutProgress() {
        RagIndexJob job = job(0);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagBatchOrThrow(job.userId().toString(), List.of()))
            .thenReturn(new AiServiceClient.RagIndexResponse(
                0, job.userId().toString(), true));
        when(queueRepository.fail(any(), anyInt(), anyInt(), anyLong(), anyString()))
            .thenReturn(true);

        worker.processNext();

        verify(queueRepository).fail(
            eq(job), eq(1), eq(properties.getMaxAttempts()),
            eq(properties.getRetryBaseDelayMs()), contains("sem avançar"));
    }

    @Test
    void shouldScheduleRetryWithExponentialBackoff() {
        RagIndexJob job = job(2);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagBatchOrThrow(job.userId().toString(), List.of()))
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
        verify(metrics).retried();
    }

    @Test
    void shouldMoveLastFailureToDeadLetter() {
        properties.setMaxAttempts(3);
        RagIndexJob job = job(2);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagBatchOrThrow(job.userId().toString(), List.of()))
            .thenThrow(new IllegalStateException("falha permanente"));
        when(queueRepository.fail(any(), anyInt(), anyInt(), anyLong(), anyString()))
            .thenReturn(true);

        worker.processNext();

        verify(metrics).deadLettered();
        verify(metrics, never()).retried();
    }

    @Test
    void shouldDeferBusyJobWithoutConsumingRetryAttempt() {
        RagIndexJob job = job(2);
        HttpClientErrorException conflict = HttpClientErrorException.create(
            HttpStatus.CONFLICT,
            "Conflict",
            HttpHeaders.EMPTY,
            new byte[0],
            StandardCharsets.UTF_8);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(aiServiceClient.indexRagBatchOrThrow(job.userId().toString(), List.of()))
            .thenThrow(conflict);
        when(queueRepository.deferWithoutFailure(
            eq(job), eq(properties.getRetryBaseDelayMs()), anyString()))
            .thenReturn(true);

        worker.processNext();

        verify(queueRepository).deferWithoutFailure(
            eq(job), eq(properties.getRetryBaseDelayMs()), anyString());
        verify(queueRepository, never()).fail(any(), anyInt(), anyInt(), anyLong(), anyString());
        verify(metrics).retried();
    }

    @Test
    void shouldStopBeforeCallingAiWhenHeartbeatLosesTheLock() {
        RagIndexJob job = job(0);
        when(queueRepository.claimNext(properties.getLockTimeoutMs()))
            .thenReturn(Optional.of(job));
        when(queueRepository.heartbeat(job)).thenReturn(false);
        when(heartbeatScheduler.scheduleAtFixedRate(
            any(Runnable.class), any(Duration.class))).thenAnswer(invocation -> {
                invocation.getArgument(0, Runnable.class).run();
                return heartbeatFuture;
            });

        worker.processNext();

        verifyNoInteractions(aiServiceClient);
        verify(metrics).lockLost();
        verify(queueRepository, never()).complete(any());
        verify(queueRepository, never()).fail(any(), anyInt(), anyInt(), anyLong(), anyString());
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
