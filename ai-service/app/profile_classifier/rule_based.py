from app.profile_classifier.fallback import FallbackProfileClassifier


class RuleBasedProfileClassifier(FallbackProfileClassifier):
    """Deterministic and explainable financial profile model."""

    name: str = "RuleBasedProfileClassifier"
    version: str = "RULES-1.0.0"
    status: str = "LOADED"
