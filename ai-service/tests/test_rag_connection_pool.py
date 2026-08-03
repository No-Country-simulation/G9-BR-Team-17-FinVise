from contextlib import nullcontext

import pytest

from app.agent.rag_service import RAGService
from app.core.config import settings


class _FakePool:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.open_calls = []
        self.close_calls = 0
        self.connection_timeouts = []
        self.connection_value = object()

    def open(self, wait=False):
        self.open_calls.append(wait)

    def close(self):
        self.close_calls += 1

    def connection(self, timeout=None):
        self.connection_timeouts.append(timeout)
        return nullcontext(self.connection_value)


def test_pool_is_created_once_and_reuses_connections():
    pools = []

    def factory(*args, **kwargs):
        pool = _FakePool(*args, **kwargs)
        pools.append(pool)
        return pool

    service = RAGService(pool_factory=factory)

    with service._get_connection() as first:
        pass
    with service._get_connection() as second:
        pass

    assert first is second
    assert len(pools) == 1
    assert pools[0].open_calls == [False]
    assert pools[0].connection_timeouts == [
        settings.rag_db_pool_timeout_seconds,
        settings.rag_db_pool_timeout_seconds,
    ]


def test_pool_uses_configured_limits_and_database_parameters():
    pools = []

    def factory(*args, **kwargs):
        pool = _FakePool(*args, **kwargs)
        pools.append(pool)
        return pool

    service = RAGService(pool_factory=factory)
    service.open()

    assert len(pools) == 1
    options = pools[0].kwargs
    assert options["min_size"] == settings.rag_db_pool_min_size
    assert options["max_size"] == settings.rag_db_pool_max_size
    assert options["timeout"] == settings.rag_db_pool_timeout_seconds
    assert options["open"] is False
    assert options["kwargs"] == {
        "host": service.db_host,
        "port": service.db_port,
        "dbname": service.db_name,
        "user": service.db_user,
        "password": service.db_pass,
    }


def test_pool_close_is_idempotent_and_allows_reopening():
    pools = []

    def factory(*args, **kwargs):
        pool = _FakePool(*args, **kwargs)
        pools.append(pool)
        return pool

    service = RAGService(pool_factory=factory)
    service.open()
    service.close()
    service.close()
    service.open()

    assert len(pools) == 2
    assert pools[0].close_calls == 1
    assert pools[1].open_calls == [False]


def test_pool_rejects_minimum_greater_than_maximum(monkeypatch):
    monkeypatch.setattr(settings, "rag_db_pool_min_size", 11)
    monkeypatch.setattr(settings, "rag_db_pool_max_size", 10)
    service = RAGService(pool_factory=_FakePool)

    with pytest.raises(ValueError, match="RAG_DB_POOL_MIN_SIZE"):
        service.open()
