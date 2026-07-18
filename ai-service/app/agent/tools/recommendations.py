from app.schemas.agent import AgentContext


def get_recommendations(context: AgentContext) -> dict:
    return {
        "tool": "get_recommendations",
        "result": context.recommendations,
    }
