import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from app.core.config import settings
from app.profile_classifier.sklearn_classifier import FEATURE_NAMES

logger = logging.getLogger(__name__)

FORBIDDEN_FEATURES = {
    "score_financeiro",
    "confianca_perfil",
    "fatores_risco",
    "fatores_positivos",
    "regra_rotulacao",
    "perfil_financeiro",
    "split",
    "fonte",
    "usuario_id",
    "mes_referencia",
    "renda_mensal",
    "total_despesas",
}


def load_data() -> pd.DataFrame:
    path = settings.data_processed_dir / "profile_train.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Processed dataset not found at {path}. Run prepare_dataset first.")
    return pd.read_parquet(path)


def split_by_user(df: pd.DataFrame, test_size: float = 0.15) -> tuple[pd.DataFrame, pd.DataFrame]:
    users = np.array(df["usuario_id"].astype(str).unique().tolist())
    train_users, val_users = train_test_split(users, test_size=test_size, random_state=42)
    return df[df["usuario_id"].isin(train_users)], df[df["usuario_id"].isin(val_users)]


def train_model(model_cls, X_train, y_train, X_val, y_val, **kwargs):
    model = model_cls(**kwargs)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_val)
    macro_f1 = f1_score(y_val, y_pred, average="macro", zero_division=0)
    return model, macro_f1


def train() -> None:
    df = load_data()

    used_features = [f for f in FEATURE_NAMES if f not in FORBIDDEN_FEATURES]
    missing = set(used_features) - set(df.columns)
    if missing:
        raise ValueError(f"Missing features in dataset: {missing}")

    df = df.dropna(subset=[*used_features, "perfil_financeiro"])

    train_df, val_df = split_by_user(df)
    logger.info("Train samples: %d | Validation samples: %d", len(train_df), len(val_df))

    X_train = train_df[used_features].values
    y_train = train_df["perfil_financeiro"].values
    X_val = val_df[used_features].values
    y_val = val_df["perfil_financeiro"].values

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    candidates = [
        (
            "LogisticRegression",
            LogisticRegression,
            {"class_weight": "balanced", "max_iter": 1000, "random_state": 42, "n_jobs": 5},
            True,
        ),
        (
            "RandomForest",
            RandomForestClassifier,
            {"class_weight": "balanced", "n_estimators": 200, "random_state": 42, "n_jobs": 5},
            False,
        ),
    ]

    best_score = -1.0
    best_model = None
    best_scaler = None
    best_name = ""

    for name, cls, kwargs, use_scaler in candidates:
        if use_scaler:
            model, score = train_model(cls, X_train_scaled, y_train, X_val_scaled, y_val, **kwargs)
        else:
            model, score = train_model(cls, X_train, y_train, X_val, y_val, **kwargs)
        logger.info("%s macro F1: %.4f", name, score)
        if score > best_score:
            best_score = score
            best_model = model
            best_scaler = scaler if use_scaler else None
            best_name = name

    logger.info("Best model: %s (macro F1: %.4f)", best_name, best_score)

    X_eval = X_val_scaled if best_scaler else X_val
    y_pred = best_model.predict(X_eval)
    accuracy = accuracy_score(y_val, y_pred)
    macro_f1 = f1_score(y_val, y_pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(y_val, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_val, y_pred, output_dict=True, zero_division=0)

    metrics = {
        "accuracy": round(accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "by_class": {
            k: {"precision": round(v["precision"], 4), "recall": round(v["recall"], 4), "support": int(v["support"])}
            for k, v in report.items()
            if k not in ("accuracy", "macro avg", "weighted avg")
        },
    }

    output_dir = Path(settings.profile_model_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(best_model, output_dir / "model.joblib")
    if best_scaler is not None:
        joblib.dump(best_scaler, output_dir / "preprocessor.joblib")

    with open(output_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump({"version": "1.0.0", "model": best_name}, f, indent=2)

    with open(output_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    with open(output_dir / "feature_names.json", "w", encoding="utf-8") as f:
        json.dump(used_features, f, indent=2)

    logger.info("Profile classifier saved to %s", output_dir)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    train()


if __name__ == "__main__":
    main()
