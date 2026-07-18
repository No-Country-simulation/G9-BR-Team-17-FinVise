import logging
from pathlib import Path

import pandas as pd

from app.core.config import settings

logger = logging.getLogger(__name__)

CHUNK_SIZE = 10_000


def ensure_dirs() -> None:
    settings.data_processed_dir.mkdir(parents=True, exist_ok=True)
    settings.data_samples_dir.mkdir(parents=True, exist_ok=True)


def prepare_transactions() -> Path:
    raw_path = settings.dataset_raw_dir / "transacoes.csv"
    output_path = settings.data_processed_dir / "transaction_train.parquet"

    if not raw_path.exists():
        logger.warning("Raw transactions file not found at %s", raw_path)
        return output_path

    chunks: list[pd.DataFrame] = []
    for chunk in pd.read_csv(raw_path, chunksize=CHUNK_SIZE):
        chunk = chunk[chunk["tipo"] == "DESPESA"]
        chunk = chunk[chunk["split"].isin(["TRAIN", "VALIDATION"])]
        chunks.append(chunk)

    df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
    df.to_parquet(output_path, index=False)
    logger.info("Saved %d transaction rows to %s", len(df), output_path)
    return output_path


def prepare_profiles() -> Path:
    raw_path = settings.dataset_raw_dir / "perfis_mensais.csv"
    output_path = settings.data_processed_dir / "profile_train.parquet"

    if not raw_path.exists():
        logger.warning("Raw profiles file not found at %s", raw_path)
        return output_path

    chunks: list[pd.DataFrame] = []
    for chunk in pd.read_csv(raw_path, chunksize=CHUNK_SIZE):
        chunk = chunk[chunk["split"].isin(["TRAIN", "VALIDATION"])]
        chunks.append(chunk)

    df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
    df.to_parquet(output_path, index=False)
    logger.info("Saved %d profile rows to %s", len(df), output_path)
    return output_path


def create_samples() -> None:
    tx_raw = settings.dataset_raw_dir / "transacoes.csv"
    pr_raw = settings.dataset_raw_dir / "perfis_mensais.csv"

    if tx_raw.exists():
        sample_tx = pd.read_csv(tx_raw, nrows=1000)
        sample_tx.to_csv(settings.data_samples_dir / "transacoes_sample.csv", index=False)
        logger.info("Saved transaction sample with %d rows", len(sample_tx))

    if pr_raw.exists():
        sample_pr = pd.read_csv(pr_raw, nrows=1000)
        sample_pr.to_csv(settings.data_samples_dir / "perfis_mensais_sample.csv", index=False)
        logger.info("Saved profile sample with %d rows", len(sample_pr))


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ensure_dirs()
    prepare_transactions()
    prepare_profiles()
    create_samples()


if __name__ == "__main__":
    main()
