from pydantic import BaseModel, ConfigDict, Field


class TransactionItem(BaseModel):
    description: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    payment_method: str = ""
    recurrent: bool = False
    channel: str = ""


class TransactionClassifyRequest(BaseModel):
    items: list[TransactionItem] = Field(..., min_length=1)


class TransactionPrediction(BaseModel):
    category: str
    subcategory: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    top_features: list[str]


class TransactionClassifyResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    model_status: str
    predictions: list[TransactionPrediction]
