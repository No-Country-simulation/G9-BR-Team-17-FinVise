from app.schemas.agent import AgentContext


def get_financial_indicators(context: AgentContext) -> dict:
    return {
        "tool": "get_financial_indicators",
        "result": context.indicators.model_dump(mode="json"),
    }
