import asyncio
import base64
import builtins
import io
import json
import logging
import os
import tempfile
from dataclasses import replace

import httpx
import pytest
from PIL import Image

from app.errors import RelayError
from app.logging import configure_logging, log_search_text
from app.meta_client import MetaClient, Operation


def test_default_logs_contain_no_request_or_response_body(client, image, caplog):
    caplog.set_level(logging.INFO, logger='street_fitting.relay')
    response = client.post('/v1/describe/piece', json={'image': image})
    assert response.status_code == 200
    records = [json.loads(record.message) for record in caplog.records if record.name == 'street_fitting.relay']
    assert records and all(set(record) == {'endpoint', 'pseudonymousId', 'latencyMs', 'statusCode', 'sparkTurns'} for record in records)
    assert image['data'] not in caplog.text and 'outerwear' not in caplog.text


def test_text_logs_never_contain_image_audio_coordinates_tokens(settings, image, caplog):
    caplog.set_level(logging.INFO, logger='street_fitting.relay')
    settings = replace(settings, log_text=True)
    token = 'PRIVATE_TOKEN_SENTINEL' * 8
    log_search_text(settings, query='Find my coat', response={'queryToken': token, 'not_found': {'reason': 'No matching photos.'}})
    log_search_text(settings, query='data:audio/wav;base64,' + image['data'])
    log_search_text(settings, response={'queryToken': token, 'image': image})
    assert 'Find my coat' in caplog.text and 'No matching photos.' in caplog.text
    assert token not in caplog.text and image['data'] not in caplog.text and 'data:audio' not in caplog.text


def test_coordinate_text_field_omitted(settings, caplog):
    caplog.set_level(logging.INFO, logger='street_fitting.relay')
    settings = replace(settings, log_text=True)
    for value in ('coat near 37.7749, -122.4194', 'latitude 37.7749', '37° 46 north', 'at 37.7749 N',
                  'coat near 40,-73', 'at 40°N 73°W', 'at 40 N and 73 W'):
        log_search_text(settings, query=value, response={'queryToken': 'unused', 'not_found': {'reason': value}})
    assert not caplog.records


def test_osrm_url_not_logged(settings, caplog):
    configure_logging()
    caplog.set_level(logging.DEBUG)
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(500, text='PRIVATE_PROVIDER_SENTINEL')
    async def run():
        client = MetaClient(replace(settings, mode='live', mock_skip_auth=False, firebase_project_id='test',
                                   firebase_app_id='1:123:android:abc', model_api_key='private-key'), transport=httpx.MockTransport(handler))
        with pytest.raises(RelayError):
            await client.route({'lat': 37.7749, 'lng': -122.4194}, {'lat': 37.775, 'lng': -122.419})
        await client.aclose()
    asyncio.run(run())
    assert requests[0].url.host == 'routing.openstreetmap.de'
    assert 'authorization' not in requests[0].headers
    assert '37.7749' not in caplog.text and 'routing.openstreetmap.de' not in caplog.text


def test_success_failure_cancel_create_no_upload_files(settings, monkeypatch, caplog):
    settings = replace(settings, mode='live', mock_skip_auth=False, firebase_project_id='test',
                       firebase_app_id='1:123:android:abc', model_api_key='private-key')
    writes = []
    def forbid(*args, **kwargs):
        writes.append('temporary-file')
        raise AssertionError('Media must remain in memory')
    original_open, original_io, original_os = builtins.open, io.open, os.open
    def guarded_open(original):
        def wrapped(file, mode='r', *args, **kwargs):
            if any(flag in str(mode) for flag in 'wax+'):
                writes.append('file-write')
                raise AssertionError('Media must remain in memory')
            return original(file, mode, *args, **kwargs)
        return wrapped
    def guarded_os(file, flags, *args, **kwargs):
        if flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC):
            writes.append('os-write')
            raise AssertionError('Media must remain in memory')
        return original_os(file, flags, *args, **kwargs)
    async def run():
        entered = asyncio.Event()
        async def handler(request):
            body = json.loads(request.content)
            if body['instructions'] == 'failure':
                return httpx.Response(500)
            if body['instructions'] == 'cancel':
                entered.set()
                await asyncio.sleep(10)
            return httpx.Response(200, json={'output': []})
        client = MetaClient(settings, transport=httpx.MockTransport(handler))
        with monkeypatch.context() as patch:
            patch.setattr(builtins, 'open', guarded_open(original_open))
            patch.setattr(io, 'open', guarded_open(original_io))
            patch.setattr(os, 'open', guarded_os)
            for name in ('TemporaryFile', 'NamedTemporaryFile', 'SpooledTemporaryFile', 'mkstemp'):
                patch.setattr(tempfile, name, forbid)
            for action in ('success', 'failure'):
                try:
                    await client.responses(Operation.SPARK, {'input': 'PRIVATE_MEDIA_SENTINEL' * 20, 'instructions': action}, sub='a' * 64)
                except RelayError:
                    assert action == 'failure'
            task = asyncio.create_task(client.responses(Operation.SPARK, {'input': 'PRIVATE_MEDIA_SENTINEL' * 20, 'instructions': 'cancel'}, sub='a' * 64))
            await entered.wait()
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
        await client.aclose()
    asyncio.run(run())
    assert writes == [] and 'PRIVATE_MEDIA_SENTINEL' not in caplog.text


def test_rejected_image_metadata_never_reaches_debug_logs(client, caplog):
    exif = Image.Exif()
    exif[700] = b'<m GPSLatitude="37,46.494N"/>'
    stream = io.BytesIO()
    Image.new('RGB', (2, 2)).save(stream, format='JPEG', exif=exif)
    image = {'mimeType': 'image/jpeg', 'data': base64.b64encode(stream.getvalue()).decode(),
             'width': 2, 'height': 2}
    caplog.set_level(logging.DEBUG)
    response = client.post('/v1/describe/piece', json={'image': image})
    assert response.status_code == 400
    assert '37,46.494' not in caplog.text and 'GPSLatitude' not in caplog.text
    assert image['data'] not in caplog.text
