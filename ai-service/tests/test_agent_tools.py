import pytest
from pydantic import ValidationError

from app.agent.orchestration.agent import FinancialAgent
from app.agent.tools.analytical_facts import (
    get_monthly_rankings,
    get_transaction_rankings,
)
from app.agent.tools.compare_periods import compare_periods
from app.agent.tools.financial_indicators import get_financial_indicators
from app.agent.tools.financial_profile import get_financial_profile
from app.agent.tools.recommendations import get_recommendations
from app.agent.tools.recurring_expenses import get_recurring_expenses
from app.agent.tools.simulate_savings_plan import simulate_savings_plan
from app.agent.tools.spending_summary import get_spending_summary
from app.agent.tools.transactions import get_transactions
from app.schemas.agent import AgentContext, AgentRequest


def test_get_financial_profile():
    ctx = AgentContext(financial_profile={"monthly_income": 5000.0})
    result = get_financial_profile(ctx)
    assert result["result"]["monthly_income"] == 5000.0


def test_get_financial_indicators():
    ctx = AgentContext(indicators={"savings_rate_pct": 10.0})
    result = get_financial_indicators(ctx)
    assert result["result"]["savings_rate_pct"] == 10.0


def test_get_spending_summary():
    ctx = AgentContext(spending_summary={"total_expenses": 1000.0})
    result = get_spending_summary(ctx)
    assert result["result"]["total_expenses"] == 1000.0


def test_get_transactions():
    ctx = AgentContext(
        transactions=[
            {"description": "Mercado", "amount": 100, "type": "EXPENSE"},
            {"description": "Salario", "amount": 5000, "type": "INCOME"},
        ]
    )
    result = get_transactions(ctx, limit=1)
    assert result["result"]["count"] == 1


def test_get_monthly_rankings():
    ctx = AgentContext(
        analytical_facts={
            "scope": {"transaction_count": 3},
            "months": [{"period": "2024-12", "balance": 1000}],
            "month_rankings": {
                "highest_balance": {"period": "2024-12", "balance": 1000}
            },
        }
    )

    result = get_monthly_rankings(ctx)

    assert result["result"]["available"] is True
    assert result["result"]["rankings"]["highest_balance"]["period"] == "2024-12"


def test_get_transaction_rankings_filters_december():
    ctx = AgentContext(
        analytical_facts={
            "scope": {"transaction_count": 2},
            "transaction_rankings": {
                "overall": {},
                "by_month": [
                    {"period": "2024-11", "rankings": {"largest_incomes": []}},
                    {
                        "period": "2024-12",
                        "rankings": {
                            "largest_incomes": [
                                {"description": "Salário", "amount": 6000}
                            ]
                        },
                    },
                ],
            },
        }
    )

    result = get_transaction_rankings(ctx, month=12)

    assert result["result"]["available"] is True
    assert result["result"]["periods"][0]["period"] == "2024-12"
    assert (
        result["result"]["periods"][0]["rankings"]["largest_incomes"][0][
            "description"
        ]
        == "Salário"
    )


def test_agent_routes_month_and_transaction_rankings():
    agent = FinancialAgent(llm_provider=object())

    best_month = AgentRequest(
        conversation_id="conversation-1",
        user_id="user-1",
        messages=[{"role": "user", "content": "qual foi meu melhor mês"}],
    )
    december_transaction = AgentRequest(
        conversation_id="conversation-1",
        user_id="user-1",
        messages=[
            {
                "role": "user",
                "content": "qual foi minha melhor transação de dezembro de 2024",
            }
        ],
    )
    worst_month = AgentRequest(
        conversation_id="conversation-1",
        user_id="user-1",
        messages=[
            {
                "role": "user",
                "content": "qual foi meu pior mês em termos de despesas",
            }
        ],
    )

    assert agent._select_tools(best_month) == ["get_monthly_rankings"]
    assert agent._select_tools(worst_month) == ["get_monthly_rankings"]
    assert agent._select_tools(december_transaction) == [
        "get_transaction_rankings"
    ]
    assert agent._extract_ranking_arguments(december_transaction) == {
        "month": 12,
        "year": 2024,
    }


def test_get_recommendations():
    ctx = AgentContext(
        recommendations=[
            {
                "title": "Criar reserva",
                "description": "Poupar mensalmente",
                "category": "POUPANCA",
            }
        ]
    )
    result = get_recommendations(ctx)
    assert len(result["result"]["items"]) == 1


def test_compare_periods():
    ctx = AgentContext(
        indicators={"savings_rate_pct": 10.0},
        previous_period_indicators={"savings_rate_pct": 5.0},
    )
    result = compare_periods(ctx)
    assert result["result"]["available"] is True
    assert result["result"]["changes"]["savings_rate_pct"] == 5.0


def test_get_recurring_expenses():
    ctx = AgentContext(
        recurring_expenses=[{"description": "Netflix", "amount": 39.9}]
    )
    result = get_recurring_expenses(ctx)
    assert len(result["result"]) == 1


def test_simulate_savings_plan_feasible():
    ctx = AgentContext(
        financial_profile={"monthly_income": 5000.0},
        indicators={"savings_rate_pct": 20.0},
    )
    result = simulate_savings_plan(ctx, target_amount=6000.0, months=12)
    assert result["result"]["feasible"] is True


def test_simulate_savings_plan_invalid():
    ctx = AgentContext(financial_profile={"monthly_income": 0.0}, indicators={})
    result = simulate_savings_plan(ctx, target_amount=1000.0)
    assert "error" in result["result"]


def test_agent_context_rejects_legacy_camel_case_fields():
    with pytest.raises(ValidationError):
        AgentContext(financial_profile={"monthlyIncome": 5000.0})
