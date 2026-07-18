from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class ModelStatusResponse(BaseModel):
    transaction_classifier: dict
    profile_classifier: dict
    llm_provider: dict


class Message(BaseModel):
    role: str
    content: str
