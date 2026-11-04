import asyncio
import builtins
import io
import json
import logging
import re
import tempfile
from pathlib import Path

import httpx
import pytest

from app.main import create_app
from .conftest import HEADERS, ROUTE, Verifier, audio, fitting, image, image_output, osrm_output, settings, text_output


@pytest.mark.parametrize('path,body,result', [
    ('describe/piece', {'image': image()}, text_output({'label': 'Blue coat', 'category': 'coat'})),
    ('describe/storefront', {'image': image()}, text_output({'description': 'A blue awning.'})),
    ('tryon', fitting(), image_output())])
def test_responses_store_false_no_tools_pseudonymous_id(provider, path, body, result):
    client, calls = provider(result)
    assert client.post('/v1/' + path, json=body).status_code == 200
    payload = json.loads(calls[0].content)
    assert payload['store'] is False
    assert re.fullmatch('[a-f0-9]{64}', payload['safety_identifier'])
    assert 'private-media-user' not in calls[0].content.decode()
    if path != 'tryon':
        assert payload['tools'] == []
    else:
        tool = payload['tools'][0]
        assert tool['type'] == 'image_generation'
        assert all(tool[name] is False for name in ('enable_image_search', 'enable_web_search', 'enable_shell'))


@pytest.mark.parametrize('log_text', [False, True])
@pytest.mark.parametrize('failure', [False, True])
def test_logs_have_no_media_audio_coordinates_or_provider_error(provider, caplog, log_text, failure):
    cases = [('transcribe', audio(), {'transcript': 'private-transcription-sentinel'}),
             ('describe/piece', {'image': image()}, text_output({'label': 'coat', 'category': 'coat'})),
             ('tryon', fitting(), image_output()), ('route', ROUTE, osrm_output())]
    caplog.set_level(logging.DEBUG)
    for path, body, output in cases:
        client, _ = provider({'error': {'message': json.dumps(body)}} if failure else output,
                             status=503 if failure else 200, log_text=log_text)
        response = client.post('/v1/' + path, json=body)
        assert response.status_code == (502 if failure else 200)
        assert response.headers['Cache-Control'] == 'no-store'
    logs = caplog.text
    for sentinel in (image()['data'], audio()['audio']['data'], 'private-transcription-sentinel',
                     '13.101', '52.201', 'routing.openstreetmap.de', 'private-media-user',
                     'synthetic-provider-secret', 'synthetic-id', 'synthetic-check'):
        assert sentinel not in logs


def _forbid_writes(monkeypatch):
    original = builtins.open
    def guarded(file, mode='r', *args, **kwargs):
        if any(flag in mode for flag in 'wax+'):
            pytest.fail('Media handling attempted a disk write')
        return original(file, mode, *args, **kwargs)
    def forbidden(*args, **kwargs):
        pytest.fail('Media handling attempted a file or cache write')
    monkeypatch.setattr(builtins, 'open', guarded)
    for name in ('TemporaryFile', 'NamedTemporaryFile', 'SpooledTemporaryFile', 'mkstemp', 'mkdtemp'):
        monkeypatch.setattr(tempfile, name, forbidden)
    monkeypatch.setattr(Path, 'write_bytes', forbidden)
    monkeypatch.setattr(Path, 'write_text', forbidden)


@pytest.mark.parametrize('status', [200, 503])
def test_upload_failure_create_no_temp_or_cache_files(provider, monkeypatch, status):
    client, _ = provider(image_output(), status)
    body = fitting()
    _forbid_writes(monkeypatch)
    assert client.post('/v1/tryon', json=body).status_code == (200 if status == 200 else 502)


def test_cancelled_upload_create_no_temp_or_cache_files(monkeypatch):
    async def run():
        started = asyncio.Event()
        async def handler(request):
            started.set()
            await asyncio.Future()
        app = create_app(settings=settings(), verifier=Verifier(), transport=httpx.MockTransport(handler))
        body = fitting()
        _forbid_writes(monkeypatch)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://relay') as client:
            task = asyncio.create_task(client.post('/v1/tryon', json=body, headers=HEADERS))
            await started.wait()
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
        await app.state.meta.aclose()
        app.state.authenticator.close()
    asyncio.run(run())


def test_request_exif_gps_rejected(provider):
    body = {'image': image(metadata={'XML:com.adobe.xmp': '<x xmlns:g="http://ns.adobe.com/exif/1.0/" g:GPSLatitude="13.1"/>'})}
    client, calls = provider(text_output({'label': 'coat', 'category': 'coat'}))
    assert client.post('/v1/describe/piece', json=body).status_code == 400
    assert not calls


def test_provider_error_does_not_echo_input(provider):
    body = fitting()
    client, calls = provider({'error': {'message': json.dumps(body)}}, 500)
    response = client.post('/v1/tryon', json=body)
    assert response.status_code == 502
    assert body['selfPhoto']['image']['data'] not in response.text
    assert response.json()['error']['message'] == 'The provider could not complete the request.'
    assert len(calls) == 1
