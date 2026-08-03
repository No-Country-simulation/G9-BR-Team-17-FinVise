from concurrent.futures import ThreadPoolExecutor

from app.agent.orchestration import agent as agent_module
from app.core import http_client


class _FakeHttpClient:
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


def test_http_client_is_shared_and_closed_once(monkeypatch):
    created_clients: list[_FakeHttpClient] = []

    def create_client() -> _FakeHttpClient:
        client = _FakeHttpClient()
        created_clients.append(client)
        return client

    http_client.close_http_client()
    monkeypatch.setattr(http_client.httpx, "Client", create_client)

    with ThreadPoolExecutor(max_workers=8) as executor:
        clients = list(executor.map(lambda _index: http_client.get_http_client(), range(32)))

    assert len(created_clients) == 1
    assert all(client is created_clients[0] for client in clients)

    http_client.close_http_client()
    assert created_clients[0].closed is True


def test_financial_agent_is_shared_until_reset(monkeypatch):
    provider = object()
    monkeypatch.setattr(agent_module, "_agent", None)
    monkeypatch.setattr(agent_module, "get_llm_provider", lambda: provider)
    monkeypatch.setattr(
        agent_module.FinancialAgent,
        "_load_system_prompt",
        lambda _self: "prompt",
    )

    first = agent_module.get_agent()
    second = agent_module.get_agent()

    assert first is second
    assert first.llm is provider

    agent_module.reset_agent()
    assert agent_module.get_agent() is not first
    agent_module.reset_agent()
