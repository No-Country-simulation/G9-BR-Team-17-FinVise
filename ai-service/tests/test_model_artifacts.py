import json

import pytest

from app.core.exceptions import ModelNotLoadedError
from app.model_registry.artifacts import load_json_list, validate_model_artifacts
from app.model_registry.registry import ModelRegistry


def _write_artifacts(model_dir, version="1.1.0"):
    model_dir.mkdir(parents=True)
    (model_dir / "model.joblib").write_bytes(b"active-model")
    (model_dir / "metadata.json").write_text(
        json.dumps({"version": version}),
        encoding="utf-8",
    )
    (model_dir / "labels.json").write_text(
        json.dumps(["ALIMENTACAO", "TRANSPORTE"]),
        encoding="utf-8",
    )


def test_validates_required_artifacts_and_active_version(tmp_path):
    model_dir = tmp_path / "transaction-classifier"
    _write_artifacts(model_dir)

    result = validate_model_artifacts(
        "transaction-classifier",
        model_dir,
        ("model.joblib", "metadata.json", "labels.json"),
        "1.1.0",
    )

    assert result.version == "1.1.0"
    assert result.model_dir == model_dir.resolve()
    assert len(result.checksums["model.joblib"]) == 64


def test_rejects_missing_or_mismatched_active_artifacts(tmp_path):
    model_dir = tmp_path / "transaction-classifier"
    _write_artifacts(model_dir, version="1.0.0")
    (model_dir / "labels.json").unlink()

    with pytest.raises(ModelNotLoadedError, match="labels.json"):
        validate_model_artifacts(
            "transaction-classifier",
            model_dir,
            ("model.joblib", "metadata.json", "labels.json"),
            "1.1.0",
        )

    (model_dir / "labels.json").write_text('["ALIMENTACAO"]', encoding="utf-8")
    with pytest.raises(ModelNotLoadedError, match="does not match active version"):
        validate_model_artifacts(
            "transaction-classifier",
            model_dir,
            ("model.joblib", "metadata.json", "labels.json"),
            "1.1.0",
        )


def test_rejects_invalid_json_list(tmp_path):
    labels_path = tmp_path / "labels.json"
    labels_path.write_text("[]", encoding="utf-8")

    with pytest.raises(ModelNotLoadedError, match="non-empty JSON list"):
        load_json_list(labels_path, "labels")


def test_production_rejects_silent_fallback(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.model_registry.registry.settings.transaction_model_path",
        tmp_path / "transaction",
    )
    monkeypatch.setattr(
        "app.model_registry.registry.settings.profile_model_path",
        tmp_path / "profile",
    )
    monkeypatch.setattr(
        "app.model_registry.registry.settings.environment",
        "production",
    )
    monkeypatch.setattr(
        "app.model_registry.registry.settings.require_active_models",
        False,
    )

    with pytest.raises(ModelNotLoadedError, match="transaction-classifier"):
        ModelRegistry()
