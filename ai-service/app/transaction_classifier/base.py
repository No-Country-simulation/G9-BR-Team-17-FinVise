from abc import ABC, abstractmethod

from app.schemas.transaction import TransactionItem, TransactionPrediction


class BaseTransactionClassifier(ABC):
    name: str = "base"
    version: str = "0.0.0"
    status: str = "NOT_LOADED"

    @abstractmethod
    def predict(self, items: list[TransactionItem]) -> list[TransactionPrediction]:
        raise NotImplementedError
