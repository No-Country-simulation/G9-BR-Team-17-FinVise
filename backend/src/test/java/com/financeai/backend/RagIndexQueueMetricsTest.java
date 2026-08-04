package com.financeai.backend;

import com.financeai.backend.rag.RagIndexQueueCounts;
import com.financeai.backend.rag.RagIndexQueueMetrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RagIndexQueueMetricsTest {

    @Test
    void shouldPublishQueueDepthAndProcessingCounters() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        RagIndexQueueMetrics metrics = new RagIndexQueueMetrics(registry);

        metrics.updateDepth(new RagIndexQueueCounts(3, 2, 7, 1));
        metrics.claimed();
        metrics.succeeded();
        metrics.deadLettered();
        metrics.batch(25);
        metrics.manualReprocess();
        metrics.recordDuration(System.nanoTime());

        assertThat(registry.get("finvise.rag.queue.jobs")
            .tag("status", "pending").gauge().value()).isEqualTo(3);
        assertThat(registry.get("finvise.rag.queue.jobs")
            .tag("status", "dead_letter").gauge().value()).isEqualTo(1);
        assertThat(registry.get("finvise.rag.queue.jobs.processed")
            .tag("outcome", "claimed").counter().count()).isEqualTo(1);
        assertThat(registry.get("finvise.rag.queue.jobs.processed")
            .tag("outcome", "succeeded").counter().count()).isEqualTo(1);
        assertThat(registry.get("finvise.rag.queue.jobs.processed")
            .tag("outcome", "dead_lettered").counter().count()).isEqualTo(1);
        assertThat(registry.get("finvise.rag.queue.jobs.processed")
            .tag("outcome", "manual_reprocessed").counter().count()).isEqualTo(1);
        assertThat(registry.get("finvise.rag.queue.batches").counter().count()).isEqualTo(1);
        assertThat(registry.get("finvise.rag.queue.documents.indexed").counter().count())
            .isEqualTo(25);
        assertThat(registry.get("finvise.rag.queue.processing.duration").timer().count())
            .isEqualTo(1);
    }
}
