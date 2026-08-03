from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.agent.orchestration.agent import get_agent, reset_agent
    from app.core.http_client import close_http_client
    from app.model_registry.registry import get_registry

    get_registry()
    get_agent()
    try:
        yield
    finally:
        reset_agent()
        close_http_client()


app = FastAPI(
    title="FinVise AI Service",
    version="1.0.0",
    description="AI service for transaction classification, profile analysis and financial assistant.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
