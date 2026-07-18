import hashlib
import json
import logging
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from app.core.config import settings
from app.profile_classifier.sklearn_classifier import FEATURE_NAMES

logger = logging.getLogger(__name__)

REQUIRED_SPLITS = ("TRAIN", "VALIDATION", "TEST")
BOOTSTRAP_RESAMPLES = 500
BOOTSTRAP_SEED = 42


def _round(value: float) -> float:
    return round(float(value), 6)


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def _dataframe_fingerprint(frame: pd.DataFrame, columns: list[str]) -> str:
    normalized = frame.loc[:, columns].fillna("").astype(str).reset_index(drop=True)
    row_hashes = pd.util.hash_pandas_object(normalized, index=False).values
    return hashlib.sha256(row_hashes.tobytes()).hexdigest()


def _assert_independent_users(
    split_users: dict[str, set[str]],
    dataset_name: str,
) -> dict[str, Any]:
    missing = [split for split in REQUIRED_SPLITS if not split_users.get(split)]
    if missing:
        raise ValueError(f"{dataset_name}: empty or missing splits: {missing}")

    overlap: dict[str, int] = {}
    for left, right in combinations(REQUIRED_SPLITS, 2):
        key = f"{left}_vs_{right}"
        overlap[key] = len(split_users[left] & split_users[right])

    if any(overlap.values()):
        raise ValueError(f"{dataset_name}: user leakage detected: {overlap}")

    return {
        "unit": "usuario_id",
        "users_by_split": {
            split: len(split_users[split])
            for split in REQUIRED_SPLITS
        },
        "overlap_users": overlap,
        "passed": True,
    }


def _bootstrap_confidence_intervals(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> dict[str, dict[str, float]]:
    rng = np.random.default_rng(BOOTSTRAP_SEED)
    sample_count = len(y_true)
    distributions: dict[str, list[float]] = {
        "accuracy": [],
        "macro_f1": [],
        "weighted_f1": [],
    }

    for _ in range(BOOTSTRAP_RESAMPLES):
        indices = rng.integers(0, sample_count, size=sample_count)
        sampled_true = y_true[indices]
        sampled_pred = y_pred[indices]
        distributions["accuracy"].append(accuracy_score(sampled_true, sampled_pred))
        distributions["macro_f1"].append(
            f1_score(sampled_true, sampled_pred, average="macro", zero_division=0)
        )
        distributions["weighted_f1"].append(
            f1_score(sampled_true, sampled_pred, average="weighted", zero_division=0)
        )

    return {
        metric: {
            "lower": _round(np.percentile(values, 2.5)),
            "upper": _round(np.percentile(values, 97.5)),
        }
        for metric, values in distributions.items()
    }


def _evaluate_predictions(
    y_true: pd.Series | np.ndarray,
    y_pred: np.ndarray,
    labels: list[str],
) -> dict[str, Any]:
    true_values = np.asarray(y_true, dtype=str)
    predicted_values = np.asarray(y_pred, dtype=str)
    report = classification_report(
        true_values,
        predicted_values,
        labels=labels,
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(true_values, predicted_values, labels=labels)

    return {
        "samples": int(len(true_values)),
        "correct_predictions": int((true_values == predicted_values).sum()),
        "incorrect_predictions": int((true_values != predicted_values).sum()),
        "accuracy": _round(accuracy_score(true_values, predicted_values)),
        "balanced_accuracy": _round(
            balanced_accuracy_score(true_values, predicted_values)
        ),
        "macro_precision": _round(
            precision_score(
                true_values,
                predicted_values,
                average="macro",
                zero_division=0,
            )
        ),
        "macro_recall": _round(
            recall_score(
                true_values,
                predicted_values,
                average="macro",
                zero_division=0,
            )
        ),
        "macro_f1": _round(
            f1_score(
                true_values,
                predicted_values,
                average="macro",
                zero_division=0,
            )
        ),
        "weighted_f1": _round(
            f1_score(
                true_values,
                predicted_values,
                average="weighted",
                zero_division=0,
            )
        ),
        "confidence_intervals_95": _bootstrap_confidence_intervals(
            true_values,
            predicted_values,
        ),
        "per_class": {
            label: {
                "precision": _round(report[label]["precision"]),
                "recall": _round(report[label]["recall"]),
                "f1": _round(report[label]["f1-score"]),
                "support": int(report[label]["support"]),
            }
            for label in labels
        },
        "labels": labels,
        "confusion_matrix": matrix.tolist(),
    }


def _write_model_artifacts(
    model_name: str,
    report: dict[str, Any],
    model_dir: Path,
    report_dir: Path,
) -> None:
    model_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    for destination in (
        model_dir / "final_test_metrics.json",
        report_dir / f"{model_name}.json",
    ):
        with destination.open("w", encoding="utf-8") as stream:
            json.dump(report, stream, indent=2, ensure_ascii=False)

    per_class = pd.DataFrame.from_dict(
        report["metrics"]["per_class"],
        orient="index",
    )
    per_class.index.name = "class"
    per_class.to_csv(
        report_dir / f"{model_name}-per-class.csv",
        encoding="utf-8",
    )

    labels = report["metrics"]["labels"]
    matrix = pd.DataFrame(
        report["metrics"]["confusion_matrix"],
        index=labels,
        columns=labels,
    )
    matrix.index.name = "actual"
    matrix.columns.name = "predicted"
    matrix.to_csv(
        report_dir / f"{model_name}-confusion-matrix.csv",
        encoding="utf-8",
    )


def _load_transaction_test_set() -> tuple[pd.DataFrame, dict[str, Any]]:
    path = settings.dataset_raw_dir / "transacoes.csv"
    if not path.exists():
        raise FileNotFoundError(f"Transaction dataset not found at {path}")

    test_chunks: list[pd.DataFrame] = []
    split_users = {split: set() for split in REQUIRED_SPLITS}

    for chunk in pd.read_csv(path, chunksize=10_000):
        expenses = chunk[chunk["tipo"].eq("DESPESA")].copy()
        expenses["split"] = expenses["split"].astype(str).str.upper().str.strip()
        for split in REQUIRED_SPLITS:
            split_frame = expenses[expenses["split"].eq(split)]
            split_users[split].update(split_frame["usuario_id"].dropna().astype(str))
        test_chunks.append(expenses[expenses["split"].eq("TEST")])

    test_frame = pd.concat(test_chunks, ignore_index=True)
    test_frame = test_frame.dropna(
        subset=["descricao_normalizada", "categoria", "usuario_id"]
    )
    evidence = _assert_independent_users(split_users, "transactions")
    evidence["test_set_fingerprint_sha256"] = _dataframe_fingerprint(
        test_frame,
        ["usuario_id", "descricao_normalizada", "categoria", "split"],
    )
    return test_frame, evidence


def _load_profile_test_set() -> tuple[pd.DataFrame, dict[str, Any]]:
    path = settings.dataset_raw_dir / "perfis_mensais.csv"
    if not path.exists():
        raise FileNotFoundError(f"Profile dataset not found at {path}")

    frame = pd.read_csv(path)
    frame["split"] = frame["split"].astype(str).str.upper().str.strip()
    split_users = {
        split: set(
            frame.loc[frame["split"].eq(split), "usuario_id"].dropna().astype(str)
        )
        for split in REQUIRED_SPLITS
    }
    test_frame = frame[frame["split"].eq("TEST")].copy()
    test_frame = test_frame.dropna(
        subset=[*FEATURE_NAMES, "perfil_financeiro", "usuario_id"]
    )
    evidence = _assert_independent_users(split_users, "profiles")
    evidence["test_set_fingerprint_sha256"] = _dataframe_fingerprint(
        test_frame,
        ["usuario_id", *FEATURE_NAMES, "perfil_financeiro", "split"],
    )
    return test_frame, evidence


def evaluate_transaction_classifier(report_dir: Path) -> dict[str, Any]:
    model_dir = Path(settings.transaction_model_path)
    model_path = model_dir / "model.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"Transaction model not found at {model_path}")

    pipeline = joblib.load(model_path)
    test_frame, independence = _load_transaction_test_set()
    y_true = test_frame["categoria"].astype(str)
    y_pred = pipeline.predict(test_frame["descricao_normalizada"])
    labels = [str(label) for label in pipeline.classes_]
    metadata = _load_json(model_dir / "metadata.json")

    report = {
        "model": "transaction-classifier",
        "model_version": metadata.get("version", "unknown"),
        "model_type": metadata.get("model", type(pipeline).__name__),
        "evaluation_split": "TEST",
        "dataset": "finance_ai_dataset/transacoes.csv",
        "independence": independence,
        "metrics": _evaluate_predictions(y_true, y_pred, labels),
    }
    _write_model_artifacts(
        "transaction-classifier",
        report,
        model_dir,
        report_dir,
    )
    return report


def evaluate_profile_classifier(report_dir: Path) -> dict[str, Any]:
    model_dir = Path(settings.profile_model_path)
    model_path = model_dir / "model.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"Profile model not found at {model_path}")

    model = joblib.load(model_path)
    preprocessor_path = model_dir / "preprocessor.joblib"
    preprocessor = (
        joblib.load(preprocessor_path)
        if preprocessor_path.exists()
        else None
    )
    test_frame, independence = _load_profile_test_set()
    features = test_frame[FEATURE_NAMES].values
    if preprocessor is not None:
        features = preprocessor.transform(features)
    y_true = test_frame["perfil_financeiro"].astype(str)
    y_pred = model.predict(features)
    labels = [str(label) for label in model.classes_]
    metadata = _load_json(model_dir / "metadata.json")

    report = {
        "model": "profile-classifier",
        "model_version": metadata.get("version", "unknown"),
        "model_type": metadata.get("model", type(model).__name__),
        "evaluation_split": "TEST",
        "dataset": "finance_ai_dataset/perfis_mensais.csv",
        "features": FEATURE_NAMES,
        "independence": independence,
        "metrics": _evaluate_predictions(y_true, y_pred, labels),
    }
    _write_model_artifacts(
        "profile-classifier",
        report,
        model_dir,
        report_dir,
    )
    return report


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    report_dir = Path(settings.evaluation_report_dir)
    generated_at = datetime.now(timezone.utc).isoformat()

    transaction_report = evaluate_transaction_classifier(report_dir)
    profile_report = evaluate_profile_classifier(report_dir)
    combined_report = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "evaluation_protocol": {
            "split": "TEST",
            "model_selection_data": ["TRAIN", "VALIDATION"],
            "evaluation_retrains_models": False,
            "test_labels_used_for_model_selection": False,
            "independence_unit": "usuario_id",
            "confidence_interval": {
                "method": "percentile bootstrap",
                "confidence": 0.95,
                "resamples": BOOTSTRAP_RESAMPLES,
                "seed": BOOTSTRAP_SEED,
            },
        },
        "models": {
            "transaction_classifier": transaction_report,
            "profile_classifier": profile_report,
        },
    }

    report_dir.mkdir(parents=True, exist_ok=True)
    with (report_dir / "final-test-metrics.json").open(
        "w",
        encoding="utf-8",
    ) as stream:
        json.dump(combined_report, stream, indent=2, ensure_ascii=False)

    for report in (transaction_report, profile_report):
        metrics = report["metrics"]
        logger.info(
            "%s TEST | samples=%d accuracy=%.4f macro_f1=%.4f weighted_f1=%.4f",
            report["model"],
            metrics["samples"],
            metrics["accuracy"],
            metrics["macro_f1"],
            metrics["weighted_f1"],
        )
    logger.info("Final independent-test artifacts saved to %s", report_dir)


if __name__ == "__main__":
    main()
