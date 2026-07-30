from fastapi.testclient import TestClient

from app.main import app


def test_clean_startup_loads_the_application():
    with TestClient(app) as startup_client:
        response = startup_client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_models_status(client):
    response = client.get("/internal/v1/models/status")
    assert response.status_code == 200
    data = response.json()
    assert "transaction_classifier" in data
    assert "profile_classifier" in data
    assert data["transaction_classifier"]["status"] in {"LOADED", "FALLBACK"}
    assert data["profile_classifier"]["status"] in {"LOADED", "FALLBACK"}


def test_classify_transactions(client):
    payload = {
        "items": [
            {"description": "Supermercado BH", "amount": 420.0, "payment_method": "CREDIT_CARD"}
        ]
    }
    response = client.post("/internal/v1/transactions/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["model_version"] in {"FALLBACK", "1.0.0", "1.1.0"}
    assert data["model_status"] in {"LOADED", "FALLBACK"}
    assert len(data["predictions"]) == 1
    assert data["predictions"][0]["category"] == "ALIMENTACAO"


def test_classify_regression_cases(client):
    payload = {
        "items": [
            {"description": "Supermercado", "amount": 420.0},
            {"description": "Combustivel", "amount": 300.0},
            {"description": "Netflix", "amount": 40.0},
        ]
    }

    response = client.post("/internal/v1/transactions/classify", json=payload)

    assert response.status_code == 200
    predictions = response.json()["predictions"]
    assert [prediction["category"] for prediction in predictions] == [
        "ALIMENTACAO",
        "TRANSPORTE",
        "LAZER",
    ]
    assert predictions[1]["subcategory"] == "COMBUSTIVEL"


def test_analyze_profile(client):
    payload = {
        "monthlyIncome": 4500.0,
        "debtLevelPercentage": 25.0,
        "savingFrequency": "MEDIUM",
        "financialReserve": 3000.0,
        "indicators": {
            "incomeCommitmentPercentage": 16.89,
            "savingsRatePercentage": 8.0,
            "fixedExpensesPercentage": 30.0,
            "nonEssentialExpensesPercentage": 25.0,
            "recurringExpensesCount": 1,
            "transactionsExpenseCount": 3,
            "expenseVariationPercentage": 0.0,
            "reserveInMonths": 3.95,
        },
    }
    response = client.post("/internal/v1/profiles/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["model_version"] in {"FALLBACK", "1.0.0"}
    assert data["model_status"] in {"LOADED", "FALLBACK"}


def test_analyze_profile_with_financial_rules(client):
    payload = {
        "model": "FINANCIAL_RULES",
        "monthlyIncome": 5000,
        "debtLevelPercentage": 20,
        "savingFrequency": "MEDIUM",
        "financialReserve": 10000,
        "indicators": {
            "incomeCommitmentPercentage": 60,
            "savingsRatePercentage": 15,
            "fixedExpensesPercentage": 45,
            "nonEssentialExpensesPercentage": 20,
            "recurringExpensesCount": 4,
            "transactionsExpenseCount": 20,
            "expenseVariationPercentage": 2,
            "reserveInMonths": 3,
        },
    }

    response = client.post("/internal/v1/profiles/analyze", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["model_version"] == "RULES-1.0.0"
    assert data["model_status"] == "LOADED"
    assert data["classification"] in {"SAUDAVEL", "EM_OBSERVACAO", "EM_RISCO"}


def test_agent_respond(client):
    payload = {
        "conversation_id": "conv-1",
        "user_id": "user-1",
        "messages": [{"role": "user", "content": "Como esta meu perfil financeiro?"}],
        "context": {
            "financial_profile": {"monthlyIncome": 5000.0},
            "indicators": {"savingsRatePercentage": 5.0},
            "spending_summary": {},
            "recommendations": [],
        },
    }
    response = client.post("/internal/v1/agent/respond", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["message"]["role"] == "assistant"
    assert "educacional" in data["disclaimer"].lower()
    assert len(data["tool_calls"]) > 0


def test_agent_respond_stream_uses_named_sse_events(client):
    payload = {
        "conversation_id": "conv-1",
        "user_id": "user-1",
        "messages": [{"role": "user", "content": "Como esta meu perfil financeiro?"}],
        "context": {
            "financial_profile": {"monthlyIncome": 5000.0},
            "indicators": {"savingsRatePercentage": 5.0},
            "spending_summary": {},
            "recommendations": [],
        },
    }

    with client.stream(
        "POST",
        "/internal/v1/agent/respond/stream",
        json=payload,
    ) as response:
        body = response.read().decode()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: tools" in body
    assert "event: token" in body
    assert 'event: done\ndata: {"type":"done"}' in body
