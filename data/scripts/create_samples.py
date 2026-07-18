#!/usr/bin/env python3
"""
Script reprodutível para gerar amostras pequenas do dataset sintético.

Uso:
    python data/scripts/create_samples.py

As amostras são salvas em data/samples/ e podem ser versionadas.
Os arquivos grandes em data/raw/ permanecem ignorados pelo Git.
"""
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw" / "finance_ai_dataset"
SAMPLES_DIR = PROJECT_ROOT / "data" / "samples"

SAMPLE_SIZE = 1_000
RANDOM_STATE = 42

FILES = {
    "transacoes_sample.csv": {
        "source": RAW_DIR / "transacoes.csv",
        "nrows": SAMPLE_SIZE,
    },
    "perfis_mensais_sample.csv": {
        "source": RAW_DIR / "perfis_mensais.csv",
        "nrows": SAMPLE_SIZE,
    },
}


def create_sample(output_name: str, source: Path, nrows: int) -> None:
    if not source.exists():
        print(f"[skip] Source not found: {source}")
        return

    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    output_path = SAMPLES_DIR / output_name

    print(f"Creating sample {output_path} from {source} ({nrows} rows)...")
    df = pd.read_csv(source, nrows=nrows)
    df.to_csv(output_path, index=False)
    print(f"[ok] {output_path} ({len(df)} rows)")


def main() -> None:
    for output_name, config in FILES.items():
        create_sample(output_name, config["source"], config["nrows"])


if __name__ == "__main__":
    main()
