from datetime import UTC, datetime
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import ModelNotLoadedError
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
        self.registered_at = datetime.now(UTC).isoformat()
        self.model_records: dict[str, dict] = {}
        self.transaction_classifier: BaseTransactionClassifier = self._load_transaction_classifier()
        self.profile_classifier: BaseProfileClassifier = self._load_profile_classifier()
        self.profile_rule_classifier: BaseProfileClassifier = RuleBasedProfileClassifier()

    def _load_transaction_classifier(self) -> BaseTransactionClassifier:
        model_dir = Path(settings.transaction_model_path)
        if (model_dir / "model.joblib").exists():
            try:
                clf = SklearnTransactionClassifier(model_dir)
                self._register_model(
                    "transaction_classifier", clf, model_dir, "VALID"
                )
                return clf
            except Exception as exc:  # noqa: BLE001
                self._raise_if_models_required("transaction-classifier", exc)
                logger.warning("Failed to load sklearn transaction classifier: %s", exc)
                fallback = FallbackTransactionClassifier()
                self._register_model(
                    "transaction_classifier",
                    fallback,
                    model_dir,
                    "INVALID",
                    str(exc),
                )
                return fallback
        else:
            error = ModelNotLoadedError(f"model not found at {model_dir}")
            self._raise_if_models_required(
                "transaction-classifier",
                error,
            )
            fallback = FallbackTransactionClassifier()
            self._register_model(
                "transaction_classifier",
                fallback,
                model_dir,
                "MISSING",
                str(error),
            )
            logger.info("Using fallback transaction classifier")
            return fallback

    def _load_profile_classifier(self) -> BaseProfileClassifier:
        model_dir = Path(settings.profile_model_path)
        if (model_dir / "model.joblib").exists():
            try:
                clf = SklearnProfileClassifier(model_dir)
                self._register_model(
                    "profile_classifier", clf, model_dir, "VALID"
                )
                return clf
            except Exception as exc:  # noqa: BLE001
                self._raise_if_models_required("profile-classifier", exc)
                logger.warning("Failed to load sklearn profile classifier: %s", exc)
                fallback = FallbackProfileClassifier()
                self._register_model(
                    "profile_classifier",
                    fallback,
                    model_dir,
                    "INVALID",
                    str(exc),
                )
                return fallback
        else:
            error = ModelNotLoadedError(f"model not found at {model_dir}")
            self._raise_if_models_required(
                "profile-classifier",
                error,
            )
            fallback = FallbackProfileClassifier()
            self._register_model(
                "profile_classifier",
                fallback,
                model_dir,
                "MISSING",
                str(error),
            )
            logger.info("Using fallback profile classifier")
            return fallback

    def _raise_if_models_required(self, model_name: str, exc: Exception) -> None:
        if self.models_required:
            raise ModelNotLoadedError(
                f"Active {model_name} is required but invalid: {exc}"
            ) from exc

    @property
    def models_required(self) -> bool:
        production = settings.environment.strip().lower() in {"production", "prod"}
        return bool(settings.require_active_models or production)

    def _register_model(
        self,
        key: str,
        classifier: BaseTransactionClassifier | BaseProfileClassifier,
        model_dir: Path,
        artifact_status: str,
        error: str | None = None,
    ) -> None:
        checksums = getattr(classifier, "artifact_checksums", {})
        self.model_records[key] = {
            "name": classifier.name,
            "version": classifier.version,
            "status": classifier.status,
            "active": classifier.status == "LOADED" and artifact_status == "VALID",
            "artifact_status": artifact_status,
            "artifact_path": str(Path(model_dir).resolve()),
            "artifact_sha256": checksums.get("model.joblib"),
            "metadata_sha256": checksums.get("metadata.json"),
            "registered_at": datetime.now(UTC).isoformat(),
            "error": error,
        }

    def status(self) -> dict:
        return {
            "status": (
                "READY"
                if all(record["active"] for record in self.model_records.values())
                else "DEGRADED"
            ),
            "environment": settings.environment,
            "models_required": self.models_required,
            "registered_at": self.registered_at,
            "transaction_classifier": self.model_records["transaction_classifier"],
            "profile_classifier": self.model_records["profile_classifier"],
        }


_registry: ModelRegistry | None = None


def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry
