import base64
import copy
import hashlib
import json

import pytest

from .conftest import fitting, image, image_output


@pytest.mark.parametrize('count', range(6))
def test_two_to_seven_images_allowed_in_order(provider, count):
    body = fitting(count)
    client, calls = provider(image_output())
    response = client.post('/v1/tryon', json=body)
    assert response.status_code == 200
    wire = json.loads(calls[0].content)
    images = [body['selfPhoto']['image'], body['target']['image'], *(p['image'] for p in body['companions'])]
    assert [part['image_url'] for part in wire['input'][0]['content']] == [
        'data:' + item['mimeType'] + ';base64,' + item['data'] for item in images]
    tool = wire['tools'][0]
    assert tool['enable_image_search'] is tool['enable_web_search'] is tool['enable_shell'] is False
    assert tool['output_format'] == 'png' and tool['reasoning_strength'] == 'low'
    assert 'mask' not in wire and wire['store'] is False


@pytest.mark.parametrize('invalid', ['sixth', 'second-self', 'wardrobe', 'duplicate', 'unmasked'])
def test_invalid_compositions_rejected_before_provider(provider, invalid):
    body = fitting(6 if invalid == 'sixth' else 1)
    if invalid == 'second-self':
        body['selfPhoto'] = [body['selfPhoto'], body['selfPhoto']]
    elif invalid == 'wardrobe':
        body['target']['origin'] = 'wardrobe'
    elif invalid == 'duplicate':
        body['companions'][0]['pieceRef'] = body['target']['pieceRef']
    elif invalid == 'unmasked':
        body['selfPhoto']['headMasked'] = False
    client, calls = provider(image_output())
    assert client.post('/v1/tryon', json=body).status_code == 400
    assert not calls


def test_content_policy_violation_400_not_retryable(provider):
    client, calls = provider({'error': {'code': 'content_policy_violation', 'message': 'secret'}}, 400)
    response = client.post('/v1/tryon', json=fitting())
    assert response.status_code == 400
    assert response.json()['error']['code'] == 'content_policy_violation'
    assert response.json()['error']['retryable'] is False
    assert len(calls) == 1 and 'secret' not in response.text


@pytest.mark.parametrize('fmt', ['PNG', 'JPEG'])
def test_provider_bytes_metadata_and_watermark_unchanged(provider, fmt):
    generated = image(metadata={'provenance': 'synthetic-watermark-metadata', 'GPSLatitude': '1,2'}, fmt=fmt)
    original = base64.b64decode(generated['data'])
    client, _ = provider(image_output(generated['data']))
    response = client.post('/v1/tryon', json=fitting())
    assert response.status_code == 200
    returned = base64.b64decode(response.json()['image']['data'])
    assert hashlib.sha256(returned).digest() == hashlib.sha256(original).digest()
    assert returned == original


@pytest.mark.parametrize('value', ['https://files.meta.ai/result.png', 'http://127.0.0.1/private',
                                    {'url': 'https://example.com/result.png'}])
def test_url_only_provider_output_rejected_without_fetch(provider, value):
    client, calls = provider(image_output(value))
    response = client.post('/v1/tryon', json=fitting())
    assert response.status_code == 502
    assert len(calls) == 1
    assert calls[0].method == 'POST'


@pytest.mark.parametrize('body', [
    {'status': 'completed', 'output': []},
    {'status': 'completed', 'output': image_output()['output'] * 2},
    image_output('not base64'), image_output(base64.b64encode(b'not an image').decode()),
    image_output(image(size=(8193, 1))['data']),
    image_output(base64.b64encode(b'x' * (33554432 + 1)).decode())])
def test_missing_or_oversize_output_is_upstream_error(provider, body):
    client, calls = provider(body)
    response = client.post('/v1/tryon', json=fitting())
    assert response.status_code == 502
    assert response.json()['error']['code'] == 'upstream_error'
    assert len(calls) == 1


@pytest.mark.parametrize('size,expected', [((3, 4), '3x4'), ((32, 1), '16x1'), ((1, 32), '1x16')])
def test_output_aspect_ratio_uses_supported_range(provider, size, expected):
    body = fitting()
    body['selfPhoto']['image'] = image(size=size)
    client, calls = provider(image_output())
    assert client.post('/v1/tryon', json=body).status_code == 200
    assert json.loads(calls[0].content)['tools'][0]['size'] == expected
