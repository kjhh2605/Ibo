import base64
import json

import pytest

from app.errors import RelayError
from app.schemas import SearchTurnRequest, SearchSegmentRequest
from app.token import QueryTokens


def pending_state(tokens, sub, context, name='find_photos', arguments=None):
    state = tokens.start(sub, 'coat', context)
    state.sparkTurns = 1
    state.pending = {'id': 'call1', 'name': name, 'arguments': arguments or {'phrase': 'coat', 'k': 3}}
    state.history = [{'call': state.pending.copy()}]
    return state


def next_request(tokens, state, **changes):
    return SearchTurnRequest.model_validate({'query': 'coat', 'queryToken': tokens.sign(state),
        'toolResults': [{'toolCallId': state.pending['id'], 'name': state.pending['name'], 'result': []}], **changes})


def test_tamper_other_uid_expiry_rejected(tokens, sub, context):
    token = tokens.sign(tokens.start(sub, 'coat', context))
    first, signature = token.split('.')
    changed = first[:-1] + ('A' if first[-1] != 'A' else 'B') + '.' + signature
    for value, subject, service, code in [(changed, sub, tokens, 'invalid_query_token'),
        (token, 'b' * 64, tokens, 'invalid_query_token'),
        (token, sub, QueryTokens(tokens.secret, clock=lambda: 1793800900), 'query_token_expired')]:
        with pytest.raises(RelayError) as error:
            service.verify(value, subject)
        assert error.value.code == code


def test_query_context_pending_mismatch_rejected(tokens, sub, context):
    state = pending_state(tokens, sub, context)
    changes = [{'query': 'dress'}, {'context': {**context, 'now': '2026-11-04T11:00:00-05:00'}},
               {'toolResults': [{'toolCallId': 'other', 'name': 'find_photos', 'result': []}]}]
    for change in changes:
        with pytest.raises(RelayError) as error:
            tokens.prepare_turn(next_request(tokens, state, **change), sub)
        assert error.value.code == 'invalid_request'


def test_expiry_never_extends(tokens, sub, context):
    state = pending_state(tokens, sub, context)
    later = QueryTokens(tokens.secret, clock=lambda: 1793800800)
    prepared = later.prepare_turn(next_request(tokens, state), sub)
    with later.attempt(prepared, 'spark') as consumed:
        result = later.finish_turn(consumed, {'not_found': {'reason': 'No matching photos.'}})
    updated = later.verify(result['queryToken'], sub)
    assert updated.exp == state.exp == state.iat + 900
    assert updated.sparkTurns == 2 and updated.closed


def test_fifth_turn_rejected_before_provider(tokens, sub, context):
    state = tokens.start(sub, 'coat', context)
    calls = 0
    for turn in range(4):
        with tokens.attempt(state, 'spark') as consumed:
            calls += 1
            body = ({'not_found': {'reason': 'No matching photos.'}} if turn == 3 else
                    {'toolCalls': [{'id': f'call{turn}', 'name': 'find_photos', 'arguments': {'phrase': 'coat'}, 'phraseVector': [1.0] + [0.0] * 511}]})
            output = tokens.finish_turn(consumed, body)
        state = tokens.verify(output['queryToken'], sub)
        if turn < 3:
            state = tokens.prepare_turn(next_request(tokens, state), sub)
    with pytest.raises(RelayError) as error:
        with tokens.attempt(state, 'spark'):
            calls += 1
    assert calls == 4 and error.value.code == 'turn_limit_exceeded'
    decoded = json.loads(base64.urlsafe_b64decode(output['queryToken'].split('.')[0] + '=='))
    assert 'phraseVector' not in json.dumps(decoded)


def test_fourth_sam_photo_rejected_before_provider(tokens, sub, context, image):
    state = pending_state(tokens, sub, context, 'extract_items', {'photoRefs': ['p1'], 'concept': 'coat'})
    calls = 0
    for refs in (['p1'], ['p2', 'p3']):
        state.pending = {'id': 'extract', 'name': 'extract_items', 'arguments': {'photoRefs': refs, 'concept': 'coat'}}
        request = SearchSegmentRequest(queryToken=tokens.sign(state), photos=[{'photoRef': ref, 'image': image} for ref in refs], concept='coat')
        prepared = tokens.prepare_segment(request, sub)
        with tokens.attempt(prepared, 'sam', photos=len(refs)) as consumed:
            calls += len(refs)
            result = tokens.finish_segment(consumed, {'photos': [{'photoRef': ref, 'candidates': []} for ref in refs]})
        state = tokens.verify(result['queryToken'], sub)
    state.pending = {'id': 'extract', 'name': 'extract_items', 'arguments': {'photoRefs': ['p4'], 'concept': 'coat'}}
    with pytest.raises(RelayError) as error:
        request = SearchSegmentRequest(queryToken=tokens.sign(state), photos=[{'photoRef': 'p4', 'image': image}], concept='coat')
        prepared = tokens.prepare_segment(request, sub)
        with tokens.attempt(prepared, 'sam', photos=1):
            calls += 1
    assert calls == 3 and error.value.code == 'photo_limit_exceeded'


@pytest.mark.parametrize('operation,photos,count', [('spark', 0, 1), ('sam', 2, 2)])
def test_failed_attempt_closes_consumed_token(tokens, sub, context, operation, photos, count):
    state = tokens.start(sub, 'coat', context)
    with pytest.raises(RelayError) as error:
        with tokens.attempt(state, operation, photos=photos):
            raise RelayError('upstream_timeout')
    consumed = tokens.verify(error.value.headers['X-Query-Token'], sub)
    assert consumed.closed and (consumed.sparkTurns if operation == 'spark' else consumed.samPhotos) == count
    assert state.sparkTurns == 0 and state.samPhotos == 0


def test_restart_with_same_secret_accepts_unexpired_token(tokens, sub, context):
    state = pending_state(tokens, sub, context)
    restarted = QueryTokens(tokens.secret, clock=lambda: 1793800010)
    assert restarted.verify(tokens.sign(state), sub) == state


def test_segment_summary_must_match_next_tool_result(tokens, sub, context, image):
    state = pending_state(tokens, sub, context, 'extract_items', {'photoRefs': ['p1'], 'concept': 'coat'})
    with tokens.attempt(state, 'sam', photos=1) as consumed:
        response = tokens.finish_segment(consumed, {'photos': [{'photoRef': 'p1', 'candidates': []}]})
    request = {'query': 'coat', 'queryToken': response['queryToken'], 'toolResults': [{'toolCallId': 'call1', 'name': 'extract_items', 'result': [{'photoRef': 'p1', 'candidateCount': 0, 'topScore': None}]}]}
    prepared = tokens.prepare_turn(SearchTurnRequest.model_validate(request), sub)
    assert prepared.samPhotos == 1 and prepared.pending is None
    request['toolResults'][0]['result'][0]['photoRef'] = 'different'
    with pytest.raises(RelayError):
        tokens.prepare_turn(SearchTurnRequest.model_validate(request), sub)
    duplicate = SearchSegmentRequest(queryToken=response['queryToken'], photos=[{'photoRef': 'p1', 'image': image}], concept='coat')
    with pytest.raises(RelayError) as error:
        tokens.prepare_segment(duplicate, sub)
    assert error.value.code == 'invalid_request'


def test_oversized_history_rejected_before_attempt(tokens, sub, context, monkeypatch):
    import app.token as module
    state = pending_state(tokens, sub, context)
    original = tokens.sign(state)
    monkeypatch.setattr(module, 'MAX_TOKEN', len(original) + 20)
    request = next_request(tokens, state, toolResults=[{'toolCallId': 'call1', 'name': 'find_photos', 'result': [
        {'photoRef': 'p' * 128, 'shopRef': 's' * 128, 'takenAt': context['now'], 'score': 0.5}]}])
    with pytest.raises(RelayError) as error:
        tokens.prepare_turn(request, sub)
    assert error.value.code == 'invalid_request' and not error.value.headers


def test_invalid_output_cannot_poison_failure_token(tokens, sub, context, monkeypatch):
    import app.token as module
    monkeypatch.setattr(module, 'MAX_TOKEN', 2000)
    state = tokens.start(sub, 'coat', context)
    with pytest.raises(RelayError) as error:
        with tokens.attempt(state, 'spark') as consumed:
            tokens.finish_turn(consumed, {'toolCalls': [{'id': 'find', 'name': 'find_photos',
                'arguments': {'phrase': 'coat', 'shopRefs': ['s' + str(i) * 100 for i in range(10)]},
                'phraseVector': [1.0] + [0.0] * 511}]})
    failed = tokens.verify(error.value.headers['X-Query-Token'], sub)
    assert failed.closed and failed.sparkTurns == 1 and failed.pending is None
    assert failed.history == []
