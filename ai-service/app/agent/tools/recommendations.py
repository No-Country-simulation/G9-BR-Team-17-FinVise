from app.schemas.agent import AgentContext


def get_recommendations(context: AgentContext) -> dict:
    recs = context.recommendations if isinstance(context.recommendations, list) else []
    return {
        "tool": "get_recommendations",
        "result": {"items": recs},
    }
