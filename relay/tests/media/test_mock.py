import copy

import pytest

from app.errors import RelayError
from .conftest import ROUTE, audio, fitting, image


@pytest.mark.parametrize('scenario,operation,body,code', [
    ('voice-empty', 'transcribe', audio(), None),
    ('tryon-policy', 'tryon', fitting(), 'content_policy_violation'),
    ('route-unavailable', 'route', ROUTE, 'route_unavailable'),
    ('upstream-timeout', 'transcribe', audio(), 'upstream_timeout')])
def test_voice_empty_tryon_policy_route_unavailable_timeout_replay(replay, scenario, operation, body, code):
    client, put = replay
    response = RelayError(code).response() if code else None
    import json
    put(operation, body, json.loads(response.body) if response else {'text': '', 'language': 'en'},
        scenario=scenario, status=response.status_code if response else 200)
    actual = client.post('/v1/' + operation, json=body, headers={'X-SF-Fixture': scenario})
    assert actual.status_code == (response.status_code if response else 200)
    assert actual.json() == (json.loads(response.body) if response else {'text': '', 'language': 'en'})
    assert actual.headers['Cache-Control'] == 'no-store'


def test_direct_cut_shop_replays_with_changed_valid_image_bytes(replay):
    client, put = replay
    expected = {'label': 'Blue coat', 'category': 'outer'}
    put('describe-piece', {'image': image(20)}, expected, scenario='direct-cut-shop',
        match=['/image/mimeType'], ignore=['/image/data'])
    actual = client.post('/v1/describe/piece', json={'image': image(200)}, headers={'X-SF-Fixture': 'direct-cut-shop'})
    assert actual.status_code == 200 and actual.json() == expected


def test_slot_or_photo_count_mismatch_409(replay):
    client, put = replay
    expected = fitting(2)
    put('tryon', expected, {'image': image()}, match=['/pieces'],
        ignore=['/pieces/0/image/data', '/pieces/1/image/data'])
    body = copy.deepcopy(expected)
    body['pieces'][1]['category'] = 'outer'
    actual = client.post('/v1/tryon', json=body)
    assert actual.status_code == 409
    assert actual.json()['error']['message'].endswith('/pieces/1/category')
    body = fitting(1)
    actual = client.post('/v1/tryon', json=body)
    assert actual.status_code == 409
    assert actual.json()['error']['message'].endswith('/pieces')


@pytest.mark.parametrize('body', [audio(240001), audio(rate=24000), {'audio': {'mimeType': 'audio/wav', 'data': '!!!!'}}])
def test_ignored_audio_still_rejects_invalid_format_or_duration(replay, body):
    client, put = replay
    put('transcribe', audio(), {'text': '', 'language': 'en'}, match=['/audio'], ignore=['/audio/data'])
    assert client.post('/v1/transcribe', json=body).status_code == 400


def test_request_limits_precede_mock_lookup(replay):
    client, _ = replay
    assert client.post('/v1/tryon', json={**fitting(3), 'pieces': fitting(3)['pieces'] * 2}).status_code == 400
    assert client.post('/v1/transcribe', json=audio(262145)).status_code == 413


@pytest.mark.parametrize('path,body', [('transcribe', audio()), ('describe/piece', {'image': image()}),
                                      ('describe/storefront', {'image': image()}), ('tryon', fitting()), ('route', ROUTE)])
def test_missing_fixture_501_no_live_fallback(replay, path, body):
    client, _ = replay
    actual = client.post('/v1/' + path, json=body)
    assert actual.status_code == 501
    assert actual.json()['error']['code'] == 'fixture_not_found'


def test_provider_file_replay_preserves_bytes_and_invalid_output_rejected(replay):
    client, put = replay
    generated = image(metadata={'provenance': 'synthetic-provider'})
    put('tryon', fitting(), {'image': generated})
    actual = client.post('/v1/tryon', json=fitting())
    assert actual.status_code == 200 and actual.json()['image'] == generated
    put('tryon', fitting(), {'image': {**generated, 'width': 3}})
    assert client.post('/v1/tryon', json=fitting()).json()['error']['code'] == 'fixture_invalid'


def test_rate_limit_replay_preserves_safe_retry_header(replay):
    client, put = replay
    import json
    error = RelayError('upstream_rate_limited').response()
    put('transcribe', audio(), json.loads(error.body), status=429, headers={'Retry-After': '8'})
    actual = client.post('/v1/transcribe', json=audio())
    assert actual.status_code == 429 and actual.headers['Retry-After'] == '8'
