import csv
from pathlib import Path
from app.core.config import settings
from app.preprocessing.text import extract_tokens, normalize_text
from app.schemas.transaction import TransactionItem, TransactionPrediction
from app.transaction_classifier.base import BaseTransactionClassifier


class FallbackTransactionClassifier(BaseTransactionClassifier):
    name: str = "FallbackTransactionClassifier"
    version: str = "FALLBACK"
    status: str = "FALLBACK"

    def __init__(self, categories_path: str | Path | None = None):
        self._keyword_map: dict[str, tuple[str, str]] = {}
        self._load(categories_path or self._default_categories_path())

    def _default_categories_path(self) -> Path:
        return settings.dataset_raw_dir / "categorias.csv"

    def _load(self, categories_path: str | Path) -> None:
        path = Path(categories_path)
        if not path.exists():
            self._keyword_map = self._builtin_keyword_map()
        else:
            self._keyword_map = self._load_from_csv(path)
            self._keyword_map.update(self._builtin_keyword_map())

    def _load_from_csv(self, path: Path) -> dict[str, tuple[str, str]]:
        keyword_map: dict[str, tuple[str, str]] = {}
        with open(path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                category = row.get("categoria", "").strip().upper()
                subcategory = row.get("subcategoria", "").strip().upper()
                examples = row.get("exemplos_estabelecimentos", "").strip()
                if not category or not subcategory or not examples:
                    continue
                for keyword in [k.strip() for k in examples.split("|")]:
                    keyword = normalize_text(keyword)
                    if keyword:
                        keyword_map[keyword] = (category, subcategory)
        return keyword_map

    def _builtin_keyword_map(self) -> dict[str, tuple[str, str]]:
        return {
            "supermercado": ("ALIMENTACAO", "SUPERMERCADO"),
            "mercado": ("ALIMENTACAO", "SUPERMERCADO"),
            "restaurante": ("ALIMENTACAO", "RESTAURANTE"),
            "padaria": ("ALIMENTACAO", "PADARIA"),
            "delivery": ("ALIMENTACAO", "DELIVERY"),
            "ifood": ("ALIMENTACAO", "RESTAURANTE"),
            "mcdonalds": ("ALIMENTACAO", "RESTAURANTE"),
            "starbucks": ("ALIMENTACAO", "CAFETERIA"),
            "uber": ("TRANSPORTE", "APLICATIVO"),
            "transporte": ("TRANSPORTE", "APLICATIVO"),
            "posto": ("TRANSPORTE", "COMBUSTIVEL"),
            "combustivel": ("TRANSPORTE", "COMBUSTIVEL"),
            "estacionamento": ("TRANSPORTE", "ESTACIONAMENTO"),
            "veiculo": ("TRANSPORTE", "VEICULO"),
            "passagem": ("TRANSPORTE", "PASSAGEM"),
            "drogaria": ("SAUDE", "FARMACIA"),
            "farmacia": ("SAUDE", "FARMACIA"),
            "saude": ("SAUDE", "PLANO_SAUDE"),
            "academia": ("SAUDE", "ACADEMIA"),
            "veterinario": ("SAUDE", "VETERINARIO"),
            "aluguel": ("MORADIA", "ALUGUEL"),
            "condominio": ("MORADIA", "CONDOMINIO"),
            "energia": ("MORADIA", "ENERGIA"),
            "agua": ("MORADIA", "AGUA"),
            "enel": ("MORADIA", "ENERGIA"),
            "internet": ("SERVICOS", "INTERNET"),
            "celular": ("SERVICOS", "TELEFONIA"),
            "imposto": ("SERVICOS", "IMPOSTOS"),
            "seguro": ("SERVICOS", "SEGUROS"),
            "netflix": ("LAZER", "STREAMING"),
            "spotify": ("LAZER", "STREAMING"),
            "streaming": ("LAZER", "STREAMING"),
            "cinema": ("LAZER", "CINEMA"),
            "viagem": ("LAZER", "VIAGEM"),
            "hospedagem": ("LAZER", "VIAGEM"),
            "curso": ("EDUCACAO", "CURSOS"),
            "livraria": ("EDUCACAO", "LIVROS"),
            "roupas": ("COMPRAS", "VESTUARIO"),
            "eletronicos": ("COMPRAS", "ELETRONICOS"),
            "pet": ("COMPRAS", "PET_SHOP"),
            "fatura": ("DIVIDAS", "CARTAO"),
            "divida": ("DIVIDAS", "DIVIDAS"),
            "investimento": ("INVESTIMENTOS", "INVESTIMENTOS"),
            "transferencia": ("TRANSFERENCIAS", "TRANSFERENCIA"),
            "salario": ("RENDA", "SALARIO"),
        }

    def predict(self, items: list[TransactionItem]) -> list[TransactionPrediction]:
        predictions: list[TransactionPrediction] = []
        for item in items:
            description = normalize_text(item.description)
            tokens = extract_tokens(description)

            matched: tuple[str, str] | None = None
            matched_keyword = ""
            for token in tokens:
                if token in self._keyword_map:
                    matched = self._keyword_map[token]
                    matched_keyword = token
                    break

            if matched is None:
                for keyword in self._keyword_map:
                    if keyword in description:
                        matched = self._keyword_map[keyword]
                        matched_keyword = keyword
                        break

            if matched is None:
                matched = ("OUTROS", "OUTROS")
                matched_keyword = "default"

            category, subcategory = matched
            confidence = 0.75 if matched_keyword != "default" else 0.4
            top_features = [matched_keyword] if matched_keyword else []

            predictions.append(
                TransactionPrediction(
                    category=category,
                    subcategory=subcategory,
                    confidence=round(confidence, 2),
                    top_features=top_features,
                )
            )
        return predictions
