from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.profile import ProfileIndicators


class RecommendationGenerateRequest(BaseModel):
    monthlyIncome: float = Field(..., gt=0)
    debtLevelPercentage: float = Field(..., ge=0.0, le=100.0)
    savingFrequency: str = ""
    financialReserve: float = Field(default=0.0)  # Pode ser negativo em meses de saldo devedor
    indicators: ProfileIndicators
    spendingByCategory: dict[str, float] = Field(default_factory=dict)


class RecommendationItem(BaseModel):
    title: str
    description: str
    reason: str = ""
    priority: str = "MEDIUM"  # CRITICAL, HIGH, MEDIUM, LOW
    category: str = "ORCAMENTO"
    impact: str = ""
    suggestedAmount: float | None = None
    relatedIndicator: str = ""


class RecommendationGenerateResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    source: str  # "LLM" ou "RULES_FALLBACK"
    recommendations: list[RecommendationItem]
