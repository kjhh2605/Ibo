from copy import deepcopy

import pytest

from app.auth import pseudonym
from .harness import CONTEXT, QUERIES, Flow, fixture, found, image, summary, visits


@pytest.mark.parametrize('scenario', ['normal', 'shop-specific', 'time-specific', 'note-specific', 'past-trip', 'not-found', 'turn-limit'])
def test_required_seven_scenarios_replay_exactly(client, scenario):
    flow = Flow(client, scenario)
    assert flow.turn().status_code == 200
    response = flow.turn(visits())
    assert response.status_code == 200
    args = response.json()['toolCalls'][0]['arguments']
    if scenario in ('shop-specific', 'note-specific'):
        assert args['shopRefs'] == ['shop_today_2']
    if scenario == 'time-specific':
        assert args['timeFrom'] == '2026-11-04T13:35:00+09:00'
        assert args['timeTo'] == '2026-11-04T13:45:00+09:00'
    if scenario == 'past-trip':
        assert args['timeFrom'] == '2026-10-31T00:00:00+09:00'
        assert args['timeTo'] == '2026-11-01T00:00:00+09:00'
    response = flow.turn([] if scenario == 'not-found' else found(scenario))
    assert response.status_code == 200
    if scenario != 'not-found':
        segmented = flow.segment()
        assert segmented.status_code == 200
        assert [c['score'] for c in segmented.json()['photos'][0]['candidates']] == [0.9, 0.5, 0.5, 0.01]
        response = flow.turn(summary(segmented))
        assert response.status_code == 200
    assert ('not_found' if scenario in ('not-found', 'turn-limit') else 'final') in response.json()
    state = client.app.state.tokens.verify(flow.token,
        pseudonym(client.app.state.settings.hmac_secret, 'street-fitting-mock'), scenario=scenario)
    assert state.closed
    assert state.sparkTurns == (3 if scenario == 'not-found' else 4)
    assert state.samPhotos == (0 if scenario == 'not-found' else 1)


def test_photo_limit(client, fixtures):
    from .harness import call
    flow = Flow(client, 'photo-limit')
    assert flow.turn().status_code == 200
    assert flow.turn(visits()).status_code == 200
    refs = ['photo_a', 'photo_b', 'photo_c']
    fixture(fixtures, 'photo-limit', 'search-turn', 3, {'query': flow.query},
            call('extract_items', {'photoRefs': refs, 'concept': 'a blue jacket'}, 'extract_three'))
    assert flow.turn(found(refs=refs)).status_code == 200
    fixture(fixtures, 'photo-limit', 'search-segment', 1, {'concept': 'a blue jacket'},
            {'photos': [{'photoRef': ref, 'candidates': []} for ref in refs]}, match=['/concept'])
    assert flow.segment().status_code == 200
    response = flow.segment(photos=[{'photoRef': 'photo_a', 'image': image()}])
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'photo_limit_exceeded'


def test_timeout_returns_consumed_token(client):
    response = Flow(client, 'upstream-timeout').turn()
    assert response.status_code == 504
    state = client.app.state.tokens.verify(response.headers['X-Query-Token'],
        pseudonym(client.app.state.settings.hmac_secret, 'street-fitting-mock'), scenario='upstream-timeout')
    assert state.sparkTurns == 1 and state.samPhotos == 0 and state.closed


def test_mock_runs_without_pe_weights(client, monkeypatch):
    def forbidden(*args):
        raise AssertionError('Mock must not load PE')
    monkeypatch.setattr('app.pe_text.load_pe_text', forbidden)
    flow = Flow(client)
    assert flow.turn().status_code == 200
    response = flow.turn(visits())
    assert response.status_code == 200
    vector = response.json()['toolCalls'][0]['phraseVector']
    assert sum(v * v for v in vector) == 1


def test_unregistered_request_never_uses_network(client):
    response = client.post('/v1/search/turn', headers={'X-SF-Fixture': 'unregistered'},
                           json={'query': 'Find the blue jacket', 'context': CONTEXT})
    assert response.status_code == 501
    assert response.json()['error']['code'] == 'fixture_not_found'
    assert 'X-Query-Token' not in response.headers


def test_dynamic_refs_times_bytes_replay_with_echo(client):
    flow = Flow(client)
    assert flow.turn(context={**CONTEXT, 'now': '2026-11-04T15:00:00+09:00'}).status_code == 200
    dynamic = visits()
    dynamic['visits'][0]['shopRef'] = 'dynamic_shop_91'
    assert flow.turn(dynamic).status_code == 200
    photos = found(refs=['dynamic_photo_42'])
    photos[0].update(shopRef='dynamic_shop_91', takenAt='2026-11-04T13:40:01+09:00')
    response = flow.turn(photos)
    assert response.status_code == 200
    assert flow.pending['arguments']['photoRefs'] == ['dynamic_photo_42']
    segmented = flow.segment(photos=[{'photoRef': 'dynamic_photo_42', 'image': image(value=61)}])
    assert segmented.status_code == 200
    response = flow.turn(summary(segmented))
    assert response.json()['final']['photoRefs'] == ['dynamic_photo_42']


@pytest.mark.parametrize('mismatch', ['query', 'concept', 'tool', 'count'])
def test_query_concept_tool_name_or_photo_count_mismatch_409(client, fixtures, mismatch):
    # Each request remains schema/token-valid; only its selected recording differs.
    if mismatch == 'query':
        response = Flow(client).turn(query='An unmatched query')
    elif mismatch == 'tool':
        flow = Flow(client)
        assert flow.turn().status_code == 200
        fixture(fixtures, 'normal', 'search-turn', 2, {'query': flow.query, 'toolResults': [{'name': 'find_photos'}]},
                {'not_found': {'reason': 'None.'}}, match=['/query', '/toolResults/0/name'])
        response = flow.turn(visits())
    else:
        flow = Flow(client).to_extract()
        expected = {'concept': 'wrong' if mismatch == 'concept' else 'a blue jacket',
                    'photos': [{'photoRef': 'ignored', 'image': image()}] * (2 if mismatch == 'count' else 1)}
        fixture(fixtures, 'normal', 'search-segment', 1, expected, {'photos': []}, match=['/concept', '/photos'],
                ignore=['/queryToken', '/photos/0/photoRef', '/photos/0/image/data'])
        response = flow.segment()
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'fixture_request_mismatch'
    assert 'X-Query-Token' not in response.headers


def test_time_filter_is_start_inclusive_end_exclusive(client):
    flow = Flow(client, 'time-specific')
    assert flow.turn().status_code == 200
    assert flow.turn(visits()).status_code == 200
    at_end = found()
    at_end[0]['takenAt'] = '2026-11-04T13:45:00+09:00'
    assert flow.turn(at_end).status_code == 400
    before_start = found()
    before_start[0]['takenAt'] = '2026-11-04T13:34:59+09:00'
    assert flow.turn(before_start).status_code == 400
    assert flow.turn(found()).status_code == 200
