import json
from pathlib import Path

import joblib

from app.core.config import settings
from app.core.exceptions import ModelNotLoadedError
from app.core.logging import get_logger
from app.preprocessing.text import normalize_text
from app.schemas.transaction import TransactionItem, TransactionPrediction
from app.transaction_classifier.base import BaseTransactionClassifier
from app.transaction_classifier.fallback import FallbackTransactionClassifier

logger = get_logger(__name__)

DEFAULT_CONFIDENCE_THRESHOLD = 0.60


class SklearnTransactionClassifier(BaseTransactionClassifier):
    name: str = "SklearnTransactionClassifier"

    def __init__(self, model_dir: Path | None = None):
        self.model_dir = Path(model_dir or settings.transaction_model_path)
        self.pipeline = None
        self.metadata: dict = {}
        self.labels: list[str] = []
        self.confidence_threshold = DEFAULT_CONFIDENCE_THRESHOLD
        self.fallback_classifier = FallbackTransactionClassifier()
        self._load()

    def _load(self) -> None:
        model_path = self.model_dir / "model.joblib"
        metadata_path = self.model_dir / "metadata.json"
        labels_path = self.model_dir / "labels.json"

        if not model_path.exists():
            raise ModelNotLoadedError(f"Transaction model not found at {model_path}")

        self.pipeline = joblib.load(model_path)

        if metadata_path.exists():
            with open(metadata_path, encoding="utf-8") as f:
                self.metadata = json.load(f)

        if labels_path.exists():
            with open(labels_path, encoding="utf-8") as f:
                self.labels = json.load(f)
        elif hasattr(self.pipeline, "classes_"):
            self.labels = list(self.pipeline.classes_)

        self.version = self.metadata.get("version", "1.0.0")
        self.confidence_threshold = float(
            self.metadata.get("confidence_threshold", DEFAULT_CONFIDENCE_THRESHOLD)
        )
        self.status = "LOADED"
        logger.info(
            "Loaded transaction classifier version %s from %s (confidence threshold %.2f)",
            self.version,
            model_path,
            self.confidence_threshold,
        )

    def predict(self, items: list[TransactionItem]) -> list[TransactionPrediction]:
        if self.pipeline is None:
            raise ModelNotLoadedError("Transaction model is not loaded")

        texts = [normalize_text(item.description) for item in items]
        predicted = self.pipeline.predict(texts)
        probabilities = self._predict_proba(texts)
        fallback_predictions = self.fallback_classifier.predict(items)

        predictions: list[TransactionPrediction] = []
        for i, category in enumerate(predicted):
            proba = probabilities[i]
            confidence = float(max(proba)) if proba is not None else 1.0
            ml_category = str(category).upper()
            fallback = fallback_predictions[i]

            if confidence < self.confidence_threshold:
                predictions.append(fallback)
                continue

            subcategory = (
                fallback.subcategory
                if fallback.category == ml_category and fallback.category != "OUTROS"
                else ml_category
            )
            predictions.append(
                TransactionPrediction(
                    category=ml_category,
                    subcategory=subcategory,
                    confidence=round(confidence, 4),
                    top_features=self._top_features(texts[i], ml_category),
                )
            )
        return predictions

    def _predict_proba(self, texts: list[str]):
        if not hasattr(self.pipeline, "predict_proba"):
            return [None] * len(texts)
        return self.pipeline.predict_proba(texts)

    def _top_features(self, text: str, category: str) -> list[str]:
        try:
            steps = self.pipeline.named_steps
            vectorizer = steps.get("tfidf")
            classifier = steps.get("clf") or steps.get("classifier")
            if vectorizer is None or classifier is None or not hasattr(classifier, "coef_"):
                raise AttributeError("Pipeline does not expose TF-IDF coefficients")

            class_index = list(classifier.classes_).index(category)
            vector = vectorizer.transform([text]).tocoo()
            feature_names = vectorizer.get_feature_names_out()
            weighted_features = [
                (float(value) * float(classifier.coef_[class_index, column]), feature_names[column])
                for column, value in zip(vector.col, vector.data, strict=False)
            ]
            positive_features = [
                feature for score, feature in sorted(weighted_features, reverse=True) if score > 0
            ]
            if positive_features:
                return positive_features[:3]
        except (AttributeError, KeyError, ValueError, IndexError):
            logger.debug("Could not extract model coefficients for category %s", category)

        tokens = text.split()[:3]
        return tokens if tokens else [category.lower()]
