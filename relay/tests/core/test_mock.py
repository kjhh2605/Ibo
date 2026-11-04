import base64
import copy
import json

import pytest

from app.errors import RelayError
from app.mock import FixtureLoader, fixture_scenario
from app.schemas import SearchTurnRequest


def fixture(root, operation, body, *, expected=None, match=None, ignore=None, step=1, scenario='normal', status=200):
    directory = root / scenario
    directory.mkdir(exist_ok=True)
    stem = f'{operation}.{step:02d}'
    (directory / (stem + '.request.json')).write_text(json.dumps({'expected': expected or {}, 'match': match or [], 'ignore': ignore or []}))
    (directory / (stem + '.response.json')).write_text(json.dumps({'status': status, 'body': body}))


def first_query(tmp_path, tokens, sub, context):
    call = {'id': 'find', 'name': 'find_photos', 'arguments': {'phrase': 'coat'}, 'phraseVector': [1.0] + [0.0] * 511}
    fixture(tmp_path, 'search-turn', {'toolCalls': [call]}, expected={'query': 'coat'}, match=['/query'], ignore=['/context/now'])
    loader = FixtureLoader(tmp_path)
    replay, state = loader.prepare('normal', 'search-turn', 1, {'query': 'coat', 'context': context}, tokens=tokens, sub=sub)
    with tokens.attempt(state, 'spark') as consumed:
        response = replay.result(tokens=tokens, state=consumed)
    return loader, response


def second_request(response, context):
    return {'query': 'coat', 'queryToken': response['queryToken'], 'toolResults': [
        {'toolCallId': 'find', 'name': 'find_photos', 'result': [
            {'photoRef': 'current-photo', 'shopRef': 'current-shop', 'takenAt': context['now'], 'score': 0.7}]}]}


def test_scenario_operation_step_select_exact_response(tmp_path, image):
    fixture(tmp_path, 'describe-piece', {'label': 'coat', 'category': 'outerwear'})
    fixture(tmp_path, 'describe-piece', {'label': 'shoe', 'category': 'footwear'}, scenario='other')
    fixture(tmp_path, 'describe-storefront', {'description': 'A clothing shop.'})
    loader = FixtureLoader(tmp_path)
    assert loader.prepare('normal', 'describe-piece', 1, {'image': image})[0].result()['label'] == 'coat'
    assert loader.prepare('other', 'describe-piece', 1, {'image': image})[0].result()['label'] == 'shoe'
    assert loader.prepare('normal', 'describe-storefront', 1, {'image': image})[0].result()['description'] == 'A clothing shop.'
    with pytest.raises(RelayError) as error:
        loader.prepare('normal', 'describe-piece', 2, {'image': image})
    assert error.value.code == 'invalid_request'


def test_match_pointer_mismatch_returns_409_without_values(tmp_path, image):
    expected = {'image': {**image, 'mimeType': 'PRIVATE_EXPECTED_VALUE', 'width': 999}}
    fixture(tmp_path, 'describe-piece', {'label': 'coat', 'category': 'outerwear'}, expected=expected, match=['/image'], ignore=['/image/data'])
    with pytest.raises(RelayError) as error:
        FixtureLoader(tmp_path).prepare('normal', 'describe-piece', 1, {'image': image})
    assert error.value.code == 'fixture_request_mismatch'
    assert error.value.message == 'Fixture request mismatch at /image/mimeType'
    assert b'PRIVATE_EXPECTED_VALUE' not in error.value.response().body
    assert image['data'].encode() not in error.value.response().body


def test_ignored_time_refs_bytes_and_token_replay(tmp_path, tokens, sub, context, image):
    loader, response = first_query(tmp_path, tokens, sub, context)
    request = second_request(response, context)
    expected = copy.deepcopy(request)
    expected['queryToken'] = 'recorded-token'
    expected['toolResults'][0]['toolCallId'] = 'recorded-call'
    expected['toolResults'][0]['result'][0].update(photoRef='recorded-photo', shopRef='recorded-shop', takenAt='1999-01-01T00:00:00Z')
    ignore = ['/queryToken', '/toolResults/0/toolCallId', '/toolResults/0/result/0/photoRef', '/toolResults/0/result/0/shopRef', '/toolResults/0/result/0/takenAt']
    fixture(tmp_path, 'search-turn', {'not_found': {'reason': 'No match.'}}, expected=expected, match=['/query', '/toolResults'], ignore=ignore, step=2)
    replay, state = loader.prepare('normal', 'search-turn', 2, request, tokens=tokens, sub=sub)
    with tokens.attempt(state, 'spark') as consumed:
        assert replay.result(tokens=tokens, state=consumed)['not_found']['reason'] == 'No match.'
    fixture(tmp_path, 'describe-piece', {'label': 'coat', 'category': 'outerwear'}, expected={'image': {**image, 'data': 'recorded-bytes'}}, match=['/image'], ignore=['/image/data'])
    assert loader.prepare('normal', 'describe-piece', 1, {'image': image})[0].result()['label'] == 'coat'


def test_ignore_does_not_bypass_schema_media_or_limits(tmp_path, tokens, sub, context, image):
    fixture(tmp_path, 'describe-piece', {'label': 'coat', 'category': 'outerwear'}, expected={'image': image}, match=['/image'], ignore=['/image/data', '/image/width'])
    loader = FixtureLoader(tmp_path)
    for value in ({**image, 'data': '!!!!'}, {**image, 'width': 9}, {**image, 'width': 2049}):
        with pytest.raises(RelayError) as error:
            loader.prepare('normal', 'describe-piece', 1, {'image': value})
        assert error.value.code in ('invalid_request', 'payload_too_large')
    _, response = first_query(tmp_path, tokens, sub, context)
    request = second_request(response, context)
    request['queryToken'] += 'tampered'
    with pytest.raises(RelayError) as error:
        loader.prepare('normal', 'search-turn', 2, request, tokens=tokens, sub=sub)
    assert error.value.code == 'invalid_query_token'
    state = tokens.verify(response['queryToken'], sub, scenario='normal')
    state.sparkTurns = 4
    request['queryToken'] = tokens.sign(state)
    with pytest.raises(RelayError) as error:
        loader.prepare('normal', 'search-turn', 5, request, tokens=tokens, sub=sub)
    assert error.value.code == 'turn_limit_exceeded'


def test_echo_refs_propagate_to_response_and_token(tmp_path, tokens, sub, context):
    loader, first = first_query(tmp_path, tokens, sub, context)
    request = second_request(first, context)
    call = {'id': 'extract', 'name': 'extract_items', 'arguments': {'photoRefs': ['{{toolResults[0].result[0].photoRef}}'], 'concept': 'coat'}}
    fixture(tmp_path, 'search-turn', {'toolCalls': [call]}, expected={'query': 'coat'}, match=['/query'], step=2)
    replay, state = loader.prepare('normal', 'search-turn', 2, request, tokens=tokens, sub=sub)
    with tokens.attempt(state, 'spark') as consumed:
        response = replay.result(tokens=tokens, state=consumed)
    assert response['toolCalls'][0]['arguments']['photoRefs'] == ['current-photo']
    decoded = tokens.verify(response['queryToken'], sub, scenario='normal')
    assert decoded.pending['arguments']['photoRefs'] == ['current-photo']
    assert decoded.history[-1]['call']['arguments']['photoRefs'] == ['current-photo']


@pytest.mark.parametrize('body', [
    {'label': '{{image.data}}', 'category': 'outerwear'},
    {'label': 'partial {{query}}', 'category': 'outerwear'},
    {'label': 'coat', 'category': 'outerwear', 'queryToken': 'recorded'},
    {'label': '', 'category': 'outerwear'},
])
def test_invalid_echo_or_definition_returns_500(tmp_path, image, body):
    fixture(tmp_path, 'describe-piece', body)
    with pytest.raises(RelayError) as error:
        FixtureLoader(tmp_path).prepare('normal', 'describe-piece', 1, {'image': image})
    assert error.value.code == 'fixture_invalid'
    fixture(tmp_path, 'describe-piece', {'label': 'coat', 'category': 'outerwear'}, expected={'image': image}, match=['/image/data'], ignore=['/image'])
    with pytest.raises(RelayError) as error:
        FixtureLoader(tmp_path).prepare('normal', 'describe-piece', 1, {'image': image})
    assert error.value.code == 'fixture_invalid'


def test_runtime_resigns_query_token(tmp_path, tokens, sub, context):
    loader, first = first_query(tmp_path, tokens, sub, context)
    fixture(tmp_path, 'search-turn', {'not_found': {'reason': 'No matching photo.'}}, expected={'query': 'coat'}, match=['/query'], step=2)
    replay, state = loader.prepare('normal', 'search-turn', 2, second_request(first, context), tokens=tokens, sub=sub)
    with tokens.attempt(state, 'spark') as consumed:
        response = replay.result(tokens=tokens, state=consumed)
    assert response['queryToken'] != first['queryToken']
    decoded = tokens.verify(response['queryToken'], sub, scenario='normal')
    assert decoded.closed and decoded.sparkTurns == 2


def test_scenario_cannot_change(tmp_path, tokens, sub, context):
    loader, first = first_query(tmp_path, tokens, sub, context)
    with pytest.raises(RelayError) as error:
        loader.prepare('other', 'search-turn', 2, second_request(first, context), tokens=tokens, sub=sub)
    assert error.value.code == 'invalid_request'


def test_live_fixture_header_rejected():
    assert fixture_scenario('live', None) is None
    for value in ('normal', '', '../normal'):
        with pytest.raises(RelayError) as error:
            fixture_scenario('live', value)
        assert error.value.code == 'invalid_request'


def test_missing_fixture_returns_501_without_network(tmp_path, image):
    with pytest.raises(RelayError) as error:
        FixtureLoader(tmp_path).prepare('normal', 'describe-piece', 1, {'image': image})
    assert error.value.status == 501 and error.value.code == 'fixture_not_found'


def test_asset_path_escape_rejected(tmp_path, image):
    request = {'selfPhoto': {'image': image, 'headMasked': True}, 'target': {'pieceRef': 'target', 'image': image,
               'label': 'coat', 'category': 'outerwear', 'origin': 'shop'}, 'companions': []}
    for asset in ('assets/../../private.png', '/tmp/private.png', 'https://private.invalid/image'):
        fixture(tmp_path, 'tryon', {'image': {**image, 'data': {'asset': asset}}})
        with pytest.raises(RelayError) as error:
            FixtureLoader(tmp_path).prepare('normal', 'tryon', 1, request)
        assert error.value.code == 'fixture_invalid'
    assets = tmp_path / 'normal' / 'assets'
    assets.mkdir()
    outside = tmp_path / 'outside.png'
    outside.write_bytes(base64.b64decode(image['data']))
    (assets / 'escape.png').symlink_to(outside)
    fixture(tmp_path, 'tryon', {'image': {**image, 'data': {'asset': 'assets/escape.png'}}})
    with pytest.raises(RelayError) as error:
        FixtureLoader(tmp_path).prepare('normal', 'tryon', 1, request)
    assert error.value.code == 'fixture_invalid'
    (assets / 'valid.png').write_bytes(outside.read_bytes())
    fixture(tmp_path, 'tryon', {'image': {**image, 'data': {'asset': 'assets/valid.png'}}})
    assert FixtureLoader(tmp_path).prepare('normal', 'tryon', 1, request)[0].result()['image']['data'] == image['data']
