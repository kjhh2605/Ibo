import base64
import io
import json
import socket
import struct
import sys
import time
from types import ModuleType
import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin

from app.config import Settings
from app.main import create_app

HEADERS = {'Authorization': 'Bearer synthetic-id', 'X-Firebase-AppCheck': 'synthetic-check'}


class Verifier:
    def verify_id_token(self, token):
        if token != 'synthetic-id':
            raise ValueError('Invalid token')
        return {'sub': 'private-media-user', 'aud': 'media-test',
                'iss': 'https://securetoken.google.com/media-test',
                'firebase': {'sign_in_provider': 'anonymous'}, 'iat': time.time() - 1,
                'exp': time.time() + 600}

    def verify_app_check(self, token):
        if token != 'synthetic-check':
            raise ValueError('Invalid check')
        return {'sub': '1:123:android:abc', 'iss': 'https://firebaseappcheck.googleapis.com/123',
                'aud': ['projects/123'], 'exp': time.time() + 600}


def settings(**changes):
    return Settings(**{'mode': 'live', 'hmac_secret': b'media-synthetic-secret-32-bytes-000',
                       'model_api_key': 'synthetic-provider-secret', 'firebase_project_id': 'media-test',
                       'firebase_app_id': '1:123:android:abc', **changes})


def image(color=80, *, metadata=None, size=(2, 2), fmt='PNG'):
    stream = io.BytesIO()
    info = PngImagePlugin.PngInfo()
    for key, value in (metadata or {}).items():
        info.add_text(key, value)
    Image.new('RGB', size, (color, 120, 160)).save(
        stream, format=fmt, **({'pnginfo': info} if fmt == 'PNG' else {}))
    return {'mimeType': 'image/png' if fmt == 'PNG' else 'image/jpeg',
            'data': base64.b64encode(stream.getvalue()).decode(), 'width': size[0], 'height': size[1]}


def audio(samples=160, *, rate=16000, channels=1, bits=16, extra=b''):
    pcm = b'\x01\x00' * samples
    body = b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, channels, rate,
                                    rate * channels * bits // 8, channels * bits // 8, bits)
    body += extra + b'data' + struct.pack('<I', len(pcm)) + pcm
    raw = b'RIFF' + struct.pack('<I', len(body)) + body
    return {'audio': {'mimeType': 'audio/wav', 'data': base64.b64encode(raw).decode()}}


def fitting(companions=0):
    def piece(index):
        return {'pieceRef': f'piece_{index}', 'image': image(index + 20),
                'label': 'blue coat', 'category': 'coat', 'origin': 'shop' if index == 0 else 'wardrobe'}
    return {'selfPhoto': {'image': image(10), 'headMasked': True}, 'target': piece(0),
            'companions': [piece(i + 1) for i in range(companions)]}


def text_output(body):
    return {'status': 'completed', 'output': [{'type': 'message', 'role': 'assistant',
            'content': [{'type': 'output_text', 'text': json.dumps(body)}]}]}


def image_output(data=None):
    return {'status': 'completed', 'output': [{'type': 'image_generation_call',
            'status': 'completed', 'result': image()['data'] if data is None else data}]}


def osrm_output():
    maneuver = {'type': 'depart', 'location': [13.1, 52.1], 'bearing_before': 0, 'bearing_after': 90}
    return {'code': 'Ok', 'routes': [{'geometry': {'type': 'LineString', 'coordinates': [[13.1, 52.1], [13.2, 52.2]]},
            'distance': 110, 'duration': 80, 'legs': [{'steps': [{'distance': 110, 'duration': 80,
            'name': '', 'maneuver': maneuver}]}]}], 'waypoints': [
            {'location': [13.1, 52.1], 'distance': 3}, {'location': [13.2, 52.2], 'distance': 7}]}


ROUTE = {'origin': {'lng': 13.101, 'lat': 52.101}, 'destination': {'lng': 13.201, 'lat': 52.201}}


@pytest.fixture(autouse=True)
def no_external_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError('Media suite must not access external networks')
    monkeypatch.setattr(socket.socket, 'connect', blocked)
    monkeypatch.setattr(socket, 'create_connection', blocked)
    monkeypatch.delenv('FIREBASE_AUTH_EMULATOR_HOST', raising=False)
    # Media-only acceptance never claims PE model readiness or downloads weights.
    pe = ModuleType('app.pe_text')
    pe.load_pe_text = lambda path: None
    monkeypatch.setitem(sys.modules, 'app.pe_text', pe)


@pytest.fixture
def provider():
    clients = []
    def make(body=None, status=200, headers=None, exception=None, log_text=False):
        calls = []
        def handler(request):
            calls.append(request)
            if exception:
                raise exception
            return httpx.Response(status, json=body, headers=headers)
        app = create_app(settings=settings(log_text=log_text), verifier=Verifier(),
                         transport=httpx.MockTransport(handler))
        client = TestClient(app, headers=HEADERS)
        client.__enter__()
        clients.append(client)
        return client, calls
    yield make
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def replay(tmp_path):
    def put(operation, request, response, *, scenario='normal', match=(), ignore=(), status=200, headers=None):
        directory = tmp_path / scenario
        directory.mkdir(exist_ok=True)
        (directory / f'{operation}.01.request.json').write_text(json.dumps(
            {'expected': request, 'match': list(match), 'ignore': list(ignore)}))
        (directory / f'{operation}.01.response.json').write_text(json.dumps(
            {'status': status, 'body': response, **({'headers': headers} if headers else {})}))
    app = create_app(settings=settings(mode='mock', mock_skip_auth=True, fixtures_dir=tmp_path),
                     transport=httpx.MockTransport(lambda _: pytest.fail('Mock must never call transport')))
    with TestClient(app) as client:
        yield client, put
