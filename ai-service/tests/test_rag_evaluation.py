from evaluation.evaluate_rag import evaluate_cases, passes_thresholds


def test_evaluation_calculates_relevance_recall_and_latency():
    cases = [
        {"query": "gastos com mercado", "relevant_ids": ["doc-1", "doc-2"]},
        {"query": "maior receita", "relevant_ids": ["doc-3"]},
    ]

    def retrieve(case, _k):
        if case["query"] == "gastos com mercado":
            return [{"id": "doc-1"}, {"id": "irrelevante"}, {"id": "doc-2"}]
        return [{"id": "doc-3"}, {"id": "irrelevante"}]

    report = evaluate_cases(cases, retrieve, k=3)

    assert report["recall_at_k"] == 1.0
    assert report["precision_at_k"] == 0.583333
    assert report["mrr_at_k"] == 1.0
    assert report["latency_ms"]["p95"] >= 0
    assert passes_thresholds(
        report,
        minimum_recall_at_k=1.0,
        maximum_p95_ms=100,
    )


def test_evaluation_fails_configured_quality_threshold():
    report = {
        "recall_at_k": 0.5,
        "latency_ms": {"p95": 25.0},
    }

    assert not passes_thresholds(
        report,
        minimum_recall_at_k=0.8,
        maximum_p95_ms=100,
    )
