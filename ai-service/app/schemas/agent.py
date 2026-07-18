from pydantic import BaseModel, Field

from app.schemas.common import Message


class AgentContext(BaseModel):
    financial_profile: dict = Field(default_factory=dict)
    indicators: dict = Field(default_factory=dict)
    spending_summary: dict = Field(default_factory=dict)
    recommendations: list = Field(default_factory=list)
    transactions: list = Field(default_factory=list)
    recurring_expenses: list = Field(default_factory=list)
    previous_period_indicators: dict = Field(default_factory=dict)


class AgentRequest(BaseModel):
    conversation_id: str
    user_id: str
    messages: list[Message] = Field(..., min_length=1)
    context: AgentContext = Field(default_factory=AgentContext)


class ToolCall(BaseModel):
    tool: str
    arguments: dict
    result: dict


class AgentResponse(BaseModel):
    message: Message
    tool_calls: list[ToolCall]
    disclaimer: str
