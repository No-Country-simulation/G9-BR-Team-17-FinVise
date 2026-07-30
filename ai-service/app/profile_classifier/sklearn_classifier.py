from pathlib import Path

import joblib
import numpy as np

from app.core.config import settings
from app.core.exceptions import ModelNotLoadedError
from app.core.logging import get_logger
from app.model_registry.artifacts import load_json_list, validate_model_artifacts
from app.profile_classifier.base import BaseProfileClassifier
from app.schemas.profile import ProfileAnalyzeRequest, ProfileAnalyzeResponse

logger = get_logger(__name__)

FEATURE_NAMES = [
    "percentual_renda_comprometida",
    "nivel_endividamento_pct",
    "taxa_poupanca_pct",
    "percentual_despesas_fixas",
    "percentual_gastos_nao_essenciais",
    "quantidade_despesas_recorrentes",
    "quantidade_transacoes_despesa",
    "variacao_despesas_pct",
    "reserva_em_meses",
]


class SklearnProfileClassifier(BaseProfileClassifier):
    name: str = "SklearnProfileClassifier"

    def __init__(self, model_dir: Path | None = None):
        self.model_dir = Path(model_dir or settings.profile_model_path)
        self.model = None
        self.preprocessor = None
        self.metadata: dict = {}
        self.feature_names: list[str] = []
        self._load()

    def _load(self) -> None:
        model_path = self.model_dir / "model.joblib"
        preprocessor_path = self.model_dir / "preprocessor.joblib"
        feature_names_path = self.model_dir / "feature_names.json"
        validation = validate_model_artifacts(
            "profile-classifier",
            self.model_dir,
            ("model.joblib", "metadata.json", "feature_names.json"),
            settings.profile_model_version,
        )
        self.model_dir = validation.model_dir
        model_path = self.model_dir / "model.joblib"
        preprocessor_path = self.model_dir / "preprocessor.joblib"
        feature_names_path = self.model_dir / "feature_names.json"
        self.metadata = validation.metadata
        self.artifact_checksums = validation.checksums
        self.artifact_status = validation.status

        self.model = joblib.load(model_path)
        if preprocessor_path.exists():
            self.preprocessor = joblib.load(preprocessor_path)

        self.feature_names = load_json_list(
            feature_names_path, "profile-classifier features"
        )
        if self.feature_names != FEATURE_NAMES:
            raise ModelNotLoadedError(
                "profile-classifier features do not match the application schema"
            )

        self.version = validation.version
        self.status = "LOADED"
        logger.info("Loaded profile classifier version %s from %s", self.version, model_path)

    def predict(self, request: ProfileAnalyzeRequest) -> ProfileAnalyzeResponse:
        if self.model is None:
            raise ModelNotLoadedError("Profile model is not loaded")

        features = self._extract_features(request)
        x = np.array([features]).reshape(1, -1)

        if self.preprocessor is not None:
            x = self.preprocessor.transform(x)

        prediction = self.model.predict(x)[0]
        probability = self._predict_proba(x)
        confidence = float(max(probability[0])) if probability is not None else 1.0

        score = self._estimate_score(request)
        factors = self._main_factors(request)

        return ProfileAnalyzeResponse(
            model_version=self.version,
            model_status=self.status,
            classification=str(prediction).upper(),
            confidence=round(confidence, 2),
            score=round(score, 2),
            main_factors=factors,
        )

    def _extract_features(self, request: ProfileAnalyzeRequest) -> list[float]:
        indicators = request.indicators
        return [
            indicators.incomeCommitmentPercentage,
            request.debtLevelPercentage,
            indicators.savingsRatePercentage,
            indicators.fixedExpensesPercentage,
            indicators.nonEssentialExpensesPercentage,
            float(indicators.recurringExpensesCount),
            float(indicators.transactionsExpenseCount),
            indicators.expenseVariationPercentage,
            indicators.reserveInMonths,
        ]

    def _predict_proba(self, x):
        if not hasattr(self.model, "predict_proba"):
            return None
        return self.model.predict_proba(x)

    def _estimate_score(self, request: ProfileAnalyzeRequest) -> float:
        # Simple heuristic aligned with fallback score logic.
        indicators = request.indicators
        score = 100.0
        score -= max(0, request.debtLevelPercentage - 10) * 0.5
        score -= max(0, indicators.incomeCommitmentPercentage - 50) * 0.4
        score -= max(0, 10 - indicators.savingsRatePercentage) * 1.5
        score -= max(0, 3 - indicators.reserveInMonths) * 5
        score -= max(0, indicators.fixedExpensesPercentage - 40) * 0.2
        score -= max(0, indicators.nonEssentialExpensesPercentage - 30) * 0.2
        return max(0.0, min(100.0, score))

    def _main_factors(self, request: ProfileAnalyzeRequest) -> list[str]:
        indicators = request.indicators
        factors: list[str] = []
        if request.debtLevelPercentage >= 50:
            factors.append("Nivel de endividamento elevado")
        elif request.debtLevelPercentage >= 25:
            factors.append("Nivel de endividamento moderado")
        if indicators.incomeCommitmentPercentage >= 80:
            factors.append("Renda muito comprometida")
        if indicators.savingsRatePercentage < 5:
            factors.append("Baixa taxa de poupanca")
        if indicators.reserveInMonths < 1:
            factors.append("Reserva de emergencia insuficiente")
        if not factors:
            factors.append("Indicadores financeiros equilibrados")
        return factors
