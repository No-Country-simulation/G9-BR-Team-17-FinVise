from app.profile_classifier.fallback import FallbackProfileClassifier
from app.schemas.profile import ProfileAnalyzeRequest, ProfileIndicators


def make_request(**overrides) -> ProfileAnalyzeRequest:
    base = {
        "monthlyIncome": 5000.0,
        "debtLevelPercentage": 20.0,
        "savingFrequency": "MEDIUM",
        "financialReserve": 10000.0,
        "indicators": ProfileIndicators(
            incomeCommitmentPercentage=50.0,
            savingsRatePercentage=15.0,
            fixedExpensesPercentage=30.0,
            nonEssentialExpensesPercentage=20.0,
            recurringExpensesCount=2,
            transactionsExpenseCount=5,
            expenseVariationPercentage=0.0,
            reserveInMonths=6.0,
        ),
    }
    base.update(overrides)
    if "indicators" in overrides:
        base["indicators"] = overrides["indicators"]
    return ProfileAnalyzeRequest(**base)


def test_fallback_healthy():
    clf = FallbackProfileClassifier()
    result = clf.predict(make_request())
    assert result.classification == "SAUDAVEL"
    assert result.score >= 70


def test_fallback_risk():
    clf = FallbackProfileClassifier()
    request = make_request(
        debtLevelPercentage=80.0,
        indicators=ProfileIndicators(
            incomeCommitmentPercentage=95.0,
            savingsRatePercentage=0.0,
            fixedExpensesPercentage=70.0,
            nonEssentialExpensesPercentage=50.0,
            recurringExpensesCount=0,
            transactionsExpenseCount=1,
            expenseVariationPercentage=0.0,
            reserveInMonths=0.0,
        ),
    )
    result = clf.predict(request)
    assert result.classification == "EM_RISCO"
    assert result.score < 45
