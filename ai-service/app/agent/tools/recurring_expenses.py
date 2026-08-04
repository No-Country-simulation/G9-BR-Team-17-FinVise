from app.schemas.agent import AgentContext


def get_recurring_expenses(context: AgentContext) -> dict:
    return {
        "tool": "get_recurring_expenses",
        "result": [item.model_dump(mode="json") for item in context.recurring_expenses],
    }
