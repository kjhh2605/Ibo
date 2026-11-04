import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings

@pytest.fixture
def client():
    settings = Settings(mode='mock', hmac_secret=b'test-secret-not-a-credential-00000', mock_skip_auth=True)
    with TestClient(create_app(settings=settings)) as client:
        yield client
