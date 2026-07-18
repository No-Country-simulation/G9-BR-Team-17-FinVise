import numpy as np
import pytest

from training.evaluate_models import (
    _assert_independent_users,
    _evaluate_predictions,
)


def test_independent_users_evidence_has_zero_overlap():
    evidence = _assert_independent_users(
        {
            "TRAIN": {"user-1", "user-2"},
            "VALIDATION": {"user-3"},
            "TEST": {"user-4"},
        },
        "example",
    )

    assert evidence["passed"] is True
    assert evidence["overlap_users"] == {
        "TRAIN_vs_VALIDATION": 0,
        "TRAIN_vs_TEST": 0,
        "VALIDATION_vs_TEST": 0,
    }


def test_independent_users_rejects_leakage():
    with pytest.raises(ValueError, match="user leakage"):
        _assert_independent_users(
            {
                "TRAIN": {"shared-user"},
                "VALIDATION": {"validation-user"},
                "TEST": {"shared-user"},
            },
            "example",
        )


def test_evaluation_metrics_include_errors_classes_and_confidence_intervals():
    metrics = _evaluate_predictions(
        np.array(["A", "A", "B", "B"]),
        np.array(["A", "B", "B", "B"]),
        ["A", "B"],
    )

    assert metrics["samples"] == 4
    assert metrics["correct_predictions"] == 3
    assert metrics["incorrect_predictions"] == 1
    assert metrics["accuracy"] == 0.75
    assert set(metrics["per_class"]) == {"A", "B"}
    assert set(metrics["confidence_intervals_95"]) == {
        "accuracy",
        "macro_f1",
        "weighted_f1",
    }
