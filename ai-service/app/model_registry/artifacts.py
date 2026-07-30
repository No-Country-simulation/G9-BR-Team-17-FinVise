import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.exceptions import ModelNotLoadedError


@dataclass(frozen=True)
class ModelArtifactValidation:
    model_name: str
    model_dir: Path
    version: str
    metadata: dict[str, Any]
    checksums: dict[str, str]


def validate_model_artifacts(
    model_name: str,
    model_dir: Path,
    required_files: tuple[str, ...],
    expected_version: str = "",
) -> ModelArtifactValidation:
    normalized_dir = Path(model_dir).resolve()
    missing_files = [
        filename
        for filename in required_files
        if not (normalized_dir / filename).is_file()
        or (normalized_dir / filename).stat().st_size == 0
    ]
    if missing_files:
        raise ModelNotLoadedError(
            f"{model_name} artifacts missing or empty: {', '.join(missing_files)}"
        )

    metadata_path = normalized_dir / "metadata.json"
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelNotLoadedError(
            f"{model_name} metadata is invalid: {metadata_path}"
        ) from exc
    if not isinstance(metadata, dict):
        raise ModelNotLoadedError(f"{model_name} metadata must be a JSON object")

    version = str(metadata.get("version", "")).strip()
    if not version:
        raise ModelNotLoadedError(f"{model_name} metadata has no version")
    if expected_version and version != expected_version.strip():
        raise ModelNotLoadedError(
            f"{model_name} version {version} does not match active version "
            f"{expected_version.strip()}"
        )

    checksums = {
        filename: _sha256(normalized_dir / filename)
        for filename in required_files
    }
    return ModelArtifactValidation(
        model_name=model_name,
        model_dir=normalized_dir,
        version=version,
        metadata=metadata,
        checksums=checksums,
    )


def load_json_list(path: Path, artifact_name: str) -> list[str]:
    try:
        values = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelNotLoadedError(f"{artifact_name} is invalid: {path}") from exc
    if not isinstance(values, list) or not values:
        raise ModelNotLoadedError(f"{artifact_name} must be a non-empty JSON list")
    normalized = [str(value).strip() for value in values]
    if any(not value for value in normalized):
        raise ModelNotLoadedError(f"{artifact_name} contains empty values")
    return normalized


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as artifact:
        for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
