
from app.model_registry.registry import ModelRegistry


def test_registry_uses_fallback_when_no_models(monkeypatch, tmp_path):
    monkeypatch.setattr("app.model_registry.registry.settings.transaction_model_path", tmp_path / "tx")
    monkeypatch.setattr("app.model_registry.registry.settings.profile_model_path", tmp_path / "pf")
    registry = ModelRegistry()
    status = registry.status()
    assert status["transaction_classifier"]["status"] == "FALLBACK"
    assert status["profile_classifier"]["status"] == "FALLBACK"
    assert status["transaction_classifier"]["version"] == "FALLBACK"
    assert status["profile_classifier"]["version"] == "FALLBACK"
    assert status["status"] == "DEGRADED"
    assert status["transaction_classifier"]["active"] is False
    assert status["transaction_classifier"]["artifact_status"] == "MISSING"
    assert status["transaction_classifier"]["registered_at"]


def test_registry_reports_active_versions_and_checksums(monkeypatch, tmp_path):
    transaction_dir = tmp_path / "transaction"
    profile_dir = tmp_path / "profile"
    transaction_dir.mkdir()
    profile_dir.mkdir()
    (transaction_dir / "model.joblib").write_bytes(b"transaction")
    (profile_dir / "model.joblib").write_bytes(b"profile")

    class ActiveClassifier:
        name = "ActiveClassifier"
        version = "2.0.0"
        status = "LOADED"
        artifact_checksums = {
            "model.joblib": "model-sha",
            "metadata.json": "metadata-sha",
        }

    monkeypatch.setattr(
        "app.model_registry.registry.settings.transaction_model_path",
        transaction_dir,
    )
    monkeypatch.setattr(
        "app.model_registry.registry.settings.profile_model_path",
        profile_dir,
    )
    monkeypatch.setattr(
        "app.model_registry.registry.SklearnTransactionClassifier",
        lambda _path: ActiveClassifier(),
    )
    monkeypatch.setattr(
        "app.model_registry.registry.SklearnProfileClassifier",
        lambda _path: ActiveClassifier(),
    )

    status = ModelRegistry().status()

    assert status["status"] == "READY"
    assert status["transaction_classifier"]["version"] == "2.0.0"
    assert status["transaction_classifier"]["artifact_sha256"] == "model-sha"
    assert status["profile_classifier"]["active"] is True
