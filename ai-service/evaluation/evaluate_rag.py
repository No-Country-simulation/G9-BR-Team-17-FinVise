import argparse
import json
from collections.abc import Callable
from pathlib import Path
from statistics import mean
from time import perf_counter
from typing import Any

RetrievalFunction = Callable[[dict[str, Any], int], list[dict[str, Any]]]


def evaluate_cases(
    cases: list[dict[str, Any]],
    retrieve: RetrievalFunction,
    k: int,
) -> dict[str, Any]:
    if not cases:
        raise ValueError("The RAG evaluation dataset must contain at least one case")
    if k < 1:
        raise ValueError("k must be greater than zero")

    recalls: list[float] = []
    precisions: list[float] = []
    reciprocal_ranks: list[float] = []
    latencies_ms: list[float] = []
    case_reports: list[dict[str, Any]] = []

    for case in cases:
        relevant_ids = set(case.get("relevant_ids") or [])
        if not relevant_ids:
            raise ValueError("Every RAG evaluation case must declare relevant_ids")

        started_at = perf_counter()
        results = retrieve(case, k)[:k]
        latency_ms = (perf_counter() - started_at) * 1000
        retrieved_ids = [str(result["id"]) for result in results]
        hits = relevant_ids.intersection(retrieved_ids)
        recall = len(hits) / len(relevant_ids)
        precision = len(hits) / len(retrieved_ids) if retrieved_ids else 0.0
        first_relevant_rank = next(
            (
                rank
                for rank, document_id in enumerate(retrieved_ids, start=1)
                if document_id in relevant_ids
            ),
            None,
        )
        reciprocal_rank = 1 / first_relevant_rank if first_relevant_rank else 0.0

        recalls.append(recall)
        precisions.append(precision)
        reciprocal_ranks.append(reciprocal_rank)
        latencies_ms.append(latency_ms)
        case_reports.append(
            {
                "query": case["query"],
                "relevant_ids": sorted(relevant_ids),
                "retrieved_ids": retrieved_ids,
                "recall_at_k": round(recall, 6),
                "precision_at_k": round(precision, 6),
                "reciprocal_rank": round(reciprocal_rank, 6),
                "latency_ms": round(latency_ms, 3),
            }
        )

    sorted_latencies = sorted(latencies_ms)
    return {
        "protocol": "labeled-query-retrieval-v1",
        "cases": len(cases),
        "k": k,
        "recall_at_k": round(mean(recalls), 6),
        "precision_at_k": round(mean(precisions), 6),
        "mrr_at_k": round(mean(reciprocal_ranks), 6),
        "latency_ms": {
            "average": round(mean(latencies_ms), 3),
            "p50": round(_percentile(sorted_latencies, 0.50), 3),
            "p95": round(_percentile(sorted_latencies, 0.95), 3),
            "maximum": round(sorted_latencies[-1], 3),
        },
        "case_results": case_reports,
    }


def passes_thresholds(
    report: dict[str, Any],
    *,
    minimum_recall_at_k: float,
    maximum_p95_ms: float,
) -> bool:
    return (
        report["recall_at_k"] >= minimum_recall_at_k
        and report["latency_ms"]["p95"] <= maximum_p95_ms
    )


def _percentile(values: list[float], percentile: float) -> float:
    index = min(len(values) - 1, max(0, int((len(values) - 1) * percentile)))
    return values[index]


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate FinVise hybrid RAG retrieval with labeled queries."
    )
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--minimum-recall-at-k", type=float, default=0.8)
    parser.add_argument("--maximum-p95-ms", type=float, default=500.0)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = _arguments()
    payload = json.loads(args.dataset.read_text(encoding="utf-8"))

    from app.agent.rag_service import rag_service

    def retrieve(case: dict[str, Any], k: int) -> list[dict[str, Any]]:
        return rag_service.retrieve_context(
            args.user_id,
            case["query"],
            limit=k,
            source_type=case.get("source_type"),
            source_ids=case.get("source_ids"),
        )

    report = evaluate_cases(payload["cases"], retrieve, args.k)
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if not passes_thresholds(
        report,
        minimum_recall_at_k=args.minimum_recall_at_k,
        maximum_p95_ms=args.maximum_p95_ms,
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
