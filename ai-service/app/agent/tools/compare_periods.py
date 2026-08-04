from app.schemas.agent import AgentContext


def compare_periods(context: AgentContext) -> dict:
    monthly_periods = _monthly_periods(context)
    if len(monthly_periods) >= 2:
        previous = _monthly_indicators(monthly_periods[-2])
        current = _monthly_indicators(monthly_periods[-1])
        return {
            "tool": "compare_periods",
            "result": {
                "available": True,
                "comparison_basis": "MONTHLY",
                "current_period": current,
                "previous_period": previous,
                "changes": _numeric_changes(current, previous),
            },
        }

    current = context.indicators.model_dump(mode="json")
    previous = context.previous_period_indicators
    if previous is None:
        return {
            "tool": "compare_periods",
            "result": {
                "available": False,
                "message": "São necessários dados de pelo menos dois meses.",
                "current_period": current,
            },
        }

    previous_data = previous.model_dump(mode="json")
    return {
        "tool": "compare_periods",
        "result": {
            "available": True,
            "comparison_basis": "PROVIDED_INDICATORS",
            "current_period": current,
            "previous_period": previous_data,
            "changes": _numeric_changes(current, previous_data),
        },
    }


def _monthly_periods(context: AgentContext) -> list[dict]:
    months = context.analytical_facts.get("months", [])
    if not isinstance(months, list):
        return []
    valid_months = [
        month
        for month in months
        if isinstance(month, dict) and isinstance(month.get("period"), str)
    ]
    return sorted(valid_months, key=lambda month: month["period"])


def _monthly_indicators(month: dict) -> dict:
    income = _number(month.get("total_income"), 0.0)
    expenses = _number(month.get("total_expenses"), 0.0)
    balance = _number(month.get("balance"), income - expenses)
    transaction_count = int(_number(month.get("transaction_count"), 0.0))
    savings_rate = None
    income_commitment = None
    if income > 0:
        savings_rate = round((balance / income) * 100, 2)
        income_commitment = round((expenses / income) * 100, 2)
    return {
        "period": month["period"],
        "total_income": income,
        "total_expenses": expenses,
        "balance": balance,
        "transaction_count": transaction_count,
        "savings_rate_pct": savings_rate,
        "income_commitment_pct": income_commitment,
    }


def _numeric_changes(current: dict, previous: dict) -> dict:
    changes = {}
    for key, value in current.items():
        previous_value = previous.get(key)
        if _is_number(value) and _is_number(previous_value):
            changes[key] = round(value - previous_value, 2)
    return changes


def _number(value: object, default: float) -> float:
    return float(value) if _is_number(value) else default


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)
