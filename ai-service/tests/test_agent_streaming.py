import pytest

from app.agent.orchestration.agent import FinancialAgent
from app.agent.rag_service import rag_service
from app.schemas.agent import AgentRequest


def agent_request() -> AgentRequest:
    return AgentRequest(
        conversation_id="conversation-1",
        user_id="user-1",
        messages=[{"role": "user", "content": "Como posso economizar?"}],
    )


class RecordingProvider:
    def __init__(self, chunks: list[str]) -> None:
        self.chunks = chunks
        self.complete_tools = object()
        self.stream_tools = object()

    def complete(self, system_prompt, messages, tools=None):
        self.complete_tools = tools
        return {
            "choices": [
                {"message": {"role": "assistant", "content": "Resposta educativa"}}
            ]
        }

    def stream_complete(self, system_prompt, messages, tools=None):
        self.stream_tools = tools
        yield from self.chunks


def prepare_agent(monkeypatch, provider: RecordingProvider) -> FinancialAgent:
    agent = FinancialAgent(llm_provider=provider)
    monkeypatch.setattr(agent, "_execute_tools", lambda request: [])
    monkeypatch.setattr(
        rag_service,
        "retrieve_context",
        lambda user_id, query, top_k, source_type, source_ids: [],
    )
    return agent


def test_agent_uses_precomputed_context_without_requesting_tools_again(monkeypatch):
    provider = RecordingProvider(["Resposta ", "educativa"])
    agent = prepare_agent(monkeypatch, provider)

    response = agent.respond(agent_request())
    events = list(agent.respond_stream(agent_request()))

    assert response.message.content == "Resposta educativa"
    assert provider.complete_tools is None
    assert provider.stream_tools is None
    assert [event["token"] for event in events if event["type"] == "token"] == [
        "Resposta ",
        "educativa",
    ]


def test_agent_rejects_stream_without_text(monkeypatch):
    provider = RecordingProvider([])
    agent = prepare_agent(monkeypatch, provider)

    with pytest.raises(RuntimeError, match="sem gerar texto"):
        list(agent.respond_stream(agent_request()))
