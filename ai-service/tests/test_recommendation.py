from app.recommendations.ai_engine import get_ai_recommendation_engine
from app.schemas.profile import ProfileIndicators
from app.schemas.recommendation import (
    RecommendationGenerateRequest,
    RecommendationGenerateResponse,
)


def test_recommendation_generate_request_accepts_negative_reserve():
    request = RecommendationGenerateRequest(
        monthlyIncome=4000.0,
        debtLevelPercentage=100.0,
        savingFrequency="",
        financialReserve=-2500.0,
        indicators=ProfileIndicators(
            incomeCommitmentPercentage=84.6,
            savingsRatePercentage=0.0,
            fixedExpensesPercentage=84.6,
            nonEssentialExpensesPercentage=15.4,
            recurringExpensesCount=3,
            transactionsExpenseCount=20,
            expenseVariationPercentage=0.0,
            reserveInMonths=0.0,
        ),
    )
    assert request.financialReserve == -2500.0
    assert request.monthlyIncome == 4000.0


def test_recommendation_engine_fallback_generation():
    engine = get_ai_recommendation_engine()
    request = RecommendationGenerateRequest(
        monthlyIncome=5000.0,
        debtLevelPercentage=45.0,
        savingFrequency="",
        financialReserve=1000.0,
        indicators=ProfileIndicators(
            incomeCommitmentPercentage=50.0,
            savingsRatePercentage=2.0,
            fixedExpensesPercentage=40.0,
            nonEssentialExpensesPercentage=25.0,
            recurringExpensesCount=3,
            transactionsExpenseCount=10,
            expenseVariationPercentage=5.0,
            reserveInMonths=1.5,
        ),
    )
    response = engine.generate(request)
    assert isinstance(response, RecommendationGenerateResponse)
    assert len(response.recommendations) > 0
    assert response.source in ("LLM", "RULES_FALLBACK")
