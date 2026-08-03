import pytest

from app.agent.orchestration.agent import FinancialAgent
from app.agent.rag_service import rag_service
from app.schemas.agent import AgentContext, AgentRequest
from app.schemas.common import Message


def test_generate_embedding_vector_length():
    embedding = rag_service.generate_embedding("Supermercado Extra R$ 150.75")
    assert isinstance(embedding, list)
    assert len(embedding) == 1536
    assert all(isinstance(v, float) for v in embedding)


def test_retrieve_context_handles_empty_user_id():
    results = rag_service.retrieve_context("", "gastos")
    assert results == []


class _FakeCursor:
    def __init__(self):
        self.executions = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params):
        self.executions.append((query, params))

    def fetchall(self):
        return []


class _FakeConnection:
    def __init__(self):
        self.cursor_instance = _FakeCursor()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self):
        return self.cursor_instance


def test_retrieve_context_filters_chronological_query_by_source(monkeypatch):
    connection = _FakeConnection()
    monkeypatch.setattr(rag_service, "_get_connection", lambda: connection)
    monkeypatch.setattr(rag_service, "_ensure_embedding_column", lambda _conn: False)

    rag_service.retrieve_context(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "gastos",
        5,
        "csv_import",
    )

    query, params = connection.cursor_instance.executions[0]
    assert "source_type = %s" in query
    assert params == (
        "gastos",
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "CSV_IMPORT",
        "gastos",
        5,
    )


def test_retrieve_context_filters_vector_query_by_source(monkeypatch):
    connection = _FakeConnection()
    monkeypatch.setattr(rag_service, "_get_connection", lambda: connection)
    monkeypatch.setattr(rag_service, "_ensure_embedding_column", lambda _conn: True)
    monkeypatch.setattr(rag_service, "generate_embedding", lambda _query: [0.5])

    rag_service.retrieve_context(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "gastos",
        3,
        "OPEN_FINANCE",
    )

    query, params = connection.cursor_instance.executions[0]
    assert "source_type = %s" in query
    assert params == (
        "[0.5]",
        "gastos",
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "OPEN_FINANCE",
        "[0.5]",
        12,
    )


def test_retrieve_context_filters_selected_source_ids(monkeypatch):
    connection = _FakeConnection()
    monkeypatch.setattr(rag_service, "_get_connection", lambda: connection)
    monkeypatch.setattr(rag_service, "_ensure_embedding_column", lambda _conn: False)

    rag_service.retrieve_context(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "gastos",
        5,
        "CSV_IMPORT",
        ["arquivo-1", "arquivo-2"],
    )

    query, params = connection.cursor_instance.executions[0]
    assert "source_id = ANY(%s)" in query
    assert params[3] == ["arquivo-1", "arquivo-2"]


def test_agent_maps_selected_source_to_rag_source_type():
    request = AgentRequest(
        conversation_id="conversation-1",
        user_id="user-1",
        messages=[Message(role="user", content="Quais são meus gastos?")],
        context=AgentContext(
            financial_profile={"source": "OPEN_FINANCE_PLUGGY"}
        ),
    )

    assert FinancialAgent._rag_source_type(request) == "OPEN_FINANCE"

    request.context.financial_profile.source = "CSV_IMPORT"
    assert FinancialAgent._rag_source_type(request) == "CSV_IMPORT"

    request.context.financial_profile.source = "ALL"
    assert FinancialAgent._rag_source_type(request) is None


class _IndexCursor:
    def __init__(self, lock_acquired=True):
        self.last_query = ""
        self.batch_returned = False
        self.executemany_calls = []
        self.lock_acquired = lock_acquired

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, _params):
        self.last_query = query

    def executemany(self, query, params):
        self.executemany_calls.append((query, params))

    def fetchone(self):
        return (self.lock_acquired,)

    def fetchall(self):
        if self.batch_returned:
            return []
        self.batch_returned = True
        return [
            (
                "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                "Fatos financeiros de dezembro",
            )
        ]


class _IndexConnection:
    def __init__(self, lock_acquired=True):
        self.cursor_instance = _IndexCursor(lock_acquired)
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self):
        return self.cursor_instance

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def test_indexing_tracks_processing_and_indexed_status(monkeypatch):
    connection = _IndexConnection()
    monkeypatch.setattr(rag_service, "_get_connection", lambda: connection)
    monkeypatch.setattr(rag_service, "_ensure_embedding_column", lambda _conn: True)
    monkeypatch.setattr(
        rag_service,
        "generate_embeddings_batch",
        lambda _texts: [[0.1] * 1536],
    )

    indexed = rag_service.index_unembedded_chunks(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    )

    assert indexed == 1
    assert connection.commits == 2
    processing_query, processing_params = (
        connection.cursor_instance.executemany_calls[0]
    )
    indexed_query, _indexed_params = connection.cursor_instance.executemany_calls[1]
    assert "index_status = %s" in processing_query
    assert processing_params[0][0] == "PROCESSING"
    assert "index_status = 'INDEXED'" in indexed_query


def test_indexing_marks_failed_batch(monkeypatch):
    connection = _IndexConnection()
    monkeypatch.setattr(rag_service, "_get_connection", lambda: connection)
    monkeypatch.setattr(rag_service, "_ensure_embedding_column", lambda _conn: True)

    def fail_embedding(_texts):
        raise RuntimeError("provedor indisponível")

    monkeypatch.setattr(rag_service, "generate_embeddings_batch", fail_embedding)

    with pytest.raises(RuntimeError, match="provedor indisponível"):
        rag_service.index_unembedded_chunks(
            "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        )

    assert connection.rollbacks == 1
    _failed_query, failed_params = connection.cursor_instance.executemany_calls[1]
    assert failed_params[0][0] == "FAILED"
    assert failed_params[0][1] == "provedor indisponível"


def test_indexing_reports_busy_user_for_queue_retry(monkeypatch):
    connection = _IndexConnection(lock_acquired=False)
    monkeypatch.setattr(rag_service, "_get_connection", lambda: connection)
    monkeypatch.setattr(rag_service, "_ensure_embedding_column", lambda _conn: True)

    with pytest.raises(RuntimeError, match="already running"):
        rag_service.index_unembedded_chunks(
            "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        )
