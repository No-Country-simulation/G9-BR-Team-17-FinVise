import pytest
from pydantic import ValidationError

from app.schemas.agent import AgentContext, AgentRequest
from app.schemas.profile import ProfileAnalyzeRequest, ProfileIndicators
from app.schemas.transaction import TransactionClassifyRequest, TransactionItem


def test_transaction_classify_request_valid():
    req = TransactionClassifyRequest(
        items=[TransactionItem(description="Supermercado", amount=100.0)]
    )
    assert len(req.items) == 1
    assert req.items[0].description == "Supermercado"


def test_transaction_classify_request_empty_items():
    with pytest.raises(ValidationError):
        TransactionClassifyRequest(items=[])


def test_profile_analyze_request_valid():
    req = ProfileAnalyzeRequest(
        monthlyIncome=5000.0,
        debtLevelPercentage=20.0,
        savingFrequency="MEDIUM",
        financialReserve=3000.0,
        indicators=ProfileIndicators(
            incomeCommitmentPercentage=50.0,
            savingsRatePercentage=10.0,
            fixedExpensesPercentage=30.0,
            nonEssentialExpensesPercentage=20.0,
            recurringExpensesCount=2,
            transactionsExpenseCount=5,
            expenseVariationPercentage=0.0,
            reserveInMonths=3.0,
        ),
    )
    assert req.monthlyIncome == 5000.0


def test_agent_request_valid():
    req = AgentRequest(
        conversation_id="conv-1",
        user_id="user-1",
        messages=[{"role": "user", "content": "Ola"}],
        context=AgentContext(),
    )
    assert req.conversation_id == "conv-1"
