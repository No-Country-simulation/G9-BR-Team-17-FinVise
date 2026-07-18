from abc import ABC, abstractmethod

from app.schemas.profile import ProfileAnalyzeRequest, ProfileAnalyzeResponse


class BaseProfileClassifier(ABC):
    name: str = "base"
    version: str = "0.0.0"
    status: str = "NOT_LOADED"

    @abstractmethod
    def predict(self, request: ProfileAnalyzeRequest) -> ProfileAnalyzeResponse:
        raise NotImplementedError
