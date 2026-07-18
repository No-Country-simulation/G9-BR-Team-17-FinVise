import logging
import sys

from app.core.config import settings


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(formatter)
        root.addHandler(handler)
