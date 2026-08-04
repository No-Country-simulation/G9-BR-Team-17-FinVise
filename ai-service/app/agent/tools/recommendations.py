from app.schemas.agent import AgentContext


def get_recommendations(context: AgentContext) -> dict:
    recs = [item.model_dump(mode="json") for item in context.recommendations]
    return {
        "tool": "get_recommendations",
        "result": {"items": recs},
    }
