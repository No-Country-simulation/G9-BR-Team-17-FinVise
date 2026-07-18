from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger
from app.profile_classifier.base import BaseProfileClassifier
from app.profile_classifier.fallback import FallbackProfileClassifier
from app.profile_classifier.rule_based import RuleBasedProfileClassifier
from app.profile_classifier.sklearn_classifier import SklearnProfileClassifier
from app.transaction_classifier.base import BaseTransactionClassifier
from app.transaction_classifier.fallback import FallbackTransactionClassifier
from app.transaction_classifier.sklearn_classifier import SklearnTransactionClassifier

logger = get_logger(__name__)


class ModelRegistry:
    def __init__(self):
        self.transaction_classifier: BaseTransactionClassifier = self._load_transaction_classifier()
        self.profile_classifier: BaseProfileClassifier = self._load_profile_classifier()
        self.profile_rule_classifier: BaseProfileClassifier = RuleBasedProfileClassifier()

    def _load_transaction_classifier(self) -> BaseTransactionClassifier:
        model_dir = Path(settings.transaction_model_path)
        if (model_dir / "model.joblib").exists():
            try:
                clf = SklearnTransactionClassifier(model_dir)
                return clf
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to load sklearn transaction classifier: %s", exc)
        logger.info("Using fallback transaction classifier")
        return FallbackTransactionClassifier()

    def _load_profile_classifier(self) -> BaseProfileClassifier:
        model_dir = Path(settings.profile_model_path)
        if (model_dir / "model.joblib").exists():
            try:
                clf = SklearnProfileClassifier(model_dir)
                return clf
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to load sklearn profile classifier: %s", exc)
        logger.info("Using fallback profile classifier")
        return FallbackProfileClassifier()

    def status(self) -> dict:
        return {
            "transaction_classifier": {
                "name": self.transaction_classifier.name,
                "version": self.transaction_classifier.version,
                "status": self.transaction_classifier.status,
            },
            "profile_classifier": {
                "name": self.profile_classifier.name,
                "version": self.profile_classifier.version,
                "status": self.profile_classifier.status,
            },
        }


_registry: ModelRegistry | None = None


def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry
