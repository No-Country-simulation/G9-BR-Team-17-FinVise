class FinanceAIException(Exception):
    """Base exception for the AI service."""


class ModelNotLoadedError(FinanceAIException):
    """Raised when a requested model could not be loaded."""


class InvalidInputError(FinanceAIException):
    """Raised when request input validation fails at service level."""
