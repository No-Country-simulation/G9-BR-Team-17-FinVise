from app.agent.tools.compare_periods import compare_periods
from app.agent.tools.financial_indicators import get_financial_indicators
from app.agent.tools.financial_profile import get_financial_profile
from app.agent.tools.recommendations import get_recommendations
from app.agent.tools.recurring_expenses import get_recurring_expenses
from app.agent.tools.simulate_savings_plan import simulate_savings_plan
from app.agent.tools.spending_summary import get_spending_summary
from app.agent.tools.transactions import get_transactions
from app.schemas.agent import AgentContext


def test_get_financial_profile():
    ctx = AgentContext(financial_profile={"monthlyIncome": 5000.0})
    result = get_financial_profile(ctx)
    assert result["result"]["monthlyIncome"] == 5000.0


def test_get_financial_indicators():
    ctx = AgentContext(indicators={"savingsRatePercentage": 10.0})
    result = get_financial_indicators(ctx)
    assert result["result"]["savingsRatePercentage"] == 10.0


def test_get_spending_summary():
    ctx = AgentContext(spending_summary={"total": 1000.0})
    result = get_spending_summary(ctx)
    assert result["result"]["total"] == 1000.0


def test_get_transactions():
    ctx = AgentContext(transactions=[{"id": 1}, {"id": 2}])
    result = get_transactions(ctx, limit=1)
    assert result["result"]["count"] == 1


def test_get_recommendations():
    ctx = AgentContext(recommendations=[{"category": "POUPANCA"}])
    result = get_recommendations(ctx)
    assert len(result["result"]) == 1


def test_compare_periods():
    ctx = AgentContext(
        indicators={"savingsRatePercentage": 10.0},
        previous_period_indicators={"savingsRatePercentage": 5.0},
    )
    result = compare_periods(ctx)
    assert result["result"]["available"] is True
    assert result["result"]["changes"]["savingsRatePercentage"] == 5.0


def test_get_recurring_expenses():
    ctx = AgentContext(recurring_expenses=[{"description": "Netflix"}])
    result = get_recurring_expenses(ctx)
    assert len(result["result"]) == 1


def test_simulate_savings_plan_feasible():
    ctx = AgentContext(
        financial_profile={"monthlyIncome": 5000.0},
        indicators={"savingsRatePercentage": 20.0},
    )
    result = simulate_savings_plan(ctx, target_amount=6000.0, months=12)
    assert result["result"]["feasible"] is True


def test_simulate_savings_plan_invalid():
    ctx = AgentContext(financial_profile={"monthlyIncome": 0.0}, indicators={})
    result = simulate_savings_plan(ctx, target_amount=1000.0)
    assert "error" in result["result"]
