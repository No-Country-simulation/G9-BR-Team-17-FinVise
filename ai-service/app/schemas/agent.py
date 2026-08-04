from datetime import date as Date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Message


class RetrievalConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    top_k: int = Field(default=5, ge=1, le=20)
    source_ids: list[str] = Field(default_factory=list, max_length=100)


class FinancialProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Literal["CSV_IMPORT", "OPEN_FINANCE_PLUGGY", "ALL"] = "ALL"
    transaction_count: int = Field(default=0, ge=0)
    period_start: Date | None = None
    period_end: Date | None = None
    month_count: int = Field(default=0, ge=0)
    monthly_income: float = Field(default=0.0, ge=0.0)
    monthly_expenses: float = Field(default=0.0, ge=0.0)


class FinancialIndicators(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_income: float = Field(default=0.0, ge=0.0)
    total_expenses: float = Field(default=0.0, ge=0.0)
    balance: float = 0.0
    transaction_count: int = Field(default=0, ge=0)
    savings_rate_pct: float | None = None
    income_commitment_pct: float | None = Field(default=None, ge=0.0)


class SpendingSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    by_category: dict[str, float] = Field(default_factory=dict)
    total_expenses: float = Field(default=0.0, ge=0.0)


class RecommendationContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    category: str | None = None
    priority: str | None = None


class TransactionContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str
    amount: float = Field(ge=0.0)
    type: Literal["INCOME", "EXPENSE"]
    date: Date | None = None
    payment_method: str | None = None
    recurrent: bool = False


class RecurringExpenseContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str
    amount: float = Field(ge=0.0)
    date: Date | None = None


class AgentContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"] = "1.0"
    financial_profile: FinancialProfile = Field(default_factory=FinancialProfile)
    indicators: FinancialIndicators = Field(default_factory=FinancialIndicators)
    spending_summary: SpendingSummary = Field(default_factory=SpendingSummary)
    recommendations: list[RecommendationContext] = Field(default_factory=list)
    transactions: list[TransactionContext] = Field(default_factory=list)
    recurring_expenses: list[RecurringExpenseContext] = Field(default_factory=list)
    previous_period_indicators: FinancialIndicators | None = None
    analytical_facts: dict = Field(default_factory=dict)
    retrieval: RetrievalConfig = Field(default_factory=RetrievalConfig)


class AgentApiRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conversation_id: str
    messages: list[Message] = Field(..., min_length=1)
    context: AgentContext = Field(default_factory=AgentContext)


class AgentRequest(AgentApiRequest):
    user_id: str


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
