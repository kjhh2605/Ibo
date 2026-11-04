import socket
import os
import time
from contextlib import contextmanager
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from .harness import VECTOR, install_scenarios


def pytest_ignore_collect(collection_path, config):
    # Real gates are separate invocations, never reported as skipped passes.
    if collection_path.name in ('test_pe_real.py', 'test_pe_research_compat.py'):
        return os.environ.get('SF_REAL_PE_TEST') != '1'


@pytest.fixture(autouse=True, scope='module')
def no_external_network():
    def denied(*args, **kwargs):
        raise AssertionError('Search tests must not open external sockets')
    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr(socket.socket, 'connect', denied)
        monkeypatch.setattr(socket, 'create_connection', denied)
        yield


@pytest.fixture
def fixtures(tmp_path):
    install_scenarios(tmp_path)
    return tmp_path


@pytest.fixture
def client(fixtures):
    settings = Settings(mode='mock', hmac_secret=b'search-test-secret-not-real-00000', mock_skip_auth=True, fixtures_dir=fixtures)
    with TestClient(create_app(settings=settings)) as client:
        yield client


class Verifier:
    def verify_id_token(self, token):
        return {'sub': 'search-test-user', 'uid': 'search-test-user', 'aud': 'search-test',
                'iss': 'https://securetoken.google.com/search-test', 'iat': time.time() - 10,
                'exp': time.time() + 3600, 'firebase': {'sign_in_provider': 'anonymous'}}

    def verify_app_check(self, token):
        return {'app_id': '1:123:android:abc', 'sub': '1:123:android:abc',
                'iss': 'https://firebaseappcheck.googleapis.com/123',
                'aud': ['projects/123'], 'exp': time.time() + 3600}


@pytest.fixture
def live_client(monkeypatch):
    # Only provider-protocol tests substitute PE. Real gates never use this fixture.
    monkeypatch.setattr('app.pe_text.load_pe_text', lambda root: SimpleNamespace(encode=lambda phrase: VECTOR))

    @contextmanager
    def create(responses, log_text=False):
        requests = []
        def handler(request):
            requests.append(request)
            next_response = responses.pop(0)
            if isinstance(next_response, Exception):
                raise next_response
            return httpx.Response(200, json=next_response)
        settings = Settings(mode='live', hmac_secret=b'search-test-secret-not-real-00000',
                            model_api_key='synthetic-not-real', firebase_project_id='search-test',
                            firebase_app_id='1:123:android:abc', log_text=log_text)
        app = create_app(settings=settings, verifier=Verifier(), transport=httpx.MockTransport(handler))
        with TestClient(app, headers={'Authorization': 'Bearer synthetic', 'X-Firebase-AppCheck': 'synthetic'}) as client:
            yield client, requests
    return create
