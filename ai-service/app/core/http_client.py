from threading import Lock

import httpx

_client: httpx.Client | None = None
_client_lock = Lock()


def get_http_client() -> httpx.Client:
    """Returns the process-wide client used by outbound AI integrations."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = httpx.Client()
    return _client


def close_http_client() -> None:
    """Closes pooled connections during application shutdown."""
    global _client
    with _client_lock:
        if _client is not None:
            _client.close()
            _client = None
