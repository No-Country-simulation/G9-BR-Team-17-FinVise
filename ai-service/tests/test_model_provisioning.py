import json
from pathlib import Path

import pytest

from app.profile_classifier.sklearn_classifier import SklearnProfileClassifier
from app.transaction_classifier.sklearn_classifier import SklearnTransactionClassifier
from training.provision_models import provision_models


def test_provisions_and_loads_active_models_from_versioned_samples(tmp_path):
    source_dir = Path(__file__).parents[1] / "data" / "samples"
    output_dir = tmp_path / "models"

    manifest = provision_models(source_dir, output_dir)

    transaction = SklearnTransactionClassifier(output_dir / "transaction-classifier")
    profile = SklearnProfileClassifier(output_dir / "profile-classifier")
    saved_manifest = json.loads(
        (output_dir / "provisioning-manifest.json").read_text(encoding="utf-8")
    )

    assert transaction.status == "LOADED"
    assert transaction.version == "1.1.0-bootstrap.1"
    assert profile.status == "LOADED"
    assert profile.version == "1.0.0-bootstrap.1"
    assert manifest["source"] == "versioned-bootstrap-samples"
    assert saved_manifest["models"]["transaction_classifier"]["status"] == "LOADED"
    assert saved_manifest["models"]["profile_classifier"]["status"] == "LOADED"
    assert (output_dir / ".gitkeep").is_file()


def test_invalid_sources_do_not_replace_existing_models(tmp_path):
    output_dir = tmp_path / "models"
    output_dir.mkdir()
    sentinel = output_dir / "existing-model"
    sentinel.write_text("preserve", encoding="utf-8")

    with pytest.raises(FileNotFoundError, match="Versioned model source"):
        provision_models(tmp_path / "missing-sources", output_dir)

    assert sentinel.read_text(encoding="utf-8") == "preserve"
