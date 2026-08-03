from app.schemas.agent import AgentContext


def get_financial_profile(context: AgentContext) -> dict:
    return {
        "tool": "get_financial_profile",
        "result": context.financial_profile.model_dump(mode="json"),
    }
