from app.profile_classifier.sklearn_classifier import FEATURE_NAMES

FORBIDDEN_FEATURES = {
    "score_financeiro",
    "confianca_perfil",
    "fatores_risco",
    "fatores_positivos",
    "regra_rotulacao",
}


def test_profile_features_do_not_include_leakage():
    for forbidden in FORBIDDEN_FEATURES:
        assert forbidden not in FEATURE_NAMES, f"{forbidden} must not be used as a feature"
