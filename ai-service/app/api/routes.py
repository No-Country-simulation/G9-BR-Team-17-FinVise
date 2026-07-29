from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.agent.orchestration.agent import get_agent
from app.core.config import settings
from app.core.logging import get_logger
from app.model_registry.registry import get_registry
from app.recommendations.rules import get_recommendation_engine
from app.schemas.agent import AgentRequest, AgentResponse
from app.schemas.common import HealthResponse, ModelStatusResponse
from app.schemas.profile import ProfileAnalyzeRequest, ProfileAnalyzeResponse
from app.schemas.transaction import TransactionClassifyRequest, TransactionClassifyResponse

logger = get_logger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="1.0.0",
        environment=settings.environment,
    )


@router.get("/internal/v1/models/status", response_model=ModelStatusResponse)
def models_status() -> ModelStatusResponse:
    registry = get_registry()
    status_dict = registry.status()
    return ModelStatusResponse(
        transaction_classifier=status_dict["transaction_classifier"],
        profile_classifier=status_dict["profile_classifier"],
        llm_provider={
            "provider": settings.llm_provider,
            "enabled": settings.enable_llm and bool(settings.llm_api_key),
            "model": settings.llm_model,
        },
    )


@router.post("/internal/v1/transactions/classify", response_model=TransactionClassifyResponse)
def classify_transactions(request: TransactionClassifyRequest) -> TransactionClassifyResponse:
    registry = get_registry()
    classifier = registry.transaction_classifier
    try:
        predictions = classifier.predict(request.items)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Transaction classification failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {exc}",
        ) from exc

    return TransactionClassifyResponse(
        model_version=classifier.version,
        model_status=classifier.status,
        predictions=predictions,
    )


@router.post("/internal/v1/profiles/analyze", response_model=ProfileAnalyzeResponse)
def analyze_profile(request: ProfileAnalyzeRequest) -> ProfileAnalyzeResponse:
    registry = get_registry()
    model = request.model.strip().upper()
    if model == "FINANCIAL_RULES":
        classifier = registry.profile_rule_classifier
    elif model == "MACHINE_LEARNING":
        classifier = registry.profile_classifier
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported profile model: {request.model}",
        )
    try:
        result = classifier.predict(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Profile analysis failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile analysis failed: {exc}",
        ) from exc
    return result


@router.post("/internal/v1/agent/respond", response_model=AgentResponse)
def agent_respond(request: AgentRequest) -> AgentResponse:
    agent = get_agent()
    try:
        return agent.respond(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent response failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent response failed: {exc}",
        ) from exc


@router.post("/internal/v1/agent/respond/stream")
def agent_respond_stream(request: AgentRequest):
    from fastapi.responses import StreamingResponse

    agent = get_agent()

    def event_generator():
        try:
            for chunk in agent.respond_stream(request):
                import json
                yield f"data: {json.dumps({'token': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:  # noqa: BLE001
            logger.exception("Agent streaming response failed")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/internal/v1/profiles/recommendations")
def get_recommendations(request: ProfileAnalyzeRequest):
    engine = get_recommendation_engine()
    return {"recommendations": engine.recommend(request)}


class RagIndexRequest(BaseModel):
    user_id: str


@router.post("/internal/v1/rag/index")
def rag_index(request: RagIndexRequest):
    """Indexes all un-embedded RAG document chunks for the given user.
    Called by the Java backend after ingesting transactions (CSV or Open Finance).
    """
    from app.agent.rag_service import rag_service

    if not request.user_id or not request.user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user_id is required",
        )
    try:
        count = rag_service.index_unembedded_chunks(request.user_id.strip())
        return {"indexed_count": count, "user_id": request.user_id}
    except Exception as exc:  # noqa: BLE001
        logger.exception("RAG indexing failed for user_id=%s", request.user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG indexing failed: {exc}",
        ) from exc
