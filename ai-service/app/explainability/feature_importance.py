from typing import Any


def extract_feature_importance(model: Any, feature_names: list[str]) -> dict[str, float]:
    """Extract per-feature importance when available."""
    importances: dict[str, float] = {}

    if hasattr(model, "feature_importances_"):
        values = model.feature_importances_
    elif hasattr(model, "coef_"):
        values = model.coef_
        if values.ndim > 1:
            values = values.mean(axis=0)
    else:
        return {}

    names = feature_names if feature_names else [f"feature_{i}" for i in range(len(values))]
    for name, value in zip(names, values):
        importances[name] = round(float(value), 4)
    return importances
