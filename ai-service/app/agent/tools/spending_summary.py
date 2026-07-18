from app.schemas.agent import AgentContext


def get_spending_summary(context: AgentContext) -> dict:
    return {
        "tool": "get_spending_summary",
        "result": context.spending_summary,
    }
