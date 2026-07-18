from app.schemas.agent import AgentContext


def get_transactions(context: AgentContext, limit: int = 10) -> dict:
    transactions = context.transactions[:limit]
    return {
        "tool": "get_transactions",
        "arguments": {"limit": limit},
        "result": {"count": len(transactions), "items": transactions},
    }
