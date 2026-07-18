from pathlib import Path

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
