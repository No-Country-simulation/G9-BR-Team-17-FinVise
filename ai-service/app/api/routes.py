import json
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.agent.orchestration.agent import get_agent
from app.api.security import require_service_token, trusted_user_id
from app.core.config import settings
from app.core.logging import get_logger
from app.model_registry.registry import get_registry
from app.recommendations.rules import get_recommendation_engine
from app.schemas.agent import AgentApiRequest, AgentRequest, AgentResponse
from app.schemas.common import HealthResponse, ModelStatusResponse
from app.schemas.profile import ProfileAnalyzeRequest, ProfileAnalyzeResponse
from app.schemas.recommendation import RecommendationGenerateRequest, RecommendationGenerateResponse
from app.schemas.transaction import TransactionClassifyRequest, TransactionClassifyResponse

logger = get_logger(__name__)
router = APIRouter()
internal_router = APIRouter(
    prefix="/internal/v1",
    dependencies=[Depends(require_service_token)],
)


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="1.0.0",
        environment=settings.environment,
    )


@internal_router.get("/models/status", response_model=ModelStatusResponse)
def models_status() -> ModelStatusResponse:
    registry = get_registry()
    status_dict = registry.status()
    return ModelStatusResponse(
        status=status_dict["status"],
        environment=status_dict["environment"],
        models_required=status_dict["models_required"],
        registered_at=status_dict["registered_at"],
        transaction_classifier=status_dict["transaction_classifier"],
        profile_classifier=status_dict["profile_classifier"],
        llm_provider={
            "provider": settings.llm_provider,
            "enabled": settings.enable_llm and bool(settings.llm_api_key),
            "model": settings.llm_model,
        },
    )


@internal_router.get("/rag/retrieval/metrics")
def rag_retrieval_metrics_status() -> dict:
    from app.agent.rag_metrics import rag_retrieval_metrics

    return rag_retrieval_metrics.snapshot()


@internal_router.post("/transactions/classify", response_model=TransactionClassifyResponse)
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


@internal_router.post("/profiles/analyze", response_model=ProfileAnalyzeResponse)
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


@internal_router.post("/recommendations/generate", response_model=RecommendationGenerateResponse)
def generate_recommendations(request: RecommendationGenerateRequest) -> RecommendationGenerateResponse:
    from app.recommendations.ai_engine import get_ai_recommendation_engine

    engine = get_ai_recommendation_engine()
    try:
        return engine.generate(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Recommendation generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendation generation failed: {exc}",
        ) from exc


@internal_router.post("/agent/respond", response_model=AgentResponse)
def agent_respond(
    request: AgentApiRequest,
    user_id: Annotated[str, Depends(trusted_user_id)],
) -> AgentResponse:
    agent = get_agent()
    try:
        return agent.respond(AgentRequest(user_id=user_id, **request.model_dump()))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent response failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent response failed: {exc}",
        ) from exc


@internal_router.post("/agent/respond/stream")
def agent_respond_stream(
    request: AgentApiRequest,
    user_id: Annotated[str, Depends(trusted_user_id)],
):
    from fastapi.responses import StreamingResponse

    agent = get_agent()

    def event_generator():
        response_stream = None
        try:
            authenticated_request = AgentRequest(
                user_id=user_id,
                **request.model_dump(),
            )
            response_stream = agent.respond_stream(authenticated_request)
            for event in response_stream:
                event_type = event.get("type", "message")
                payload = json.dumps(event, ensure_ascii=False)
                yield f"event: {event_type}\ndata: {payload}\n\n"
            yield 'event: done\ndata: {"type":"done"}\n\n'
        except Exception as exc:  # noqa: BLE001
            logger.exception("Agent streaming response failed")
            payload = json.dumps(
                {"type": "error", "message": str(exc)},
                ensure_ascii=False,
            )
            yield f"event: error\ndata: {payload}\n\n"
        finally:
            close = getattr(response_stream, "close", None)
            if callable(close):
                close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@internal_router.post("/profiles/recommendations")
def get_recommendations(request: ProfileAnalyzeRequest):
    from app.recommendations.ai_engine import get_ai_recommendation_engine

    engine = get_ai_recommendation_engine()
    rec_request = RecommendationGenerateRequest(
        monthlyIncome=request.monthlyIncome,
        debtLevelPercentage=request.debtLevelPercentage,
        savingFrequency=request.savingFrequency,
        financialReserve=request.financialReserve,
        indicators=request.indicators,
    )
    res = engine.generate(rec_request)
    return {"recommendations": [item.model_dump() for item in res.recommendations]}


class RagIndexRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_ids: list[str] = Field(default_factory=list)
    background: bool = False
    max_batches: int | None = Field(default=None, ge=1, le=100)


@internal_router.post("/rag/index")
def rag_index(
    request: RagIndexRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(trusted_user_id)],
):
    """Indexes all un-embedded RAG document chunks for the given user.
    Called by the Java backend after ingesting transactions (CSV or Open Finance).
    """
    from app.agent.rag_service import RAGIndexBusyError, rag_service

    try:
        if request.background:
            background_tasks.add_task(
                rag_service.index_unembedded_chunks,
                user_id,
                request.source_ids,
                request.max_batches,
            )
            return {
                "indexed_count": 0,
                "user_id": user_id,
                "status": "queued",
            }
        count = rag_service.index_unembedded_chunks(
            user_id,
            request.source_ids,
            request.max_batches,
        )
        has_more = rag_service.has_unembedded_chunks(
            user_id,
            request.source_ids,
        )
        return {
            "indexed_count": count,
            "user_id": user_id,
            "has_more": has_more,
            "status": "processing" if has_more else "completed",
        }
    except RAGIndexBusyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("RAG indexing failed for user_id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG indexing failed: {exc}",
        ) from exc


router.include_router(internal_router)
