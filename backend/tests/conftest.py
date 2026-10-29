import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.session_service import SessionStore


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
