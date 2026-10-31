import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.email import reset_daily_usage

@pytest.fixture(autouse=True)
def clean_state():
    """Resets in-memory state before each test."""
    reset_daily_usage()
    yield
    reset_daily_usage()

@pytest.fixture
def client():
    """Provides a TestClient instance for API tests."""
    with TestClient(app) as test_client:
        yield test_client
