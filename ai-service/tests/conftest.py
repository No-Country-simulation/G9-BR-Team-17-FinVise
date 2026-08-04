import os

import pytest
from fastapi.testclient import TestClient

TEST_SERVICE_TOKEN = "test-ai-service-token-with-at-least-32-characters"
TEST_USER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

os.environ.setdefault("AI_SERVICE_TOKEN", TEST_SERVICE_TOKEN)

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(
        app,
        headers={
            "Authorization": f"Bearer {TEST_SERVICE_TOKEN}",
            "X-FinVise-User-Id": TEST_USER_ID,
        },
    )
