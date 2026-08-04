from fastapi.testclient import TestClient

from app.main import app

TEST_SERVICE_TOKEN = "test-ai-service-token-with-at-least-32-characters"


def test_clean_startup_loads_the_application():
    with TestClient(app) as startup_client:
        response = startup_client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_internal_route_rejects_missing_service_token():
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.get("/internal/v1/models/status")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_internal_route_rejects_invalid_service_token():
    with TestClient(
        app,
        headers={"Authorization": "Bearer invalid-service-token"},
    ) as invalid_client:
        response = invalid_client.get("/internal/v1/models/status")

    assert response.status_code == 401


def test_user_route_rejects_missing_trusted_user_header():
    with TestClient(
        app,
        headers={"Authorization": f"Bearer {TEST_SERVICE_TOKEN}"},
    ) as service_client:
        response = service_client.post(
            "/internal/v1/rag/index",
            json={"source_ids": []},
        )

    assert response.status_code == 400
    assert "X-FinVise-User-Id" in response.json()["detail"]


def test_user_route_rejects_user_id_from_payload(client):
    response = client.post(
        "/internal/v1/rag/index",
        json={
            "user_id": "00000000-0000-0000-0000-000000000000",
            "source_ids": [],
        },
    )

    assert response.status_code == 422


def test_models_status(client):
    response = client.get("/internal/v1/models/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in {"READY", "DEGRADED"}
    assert data["registered_at"]
    assert isinstance(data["models_required"], bool)
    assert "transaction_classifier" in data
    assert "profile_classifier" in data
    assert data["transaction_classifier"]["status"] in {"LOADED", "FALLBACK"}
    assert data["profile_classifier"]["status"] in {"LOADED", "FALLBACK"}


def test_rag_retrieval_metrics_are_service_authenticated(client):
    response = client.get("/internal/v1/rag/retrieval/metrics")

    assert response.status_code == 200
    assert "requests" in response.json()
    assert "latency_ms" in response.json()


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


def test_rag_index_limits_work_and_reports_remaining_documents(client, monkeypatch):
    from app.agent.rag_service import rag_service

    received = {}

    def index_batch(user_id, source_ids, max_batches):
        received.update(
            user_id=user_id,
            source_ids=source_ids,
            max_batches=max_batches,
        )
        return 200

    monkeypatch.setattr(rag_service, "index_unembedded_chunks", index_batch)
    monkeypatch.setattr(rag_service, "has_unembedded_chunks", lambda *_args: True)

    response = client.post(
        "/internal/v1/rag/index",
        json={
            "source_ids": [],
            "max_batches": 1,
        },
    )

    assert response.status_code == 200
    assert response.json()["indexed_count"] == 200
    assert response.json()["has_more"] is True
    assert response.json()["status"] == "processing"
    assert received["max_batches"] == 1


def test_rag_index_returns_conflict_when_user_is_already_being_processed(
    client, monkeypatch
):
    from app.agent.rag_service import RAGIndexBusyError, rag_service

    def busy(*_args):
        raise RAGIndexBusyError("RAG indexing already running")

    monkeypatch.setattr(rag_service, "index_unembedded_chunks", busy)

    response = client.post(
        "/internal/v1/rag/index",
        json={},
    )

    assert response.status_code == 409


def test_agent_respond_uses_authenticated_header_identity(client, monkeypatch):
    from app.agent.rag_service import rag_service

    received = {}

    def retrieve_context(user_id, *_args):
        received["user_id"] = user_id
        return []

    monkeypatch.setattr(rag_service, "retrieve_context", retrieve_context)
    payload = {
        "conversation_id": "conv-1",
        "messages": [{"role": "user", "content": "Como esta meu perfil financeiro?"}],
        "context": {
            "schema_version": "1.0",
            "financial_profile": {"monthly_income": 5000.0},
            "indicators": {"savings_rate_pct": 5.0},
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
    assert received["user_id"] == "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"


def test_agent_respond_compares_two_latest_months(client):
    payload = {
        "conversation_id": "conv-comparison",
        "messages": [
            {"role": "user", "content": "Compare novembro com dezembro"}
        ],
        "context": {
            "schema_version": "1.0",
            "analytical_facts": {
                "months": [
                    {
                        "period": "2024-11",
                        "transaction_count": 2,
                        "total_income": 5000.0,
                        "total_expenses": 1000.0,
                        "balance": 4000.0,
                    },
                    {
                        "period": "2024-12",
                        "transaction_count": 3,
                        "total_income": 6000.0,
                        "total_expenses": 1500.0,
                        "balance": 4500.0,
                    },
                ]
            },
        },
    }

    response = client.post("/internal/v1/agent/respond", json=payload)

    assert response.status_code == 200
    tool_call = next(
        item
        for item in response.json()["tool_calls"]
        if item["tool"] == "compare_periods"
    )
    assert tool_call["result"]["comparison_basis"] == "MONTHLY"
    assert tool_call["result"]["current_period"]["period"] == "2024-12"
    assert tool_call["result"]["previous_period"]["period"] == "2024-11"
    assert tool_call["result"]["changes"]["balance"] == 500.0


def test_agent_respond_stream_uses_named_sse_events(client):
    payload = {
        "conversation_id": "conv-1",
        "messages": [{"role": "user", "content": "Como esta meu perfil financeiro?"}],
        "context": {
            "schema_version": "1.0",
            "financial_profile": {"monthly_income": 5000.0},
            "indicators": {"savings_rate_pct": 5.0},
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
    assert "event: sources" in body
    assert "event: token" in body
    assert 'event: done\ndata: {"type":"done"}' in body
