import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.agent.tools.simulate_savings_plan import simulate_savings_plan
from app.schemas.agent import AgentApiRequest

CONTRACT_PATH = (
    Path(__file__).resolve().parents[2] / "contracts" / "agent-context-v1.json"
)


def load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_agent_context_contract_fixture_is_valid():
    payload = load_contract()

    request = AgentApiRequest.model_validate(payload)

    assert request.context.schema_version == "1.0"
    assert request.context.financial_profile.monthly_income == 5000.0
    assert request.context.indicators.savings_rate_pct == 30.0
    assert request.context.previous_period_indicators is not None
    assert request.context.previous_period_indicators.balance == 1800.0
    assert request.context.recommendations[0].category == "POUPANCA"

    simulation = simulate_savings_plan(
        request.context, target_amount=6000.0, months=12
    )
    assert "error" not in simulation["result"]
    assert simulation["result"]["monthly_income"] == 5000.0


def test_agent_context_contract_rejects_unknown_schema_version():
    payload = load_contract()
    payload["context"]["schema_version"] = "2.0"

    with pytest.raises(ValidationError):
        AgentApiRequest.model_validate(payload)


def test_agent_context_contract_rejects_unknown_fields():
    payload = load_contract()
    payload["context"]["financial_profile"]["monthlyIncome"] = 5000

    with pytest.raises(ValidationError):
        AgentApiRequest.model_validate(payload)
