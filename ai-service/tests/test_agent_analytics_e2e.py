import pytest

from app.agent.orchestration.agent import FinancialAgent
from app.agent.rag_service import rag_service


class AnalyticalProvider:
    def __init__(self):
        self.prompts: list[str] = []

    def complete(self, system_prompt, messages, tools=None):
        self.prompts.append(system_prompt)
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Resposta baseada nos fatos financeiros.",
                    }
                }
            ]
        }


def analytical_facts():
    return {
        "scope": {
            "transaction_count": 5,
            "period_start": "2024-11-01",
            "period_end": "2024-12-31",
        },
        "months": [
            {
                "period": "2024-11",
                "total_income": 3000,
                "total_expenses": 2500,
                "balance": 500,
            },
            {
                "period": "2024-12",
                "total_income": 6000,
                "total_expenses": 1200,
                "balance": 4800,
            },
        ],
        "month_rankings": {
            "highest_balance": {
                "period": "2024-12",
                "total_income": 6000,
                "total_expenses": 1200,
                "balance": 4800,
            },
            "lowest_balance": {
                "period": "2024-11",
                "total_income": 3000,
                "total_expenses": 2500,
                "balance": 500,
            },
        },
        "transaction_rankings": {
            "overall": {},
            "by_month": [
                {
                    "period": "2024-11",
                    "rankings": {
                        "largest_incomes": [
                            {"description": "Salário", "amount": 3000}
                        ]
                    },
                },
                {
                    "period": "2024-12",
                    "rankings": {
                        "largest_incomes": [
                            {"description": "Bônus anual", "amount": 6000}
                        ],
                        "smallest_expenses": [
                            {"description": "Café", "amount": 8}
                        ],
                    },
                },
            ],
        },
    }


@pytest.mark.parametrize(
    ("question", "expected_tool", "expected_period", "expected_evidence"),
    [
        (
            "Qual foi meu melhor mês?",
            "get_monthly_rankings",
            "2024-12",
            "highest_balance",
        ),
        (
            "Qual foi minha melhor transação de dezembro de 2024?",
            "get_transaction_rankings",
            "2024-12",
            "Bônus anual",
        ),
    ],
)
def test_analytical_questions_cross_api_tools_and_prompt(
    client,
    monkeypatch,
    question,
    expected_tool,
    expected_period,
    expected_evidence,
):
    provider = AnalyticalProvider()
    agent = FinancialAgent(llm_provider=provider)
    monkeypatch.setattr("app.api.routes.get_agent", lambda: agent)
    monkeypatch.setattr(
        rag_service,
        "retrieve_context",
        lambda _user_id, _query, _top_k, _source_type, _source_ids: [],
    )

    response = client.post(
        "/internal/v1/agent/respond",
        json={
            "conversation_id": "conversation-1",
            "messages": [{"role": "user", "content": question}],
            "context": {
                "analytical_facts": analytical_facts(),
                "retrieval": {
                    "top_k": 5,
                    "source_ids": ["arquivo-1"],
                },
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"]["content"] == "Resposta baseada nos fatos financeiros."
    assert [tool["tool"] for tool in payload["tool_calls"]] == [expected_tool]
    assert expected_period in str(payload["tool_calls"][0]["result"])
    assert expected_evidence in provider.prompts[0]
    assert "CONTEXTO ANALÍTICO DETERMINÍSTICO" in provider.prompts[0]
    assert "Nenhuma evidência relevante" not in provider.prompts[0]
