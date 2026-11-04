import asyncio
import base64
import io
import json
import wave

import httpx
import pytest
from PIL import Image

from app.schemas import TranscribeRequest, TryOnRequest
from conftest import make_app


def test_unknown_fields_models_urls_messages_system_rejected(client, image, context):
    for field in ('model', 'url', 'messages', 'system', 'tools', 'history', 'sparkTurns'):
        response = client.post('/v1/search/turn', json={'query': 'coat', 'context': context, field: 'private-sentinel'})
        assert response.status_code == 400 and 'private-sentinel' not in response.text
    response = client.post('/v1/describe/piece', json={'image': {**image, 'url': 'https://private.invalid/image'}})
    assert response.status_code == 400
    for headers, body in [({'Content-Encoding': 'gzip', 'Content-Type': 'application/json'}, '{}'),
                          ({'Content-Type': 'multipart/form-data'}, 'private-sentinel'),
                          ({'Content-Type': 'application/json'}, '{"image":{},"image":{}}'),
                          ({'Content-Type': 'application/json'}, '{"image":NaN}')]:
        response = client.post('/v1/describe/piece', headers=headers, content=body)
        assert response.status_code == 400


def test_chunked_body_limit_without_content_length(settings):
    app = make_app(settings)
    async def run():
        async def chunks():
            yield b'{"origin":'
            yield b' ' * 4096
            raise AssertionError('Body limit should stop before consuming another chunk')
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            response = await client.post('/v1/route', headers={'Content-Type': 'application/json'}, content=chunks())
            assert response.status_code == 413
            assert response.request.headers.get('content-length') is None
        await app.state.meta.aclose()
    asyncio.run(run())


def test_invalid_base64_mime_dimensions_gps_rejected(client, image):
    exif = Image.Exif()
    exif[34853] = {1: 'N', 2: (1.0, 2.0, 3.0)}
    stream = io.BytesIO()
    Image.new('RGB', (2, 2)).save(stream, format='JPEG', exif=exif)
    invalid = [{**image, 'data': '!!!!'}, {**image, 'data': image['data'] + '\n'},
               {**image, 'mimeType': 'image/jpeg'}, {**image, 'width': 3},
               {**image, 'mimeType': 'image/jpeg', 'data': base64.b64encode(stream.getvalue()).decode()}]
    for value in invalid:
        response = client.post('/v1/describe/piece', json={'image': value})
        assert response.status_code == 400
    assert client.post('/v1/describe/piece', json={'image': {**image, 'width': 2049}}).status_code == 413


def test_validation_error_has_no_input(client, image):
    response = client.post('/v1/describe/piece', json={'image': {**image, 'data': 'PRIVATE_MEDIA_SENTINEL'}})
    assert response.status_code == 400
    assert response.json() == {'error': {'code': 'invalid_request', 'message': 'Invalid request.', 'retryable': False}}
    assert 'PRIVATE_MEDIA_SENTINEL' not in response.text


def test_all_responses_no_store(client, image):
    responses = [client.post('/v1/describe/piece', json={'image': image}),
                 client.post('/v1/describe/piece', json={}), client.get('/missing'),
                 client.get('/v1/describe/piece'), client.options('/v1/describe/piece')]
    assert [response.status_code for response in responses] == [200, 400, 404, 405, 405]
    assert all(response.headers['cache-control'] == 'no-store' for response in responses)


def test_media_counts_and_duration_limits(image):
    stream = io.BytesIO()
    with wave.open(stream, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b'\0\0' * 16000 * 16)
    with pytest.raises(ValueError):
        TranscribeRequest.model_validate({'audio': {'mimeType': 'audio/wav', 'data': base64.b64encode(stream.getvalue()).decode()}})
    target = {'pieceRef': 'target', 'image': image, 'label': 'coat', 'category': 'outerwear', 'origin': 'shop'}
    body = {'selfPhoto': {'image': image, 'headMasked': True}, 'target': target,
            'companions': [{**target, 'pieceRef': f'piece{i}'} for i in range(6)]}
    with pytest.raises(ValueError):
        TryOnRequest.model_validate(body)
    body['companions'] = []
    body['selfPhoto']['headMasked'] = False
    with pytest.raises(ValueError):
        TryOnRequest.model_validate(body)
