import json
import base64
import io
import os
import wave
from PIL import Image
import socket
import subprocess
import sys
from pathlib import Path

from pydantic import ValidationError
import pytest
from app.schemas import ExtractSummary, FindPhotosCall, ListVisitsArguments, QueryContext, SearchTurnRequest, TryOnRequest

buffer = io.BytesIO()
Image.new('RGB', (1, 1)).save(buffer, format='PNG')
PNG = base64.b64encode(buffer.getvalue()).decode()
buffer = io.BytesIO()
with wave.open(buffer, 'wb') as wav:
    wav.setparams((1, 2, 16000, 1, 'NONE', 'not compressed'))
    wav.writeframes(b'\x00\x00')
WAV = base64.b64encode(buffer.getvalue()).decode()
HEADERS = {'Authorization': 'Bearer test', 'X-Firebase-AppCheck': 'test'}

REQUESTS = {
    '/v1/search/turn': {'query': 'jacket', 'context': {'now': '2026-11-04T14:00:00+09:00', 'timeZone': 'Asia/Seoul'}},
    '/v1/search/segment': {'queryToken': 'token', 'concept': 'jacket', 'photos': [{'photoRef': 'p', 'image': {'mimeType': 'image/png', 'data': PNG, 'width': 1, 'height': 1}}]},
    '/v1/transcribe': {'audio': {'mimeType': 'audio/wav', 'data': WAV}},
    '/v1/describe/storefront': {'image': {'mimeType': 'image/png', 'data': PNG, 'width': 1, 'height': 1}},
    '/v1/describe/piece': {'image': {'mimeType': 'image/png', 'data': PNG, 'width': 1, 'height': 1}},
    '/v1/tryon': {'selfPhoto': {'image': {'mimeType': 'image/png', 'data': PNG, 'width': 1, 'height': 1}, 'headMasked': True}, 'target': {'pieceRef': 'p', 'image': {'mimeType': 'image/png', 'data': PNG, 'width': 1, 'height': 1}, 'label': 'coat', 'category': 'coat', 'origin': 'shop'}, 'companions': []},
    '/v1/route': {'origin': {'lat': 0, 'lng': 0}, 'destination': {'lat': 1, 'lng': 1}},
}

def test_unknown_fields_rejected(client):
    for path, payload in REQUESTS.items():
        if path == '/v1/search/segment':
            from app.auth import pseudonym
            tokens = client.app.state.tokens
            settings = client.app.state.settings
            state = tokens.start(pseudonym(settings.hmac_secret, 'street-fitting-mock'),
                                 'jacket', REQUESTS['/v1/search/turn']['context'], scenario='normal')
            payload = {**payload, 'queryToken': tokens.sign(state)}
        response = client.post(path, json={**payload, 'unexpected': 'secret'}, headers=HEADERS)
        assert response.status_code == 400
        assert response.json()['error']['code'] == 'invalid_request'
        assert 'secret' not in response.text

def test_cross_field_constraints():
    with pytest.raises(ValidationError): QueryContext(now='2026-11-04T14:00:00Z', timeZone='Asia/Seoul')
    with pytest.raises(ValidationError): ExtractSummary(photoRef='p', candidateCount=0, topScore=0.5)
    with pytest.raises(ValidationError): SearchTurnRequest(query='coat')
    with pytest.raises(ValidationError): FindPhotosCall(id='x', name='find_photos', arguments={'phrase': 'coat'}, phraseVector=[0.0]*512)
    request = REQUESTS['/v1/tryon']
    with pytest.raises(ValidationError): TryOnRequest.model_validate({**request, 'companions': [request['target']]})

def test_optional_alias_rejects_explicit_null_but_accepts_omission():
    assert ListVisitsArguments.model_validate({}).model_dump(exclude_none=True) == {}
    with pytest.raises(ValidationError):
        ListVisitsArguments.model_validate({'from': None})
    arguments = ListVisitsArguments.model_validate({'from': '2026-11-04T00:00:00Z'})
    assert arguments.from_.isoformat() == '2026-11-04T00:00:00+00:00'

def test_no_network_during_schema_export(tmp_path):
    # Patch sockets in the exported process, including import-time activity.
    (tmp_path / 'sitecustomize.py').write_text("import socket\ndef denied(*a, **kw): raise RuntimeError('network forbidden')\nsocket.socket.connect = denied\nsocket.socket.connect_ex = denied\nsocket.create_connection = denied\n")
    env = dict(os.environ, PYTHONPATH=str(tmp_path))
    output = tmp_path / 'schema.json'
    subprocess.run([sys.executable, 'scripts/export_openapi.py', '--output', str(output)], env=env, check=True)
    schema = json.loads(output.read_text())
    assert len(schema['paths']) == 7
    assert 'FindPhotosCall' in schema['components']['schemas']
    for path in schema['paths'].values():
        assert {p['name'] for p in path['post']['parameters']} >= {'authorization', 'X-Firebase-AppCheck'}


def test_media_validation(client):
    for path in ('/v1/describe/piece', '/v1/describe/storefront'):
        image = REQUESTS[path]['image']
        for invalid in ({**image, 'data': 'YWJj'}, {**image, 'width': 2}, {**image, 'mimeType': 'image/jpeg'}):
            assert client.post(path, json={'image': invalid}, headers=HEADERS).status_code == 400
    assert client.post('/v1/transcribe', json={'audio': {'mimeType': 'audio/wav', 'data': 'YWJj'}}, headers=HEADERS).status_code == 400


def test_local_webview_preflight_and_error_headers(client):
    origin = 'https://localhost'
    preflight = client.options('/v1/route', headers={
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type,x-firebase-appcheck,x-sf-fixture',
    })
    assert preflight.status_code == 200
    assert preflight.headers['access-control-allow-origin'] == origin
    assert preflight.headers['cache-control'] == 'no-store'
    response = client.post('/v1/route', content=b' ' * 4097,
                           headers={**HEADERS, 'Origin': origin, 'Content-Type': 'application/json'})
    assert response.status_code == 413
    assert response.headers['access-control-allow-origin'] == origin
    exposed = {header.strip().lower() for header in response.headers['access-control-expose-headers'].split(',')}
    assert {'x-query-token', 'retry-after'} <= exposed
    assert response.json()['error']['code'] == 'payload_too_large'


def test_cors_does_not_trust_localhost_prefix_on_remote_host(client):
    response = client.options('/v1/route', headers={
        'Origin': 'https://localhost.attacker.example',
        'Access-Control-Request-Method': 'POST',
    })
    assert response.status_code == 400
    assert 'access-control-allow-origin' not in response.headers
