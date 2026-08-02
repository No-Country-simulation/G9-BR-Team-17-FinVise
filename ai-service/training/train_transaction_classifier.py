import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.pipeline import Pipeline

from app.core.config import settings

logger = logging.getLogger(__name__)

MODEL_VERSION = "1.1.0"
CONFIDENCE_THRESHOLD = 0.60
VALID_SPLITS = {"TRAIN", "VALIDATION"}


def load_data() -> pd.DataFrame:
    path = settings.data_processed_dir / "transaction_train.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Processed dataset not found at {path}. Run prepare_dataset first.")
    return pd.read_parquet(path)


def load_test_data() -> pd.DataFrame:
    path = settings.dataset_raw_dir / "transacoes.csv"
    if not path.exists():
        raise FileNotFoundError(f"Raw dataset not found at {path}.")

    chunks: list[pd.DataFrame] = []
    for chunk in pd.read_csv(path, chunksize=10_000):
        chunk = chunk[(chunk["tipo"] == "DESPESA") & (chunk["split"] == "TEST")]
        chunks.append(chunk)
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()


def evaluate(pipeline: Pipeline, frame: pd.DataFrame) -> dict:
    y_true = frame["categoria"]
    y_pred = pipeline.predict(frame["descricao_normalizada"])
    report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
    return {
        "samples": len(frame),
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "macro_f1": round(f1_score(y_true, y_pred, average="macro", zero_division=0), 4),
        "weighted_f1": round(
            f1_score(y_true, y_pred, average="weighted", zero_division=0), 4
        ),
        "precision_by_category": {
            key: round(value["precision"], 4)
            for key, value in report.items()
            if key not in ("accuracy", "macro avg", "weighted avg")
        },
        "recall_by_category": {
            key: round(value["recall"], 4)
            for key, value in report.items()
            if key not in ("accuracy", "macro avg", "weighted avg")
        },
        "support_by_category": {
            key: int(value["support"])
            for key, value in report.items()
            if key not in ("accuracy", "macro avg", "weighted avg")
        },
        "confusion_matrix": confusion_matrix(
            y_true, y_pred, labels=pipeline.classes_
        ).tolist(),
        "labels": list(pipeline.classes_),
    }


def train() -> None:
    df = load_data()
    df = df.dropna(subset=["descricao_normalizada", "categoria", "usuario_id", "split"])
    df["split"] = df["split"].str.upper().str.strip()
    unexpected_splits = set(df["split"].unique()) - VALID_SPLITS
    if unexpected_splits:
        raise ValueError(f"Unexpected splits in processed dataset: {sorted(unexpected_splits)}")

    train_df = df[df["split"] == "TRAIN"].copy()
    val_df = df[df["split"] == "VALIDATION"].copy()
    test_df = load_test_data().dropna(
        subset=["descricao_normalizada", "categoria", "usuario_id"]
    )
    if train_df.empty or val_df.empty or test_df.empty:
        raise ValueError("TRAIN, VALIDATION and TEST splits must not be empty")

    train_users = set(train_df["usuario_id"].astype(str))
    validation_users = set(val_df["usuario_id"].astype(str))
    test_users = set(test_df["usuario_id"].astype(str))
    if train_users & validation_users or train_users & test_users or validation_users & test_users:
        raise ValueError("User leakage detected between dataset splits")

    logger.info("Train samples: %d | Validation samples: %d", len(train_df), len(val_df))

    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2), min_df=2, max_features=20_000, sublinear_tf=True
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ]
    )

    pipeline.fit(train_df["descricao_normalizada"], train_df["categoria"])
    validation_metrics = evaluate(pipeline, val_df)

    train_validation_df = pd.concat([train_df, val_df], ignore_index=True)
    pipeline.fit(
        train_validation_df["descricao_normalizada"], train_validation_df["categoria"]
    )
    test_metrics = evaluate(pipeline, test_df)

    metrics = {
        **test_metrics,
        "split_policy": "official user-level TRAIN/VALIDATION/TEST",
        "validation_metrics": validation_metrics,
        "test_metrics": test_metrics,
    }

    output_dir = Path(settings.transaction_model_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(pipeline, output_dir / "model.joblib")

    with open(output_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "version": MODEL_VERSION,
                "status": "ACTIVE",
                "trained_at": datetime.now(UTC).isoformat(),
                "model": "TfidfVectorizer + LogisticRegression",
                "confidence_threshold": CONFIDENCE_THRESHOLD,
                "split_policy": "official user-level TRAIN/VALIDATION/TEST",
            },
            f,
            indent=2,
        )

    with open(output_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    with open(output_dir / "labels.json", "w", encoding="utf-8") as f:
        json.dump(list(pipeline.classes_), f, indent=2)

    logger.info("Transaction classifier saved to %s", output_dir)
    logger.info(
        "TEST accuracy: %.4f | Macro F1: %.4f | Weighted F1: %.4f",
        test_metrics["accuracy"],
        test_metrics["macro_f1"],
        test_metrics["weighted_f1"],
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    train()


if __name__ == "__main__":
    main()
