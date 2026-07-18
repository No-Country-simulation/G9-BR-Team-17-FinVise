import re
import unicodedata

KEYWORD_SEPARATORS = re.compile(r"[|,/;\n]+")
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def normalize_text(text: str) -> str:
    """Normalize raw text for matching and model input."""
    if not text:
        return ""
    text = str(text)
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_tokens(text: str) -> list[str]:
    """Extract alphanumeric tokens from normalized text."""
    return TOKEN_PATTERN.findall(normalize_text(text))


def build_keyword_map(categories_path: str) -> dict[str, tuple[str, str]]:
    """Build a keyword-to-(category, subcategory) map from the categories CSV."""
    import csv

    keyword_map: dict[str, tuple[str, str]] = {}
    with open(categories_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            category = row.get("categoria", "").strip().upper()
            subcategory = row.get("subcategoria", "").strip().upper()
            examples = row.get("exemplos_estabelecimentos", "").strip()
            if not category or not subcategory or not examples:
                continue
            for keyword in KEYWORD_SEPARATORS.split(examples):
                keyword = normalize_text(keyword)
                if keyword:
                    keyword_map[keyword] = (category, subcategory)
    return keyword_map
