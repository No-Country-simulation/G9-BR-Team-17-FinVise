package com.financeai.backend;

import com.financeai.backend.rag.RagIndexQueueMetrics;
import com.financeai.backend.rag.RagIndexQueueOperationsService;
import com.financeai.backend.rag.RagIndexQueueRepository;
import com.financeai.backend.rag.RagIndexQueueStatusResponse;
import com.financeai.backend.rag.RagQueueOperationConflictException;
import com.financeai.backend.rag.RagReprocessResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RagIndexQueueOperationsServiceTest {

    @Mock
    private RagIndexQueueRepository queueRepository;

    @Mock
    private RagIndexQueueMetrics metrics;

    private RagIndexQueueOperationsService service;

    @BeforeEach
    void setUp() {
        service = new RagIndexQueueOperationsService(queueRepository, metrics);
    }

    @Test
    void shouldReturnEmptyWhenUserHasNoDocuments() {
        UUID userId = UUID.randomUUID();
        when(queueRepository.hasDocuments(userId)).thenReturn(false);

        RagReprocessResponse response = service.reprocess(userId, false);

        assertThat(response.queued()).isFalse();
        assertThat(response.queueStatus()).isEqualTo("EMPTY");
        verify(queueRepository, never()).reprocess(any());
    }

    @Test
    void shouldRejectManualReprocessingWhileJobIsProcessing() {
        UUID userId = UUID.randomUUID();
        when(queueRepository.hasDocuments(userId)).thenReturn(true);
        when(queueRepository.reprocess(userId)).thenReturn(false);

        assertThatThrownBy(() -> service.reprocess(userId, false))
            .isInstanceOf(RagQueueOperationConflictException.class);

        verify(queueRepository, never()).resetDocumentsForReprocessing(any(), anyBoolean());
    }

    @Test
    void shouldResetDocumentsAndReactivateQueueManually() {
        UUID userId = UUID.randomUUID();
        when(queueRepository.hasDocuments(userId)).thenReturn(true);
        when(queueRepository.reprocess(userId)).thenReturn(true);
        when(queueRepository.resetDocumentsForReprocessing(userId, true)).thenReturn(42);

        RagReprocessResponse response = service.reprocess(userId, true);

        assertThat(response.queued()).isTrue();
        assertThat(response.force()).isTrue();
        assertThat(response.resetDocuments()).isEqualTo(42);
        assertThat(response.queueStatus()).isEqualTo("PENDING");
        verify(metrics).manualReprocess();
    }

    @Test
    void shouldReturnEmptyQueueStatusWhenNoJobExists() {
        UUID userId = UUID.randomUUID();
        when(queueRepository.status(userId)).thenReturn(Optional.empty());

        RagIndexQueueStatusResponse response = service.status(userId);

        assertThat(response.status()).isEqualTo("EMPTY");
    }
}
