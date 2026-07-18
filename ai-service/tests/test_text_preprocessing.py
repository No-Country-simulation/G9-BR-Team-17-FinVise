from app.preprocessing.text import extract_tokens, normalize_text


def test_normalize_text_lowercase():
    assert normalize_text("SUPERMERCADO") == "supermercado"


def test_normalize_text_removes_accents():
    assert normalize_text("Açúcar") == "acucar"


def test_normalize_text_removes_punctuation():
    assert normalize_text("Pgto #123!") == "pgto 123"


def test_extract_tokens():
    assert extract_tokens("Uber 99 App") == ["uber", "99", "app"]
