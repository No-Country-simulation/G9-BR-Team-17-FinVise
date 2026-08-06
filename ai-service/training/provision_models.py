from __future__ import annotations

import argparse
import hashlib
import json
import logging
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import settings
from app.profile_classifier.sklearn_classifier import SklearnProfileClassifier
from app.transaction_classifier.sklearn_classifier import SklearnTransactionClassifier
from training.prepare_dataset import (
    ensure_dirs,
    prepare_profiles,
    prepare_transactions,
)
from training.train_profile_classifier import MODEL_VERSION as PROFILE_MODEL_VERSION
from training.train_profile_classifier import train as train_profile_classifier
from training.train_transaction_classifier import (
    MODEL_VERSION as TRANSACTION_MODEL_VERSION,
)
from training.train_transaction_classifier import train as train_transaction_classifier

logger = logging.getLogger(__name__)

SOURCE_FILES = {
    "transacoes_sample.csv": "transacoes.csv",
    "perfis_mensais_sample.csv": "perfis_mensais.csv",
}
BOOTSTRAP_TRANSACTION_MODEL_VERSION = f"{TRANSACTION_MODEL_VERSION}-bootstrap.1"
BOOTSTRAP_PROFILE_MODEL_VERSION = f"{PROFILE_MODEL_VERSION}-bootstrap.1"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _copy_training_sources(source_dir: Path, raw_dir: Path) -> dict[str, str]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    checksums: dict[str, str] = {}
    for source_name, raw_name in SOURCE_FILES.items():
        source_path = source_dir / source_name
        if not source_path.is_file() or source_path.stat().st_size == 0:
            raise FileNotFoundError(f"Versioned model source is missing or empty: {source_path}")
        shutil.copy2(source_path, raw_dir / raw_name)
        checksums[source_name] = _sha256(source_path)
    return checksums


def _artifact_checksums(model_dir: Path) -> dict[str, str]:
    return {
        artifact.name: _sha256(artifact)
        for artifact in sorted(model_dir.iterdir())
        if artifact.is_file()
    }


def _mark_bootstrap_version(model_dir: Path, version: str) -> None:
    metadata_path = model_dir / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["version"] = version
    metadata["provisioning_source"] = "versioned-bootstrap-samples"
    metadata_path.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _validate_staged_models(models_dir: Path) -> dict[str, dict[str, object]]:
    transaction = SklearnTransactionClassifier(models_dir / "transaction-classifier")
    profile = SklearnProfileClassifier(models_dir / "profile-classifier")
    return {
        "transaction_classifier": {
            "version": transaction.version,
            "status": transaction.status,
            "artifacts": _artifact_checksums(models_dir / "transaction-classifier"),
        },
        "profile_classifier": {
            "version": profile.version,
            "status": profile.status,
            "artifacts": _artifact_checksums(models_dir / "profile-classifier"),
        },
    }


def _activate_staged_models(staged_models: Path, output_dir: Path) -> None:
    backup_dir = output_dir.with_name(f".{output_dir.name}.previous")
    if backup_dir.exists():
        if output_dir.exists():
            shutil.rmtree(backup_dir)
        else:
            backup_dir.replace(output_dir)

    had_previous = output_dir.exists()
    if had_previous:
        output_dir.replace(backup_dir)
    try:
        staged_models.replace(output_dir)
    except Exception:
        if had_previous and backup_dir.exists() and not output_dir.exists():
            backup_dir.replace(output_dir)
        raise
    if backup_dir.exists():
        shutil.rmtree(backup_dir)


def provision_models(source_dir: Path, output_dir: Path) -> dict[str, object]:
    source_dir = source_dir.resolve()
    output_dir = output_dir.resolve()
    if output_dir == Path(output_dir.anchor):
        raise ValueError("Refusing to provision models into a filesystem root")

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    original_settings = {
        "dataset_raw_dir": settings.dataset_raw_dir,
        "data_processed_dir": settings.data_processed_dir,
        "transaction_model_path": settings.transaction_model_path,
        "profile_model_path": settings.profile_model_path,
        "transaction_model_version": settings.transaction_model_version,
        "profile_model_version": settings.profile_model_version,
    }

    with tempfile.TemporaryDirectory(
        prefix=".model-provision-", dir=output_dir.parent
    ) as temporary_dir:
        workspace = Path(temporary_dir)
        raw_dir = workspace / "raw"
        processed_dir = workspace / "processed"
        staged_models = workspace / "models"
        source_checksums = _copy_training_sources(source_dir, raw_dir)

        try:
            settings.dataset_raw_dir = raw_dir
            settings.data_processed_dir = processed_dir
            settings.transaction_model_path = staged_models / "transaction-classifier"
            settings.profile_model_path = staged_models / "profile-classifier"
            settings.transaction_model_version = BOOTSTRAP_TRANSACTION_MODEL_VERSION
            settings.profile_model_version = BOOTSTRAP_PROFILE_MODEL_VERSION

            ensure_dirs()
            prepare_transactions()
            prepare_profiles()
            train_transaction_classifier()
            train_profile_classifier()
            _mark_bootstrap_version(
                staged_models / "transaction-classifier",
                BOOTSTRAP_TRANSACTION_MODEL_VERSION,
            )
            _mark_bootstrap_version(
                staged_models / "profile-classifier",
                BOOTSTRAP_PROFILE_MODEL_VERSION,
            )
            models = _validate_staged_models(staged_models)

            manifest: dict[str, object] = {
                "schema_version": 1,
                "provisioned_at": datetime.now(UTC).isoformat(),
                "source": "versioned-bootstrap-samples",
                "source_sha256": source_checksums,
                "models": models,
            }
            (staged_models / ".gitkeep").touch()
            (staged_models / "provisioning-manifest.json").write_text(
                json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            _activate_staged_models(staged_models, output_dir)
            logger.info("Active model artifacts provisioned at %s", output_dir)
            return manifest
        finally:
            for name, value in original_settings.items():
                setattr(settings, name, value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train, validate and atomically provision FinVise model artifacts."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path("data/samples"),
        help="Directory containing the versioned bootstrap CSV samples.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("models"),
        help="Destination for the active transaction and profile models.",
    )
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    args = parse_args()
    provision_models(args.source_dir, args.output_dir)


if __name__ == "__main__":
    main()
