from unittest.mock import Mock

import pytest

from app.schemas.transaction import TransactionItem
from app.transaction_classifier.fallback import FallbackTransactionClassifier
from app.transaction_classifier.sklearn_classifier import SklearnTransactionClassifier


def test_fallback_supermarket():
    clf = FallbackTransactionClassifier()
    items = [TransactionItem(description="Compra no Supermercado BH", amount=150.0)]
    preds = clf.predict(items)
    assert preds[0].category == "ALIMENTACAO"
    assert preds[0].subcategory == "SUPERMERCADO"
    assert preds[0].confidence > 0.5


def test_fallback_uber():
    clf = FallbackTransactionClassifier()
    items = [TransactionItem(description="Uber *Trip", amount=25.0)]
    preds = clf.predict(items)
    assert preds[0].category == "TRANSPORTE"


def test_fallback_unknown():
    clf = FallbackTransactionClassifier()
    items = [TransactionItem(description="XYZ123", amount=1.0)]
    preds = clf.predict(items)
    assert preds[0].category == "OUTROS"


@pytest.mark.parametrize(
    ("description", "expected_category"),
    [
        ("Aplicativo de transporte", "TRANSPORTE"),
        ("Conta de energia", "MORADIA"),
        ("Plano de saude", "SAUDE"),
        ("Curso online", "EDUCACAO"),
        ("Loja de roupas", "COMPRAS"),
        ("Viagem e hospedagem", "LAZER"),
        ("Internet residencial", "SERVICOS"),
        ("Combustivel no posto Shell", "TRANSPORTE"),
    ],
)
def test_fallback_finance_dataset_categories(description, expected_category):
    classifier = FallbackTransactionClassifier()
    prediction = classifier.predict([TransactionItem(description=description, amount=100.0)])[0]
    assert prediction.category == expected_category


def test_sklearn_uses_fallback_for_low_confidence_prediction():
    classifier = object.__new__(SklearnTransactionClassifier)
    classifier.pipeline = Mock()
    classifier.pipeline.predict.return_value = ["COMPRAS"]
    classifier.pipeline.predict_proba.return_value = [[0.10, 0.2842, 0.20, 0.15, 0.2658]]
    classifier.confidence_threshold = 0.60
    classifier.fallback_classifier = FallbackTransactionClassifier()

    prediction = classifier.predict(
        [TransactionItem(description="Pagamento de combustivel", amount=300.0)]
    )[0]

    assert prediction.category == "TRANSPORTE"
    assert prediction.subcategory == "COMBUSTIVEL"
    assert prediction.confidence == 0.75


def test_sklearn_keeps_high_confidence_prediction_and_enriches_subcategory():
    classifier = object.__new__(SklearnTransactionClassifier)
    classifier.pipeline = Mock()
    classifier.pipeline.predict.return_value = ["ALIMENTACAO"]
    classifier.pipeline.predict_proba.return_value = [[0.97, 0.01, 0.01, 0.01]]
    classifier.confidence_threshold = 0.60
    classifier.fallback_classifier = FallbackTransactionClassifier()
    classifier._top_features = Mock(return_value=["supermercado"])

    prediction = classifier.predict(
        [TransactionItem(description="Supermercado BH", amount=150.0)]
    )[0]

    assert prediction.category == "ALIMENTACAO"
    assert prediction.subcategory == "SUPERMERCADO"
    assert prediction.confidence == 0.97
    assert prediction.top_features == ["supermercado"]
