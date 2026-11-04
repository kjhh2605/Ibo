import asyncio
import base64
import io
import json
import socket
import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from firebase_admin import _token_gen
from PIL import Image

from app.auth import FirebaseVerifier
from app.config import Settings, install_core
from app.schemas import DescribeRequest, SearchTurnRequest, SearchSegmentRequest, RouteRequest
from app.token import QueryTokens


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError('Core acceptance must not use the network')
    monkeypatch.setattr(socket.socket, 'connect', blocked)
    monkeypatch.setattr(socket, 'create_connection', blocked)
    monkeypatch.delenv('FIREBASE_AUTH_EMULATOR_HOST', raising=False)


@pytest.fixture
def settings():
    return Settings(mode='mock', hmac_secret=b'test-secret-not-for-runtime-32-bytes', mock_skip_auth=True)


@pytest.fixture
def image():
    stream = io.BytesIO()
    Image.new('RGB', (2, 2), (80, 120, 160)).save(stream, format='PNG')
    return {'mimeType': 'image/png', 'data': base64.b64encode(stream.getvalue()).decode(), 'width': 2, 'height': 2}


@pytest.fixture
def context():
    return {'now': '2026-11-04T10:00:00-05:00', 'timeZone': 'America/New_York'}


@pytest.fixture
def tokens(settings):
    return QueryTokens(settings.hmac_secret, clock=lambda: 1793800000)


@pytest.fixture
def sub():
    return 'a' * 64


@pytest.fixture
def firebase(monkeypatch):
    settings = Settings(mode='mock', hmac_secret=b'x' * 32, firebase_project_id='core-test', firebase_app_id='1:123:android:abcdef')
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    certs = json.dumps({'test-key': public}).encode()
    monkeypatch.setattr(_token_gen.CertificateFetchRequest, '__call__', lambda *a, **kw: SimpleNamespace(status=200, data=certs))
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update(kid='test-key', use='sig', alg='RS256')
    monkeypatch.setattr(jwt.PyJWKClient, 'fetch_data', lambda *a, **kw: {'keys': [jwk]})
    verifier = FirebaseVerifier(settings)
    def mint(kind='id', changes=None, wrong_key=False, algorithm='RS256'):
        now = int(time.time())
        claims = ({'aud': 'core-test', 'iss': 'https://securetoken.google.com/core-test', 'sub': 'private-uid',
                   'firebase': {'sign_in_provider': 'anonymous'}, 'iat': now - 10, 'exp': now + 600}
                  if kind == 'id' else
                  {'aud': ['projects/123', 'projects/core-test'], 'iss': 'https://firebaseappcheck.googleapis.com/123',
                   'sub': settings.firebase_app_id, 'iat': now - 10, 'exp': now + 600})
        claims.update(changes or {})
        signing_key = ('different-symmetric-secret-at-least-32' if algorithm == 'HS256' else other_key if wrong_key else key)
        return jwt.encode(claims, signing_key, algorithm=algorithm, headers={'kid': 'test-key', 'typ': 'JWT'})
    yield settings, verifier, mint
    verifier.close()


def make_app(settings, verifier=None):
    app = FastAPI()
    install_core(app, settings, verifier=verifier)
    @app.post('/v1/describe/piece')
    async def describe(body: DescribeRequest, request: Request):
        return {'label': 'coat', 'category': 'outerwear', 'subject': request.state.principal.sub}
    @app.post('/v1/search/turn')
    async def turn(body: SearchTurnRequest, request: Request):
        state = app.state.tokens.prepare_turn(body, request.state.principal.sub, scenario=request.state.fixture_scenario)
        with app.state.tokens.attempt(state, 'spark') as consumed:
            return app.state.tokens.finish_turn(consumed, {'not_found': {'reason': 'No matching photos.'}})
    @app.post('/v1/search/segment')
    async def segment(body: SearchSegmentRequest, request: Request):
        app.state.tokens.prepare_segment(body, request.state.principal.sub, scenario=request.state.fixture_scenario)
        return {}
    @app.post('/v1/route')
    async def route(body: RouteRequest):
        return {'ok': True}
    return app


@pytest.fixture
def client(settings):
    app = make_app(settings)
    with TestClient(app) as client:
        yield client
    asyncio.run(app.state.meta.aclose())
