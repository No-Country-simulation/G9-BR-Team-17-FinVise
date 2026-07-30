from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import Message


class RetrievalConfig(BaseModel):
    top_k: int = Field(default=5, ge=1, le=20)
    source_ids: list[str] = Field(default_factory=list, max_length=100)


class AgentContext(BaseModel):
    financial_profile: dict = Field(default_factory=dict)
    indicators: dict = Field(default_factory=dict)
    spending_summary: dict = Field(default_factory=dict)
    recommendations: list = Field(default_factory=list)
    transactions: list = Field(default_factory=list)
    recurring_expenses: list = Field(default_factory=list)
    previous_period_indicators: dict = Field(default_factory=dict)
    analytical_facts: dict = Field(default_factory=dict)
    retrieval: RetrievalConfig = Field(default_factory=RetrievalConfig)


class AgentRequest(BaseModel):
    conversation_id: str
    user_id: str
    messages: list[Message] = Field(..., min_length=1)
    context: AgentContext = Field(default_factory=AgentContext)


class ToolCall(BaseModel):
    tool: str
    arguments: dict
    result: dict | list | Any


class RagSource(BaseModel):
    id: str
    source_id: str | None = None
    source_name: str | None = None
    chunk_type: str
    score: float | None = None


class AgentResponse(BaseModel):
    message: Message
    tool_calls: list[ToolCall]
    sources: list[RagSource] = Field(default_factory=list)
    disclaimer: str
