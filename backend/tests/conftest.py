import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.session_service import SessionStore
from app.ai import ai_service


@pytest.fixture
def clock():
    return [1000.0]


@pytest.fixture
def store(clock):
    return SessionStore(clock=lambda: clock[0])


@pytest.fixture
def client(store):
    with TestClient(create_app(store)) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def isolate_ai_for_milestone1_tests(request, monkeypatch):
    """
    Milestone 1 tests in test_backend.py specifically verify 503 unavailable responses
    and health status 'unavailable' when providers are unconfigured.
    """
    if "test_backend.py" in str(request.node.fspath):
        monkeypatch.setattr(ai_service.sarvam, "api_key", "")
        monkeypatch.setattr(ai_service.groq, "api_key", "")
