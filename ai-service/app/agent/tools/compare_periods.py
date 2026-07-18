from app.schemas.agent import AgentContext


def compare_periods(context: AgentContext) -> dict:
    current = context.indicators
    previous = context.previous_period_indicators
    if not previous:
        return {
            "tool": "compare_periods",
            "result": {
                "available": False,
                "message": "Dados do periodo anterior nao fornecidos.",
                "current_period": current,
            },
        }

    changes = {}
    for key, value in current.items():
        previous_value = previous.get(key)
        if isinstance(previous_value, (int, float)) and isinstance(value, (int, float)):
            changes[key] = round(value - previous_value, 2)

    return {
        "tool": "compare_periods",
        "result": {
            "available": True,
            "current_period": current,
            "previous_period": previous,
            "changes": changes,
        },
    }
