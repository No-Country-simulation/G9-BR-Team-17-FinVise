package com.financeai.backend.rag;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class RagIndexQueueMetrics {

    private final AtomicLong pending = new AtomicLong();
    private final AtomicLong processing = new AtomicLong();
    private final AtomicLong completed = new AtomicLong();
    private final AtomicLong deadLetter = new AtomicLong();
    private final Counter claimed;
    private final Counter succeeded;
    private final Counter retried;
    private final Counter deadLettered;
    private final Counter drainLimited;
    private final Counter lockLost;
    private final Counter batches;
    private final Counter indexedDocuments;
    private final Counter manualReprocesses;
    private final Timer processingDuration;

    public RagIndexQueueMetrics(MeterRegistry registry) {
        Gauge.builder("finvise.rag.queue.jobs", pending, AtomicLong::get)
            .tag("status", "pending").register(registry);
        Gauge.builder("finvise.rag.queue.jobs", processing, AtomicLong::get)
            .tag("status", "processing").register(registry);
        Gauge.builder("finvise.rag.queue.jobs", completed, AtomicLong::get)
            .tag("status", "completed").register(registry);
        Gauge.builder("finvise.rag.queue.jobs", deadLetter, AtomicLong::get)
            .tag("status", "dead_letter").register(registry);
        claimed = counter(registry, "claimed");
        succeeded = counter(registry, "succeeded");
        retried = counter(registry, "retried");
        deadLettered = counter(registry, "dead_lettered");
        drainLimited = counter(registry, "drain_limited");
        lockLost = counter(registry, "lock_lost");
        manualReprocesses = counter(registry, "manual_reprocessed");
        batches = Counter.builder("finvise.rag.queue.batches").register(registry);
        indexedDocuments = Counter.builder("finvise.rag.queue.documents.indexed")
            .register(registry);
        processingDuration = Timer.builder("finvise.rag.queue.processing.duration")
            .publishPercentileHistogram()
            .register(registry);
    }

    public void updateDepth(RagIndexQueueCounts counts) {
        if (counts == null) {
            return;
        }
        pending.set(counts.pending());
        processing.set(counts.processing());
        completed.set(counts.completed());
        deadLetter.set(counts.deadLetter());
    }

    public void claimed() {
        claimed.increment();
    }

    public void succeeded() {
        succeeded.increment();
    }

    public void retried() {
        retried.increment();
    }

    public void deadLettered() {
        deadLettered.increment();
    }

    public void drainLimited() {
        drainLimited.increment();
    }

    public void lockLost() {
        lockLost.increment();
    }

    public void batch(int indexedCount) {
        batches.increment();
        indexedDocuments.increment(Math.max(0, indexedCount));
    }

    public void manualReprocess() {
        manualReprocesses.increment();
    }

    public void recordDuration(long startedAtNanos) {
        processingDuration.record(Duration.ofNanos(
            Math.max(0, System.nanoTime() - startedAtNanos)));
    }

    private Counter counter(MeterRegistry registry, String outcome) {
        return Counter.builder("finvise.rag.queue.jobs.processed")
            .tag("outcome", outcome)
            .register(registry);
    }
}
