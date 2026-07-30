from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class ModelStatusResponse(BaseModel):
    status: str
    environment: str
    models_required: bool
    registered_at: str
    transaction_classifier: dict
    profile_classifier: dict
    llm_provider: dict


class Message(BaseModel):
    role: str
    content: str
