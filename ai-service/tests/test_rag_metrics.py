from app.agent.rag_metrics import RAGRetrievalMetrics


def test_retrieval_metrics_report_hybrid_usage_failures_and_latency():
    metrics = RAGRetrievalMetrics(window_size=10)
    metrics.record(
        duration_ms=12.5,
        vector_results=3,
        text_results=4,
        result_count=5,
        vector_failed=False,
    )
    metrics.record(
        duration_ms=20.0,
        vector_results=0,
        text_results=2,
        result_count=2,
        vector_failed=True,
    )

    snapshot = metrics.snapshot()

    assert snapshot["requests"] == 2
    assert snapshot["hybrid_requests"] == 1
    assert snapshot["text_only_requests"] == 1
    assert snapshot["vector_failures"] == 1
    assert snapshot["text_failures"] == 0
    assert snapshot["latency_ms"]["maximum"] == 20.0
