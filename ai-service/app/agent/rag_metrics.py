from collections import deque
from threading import Lock
from typing import Any

from app.core.config import settings


class RAGRetrievalMetrics:
    """Bounded, process-local telemetry for retrieval quality and latency."""

    def __init__(self, window_size: int | None = None) -> None:
        self._window_size = window_size or settings.rag_retrieval_metrics_window
        self._latencies_ms: deque[float] = deque(maxlen=self._window_size)
        self._lock = Lock()
        self._requests = 0
        self._hybrid = 0
        self._vector_only = 0
        self._text_only = 0
        self._no_results = 0
        self._vector_failures = 0
        self._text_failures = 0

    def record(
        self,
        *,
        duration_ms: float,
        vector_results: int,
        text_results: int,
        result_count: int,
        vector_failed: bool = False,
        text_failed: bool = False,
    ) -> None:
        with self._lock:
            self._requests += 1
            self._latencies_ms.append(max(0.0, duration_ms))
            if vector_failed:
                self._vector_failures += 1
            if text_failed:
                self._text_failures += 1
            if result_count == 0:
                self._no_results += 1
            elif vector_results and text_results:
                self._hybrid += 1
            elif vector_results:
                self._vector_only += 1
            else:
                self._text_only += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            latencies = sorted(self._latencies_ms)
            return {
                "requests": self._requests,
                "hybrid_requests": self._hybrid,
                "vector_only_requests": self._vector_only,
                "text_only_requests": self._text_only,
                "no_result_requests": self._no_results,
                "vector_failures": self._vector_failures,
                "text_failures": self._text_failures,
                "latency_window_size": len(latencies),
                "latency_ms": {
                    "average": self._average(latencies),
                    "p50": self._percentile(latencies, 0.50),
                    "p95": self._percentile(latencies, 0.95),
                    "maximum": round(latencies[-1], 3) if latencies else 0.0,
                },
            }

    @staticmethod
    def _average(values: list[float]) -> float:
        if not values:
            return 0.0
        return round(sum(values) / len(values), 3)

    @staticmethod
    def _percentile(values: list[float], percentile: float) -> float:
        if not values:
            return 0.0
        index = min(len(values) - 1, max(0, int((len(values) - 1) * percentile)))
        return round(values[index], 3)


rag_retrieval_metrics = RAGRetrievalMetrics()
