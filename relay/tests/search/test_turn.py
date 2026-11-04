import json

import pytest
from app.auth import pseudonym

from .harness import CONTEXT, Flow, call, fixture, found, provider_call, provider_text, summary, visits


def live_flow(client):
    flow = Flow(client)
    flow.headers = {}
    return flow


def test_fourth_turn_disables_all_tools(live_client):
    replies = [provider_call('list_visits', {}, 'provider/one'),
               provider_call('find_photos', {'phrase': 'a blue jacket'}, 'provider/two'),
               provider_call('extract_items', {'photoRefs': ['photo_blue_1'], 'concept': 'a blue jacket'}, 'provider/three'),
               provider_text(''), provider_text(json.dumps({'final': {'photoRefs': ['photo_blue_1'],
                    'concept': 'a blue jacket', 'summary': 'Check this photo.'}}))]
    with live_client(replies) as (client, requests):
        flow = live_flow(client).to_extract()
        response = flow.segment()
        assert response.status_code == 200
        assert flow.turn(summary(response)).status_code == 200
        payload = json.loads(requests[-1].content)
        assert payload['tools'] == []
        assert payload['tool_choice'] == 'auto'  # Meta explicitly rejects 'none'.
        assert payload['store'] is False
        assert payload['model'] == 'muse-spark-1.3'
        assert [p['call_id'] for p in payload['input'] if p.get('type') == 'function_call_output'] == [
            'provider/one', 'provider/two', 'provider/three']
        assert all('provider/' not in entry.get('id', '') for entry in [flow.pending or {}])
        assert len(requests) == 5  # four Spark, one SAM


def test_fifth_turn_rejected_before_provider(client):
    flow = Flow(client, 'turn-limit').to_extract()
    result = flow.segment()
    assert flow.turn(summary(result)).status_code == 200
    response = client.post('/v1/search/turn', headers=flow.headers,
                           json={'query': flow.query, 'queryToken': flow.token, 'toolResults': []})
    assert response.status_code == 409
    assert response.json()['error']['code'] == 'turn_limit_exceeded'


def test_pending_result_and_final_refs_validated(client, fixtures):
    flow = Flow(client)
    assert flow.turn().status_code == 200
    response = flow.turn(visits(), toolResults=[{'toolCallId': 'invented', 'name': 'list_visits', 'result': visits()}])
    assert response.status_code == 400
    assert flow.turn(visits()).status_code == 200
    fixture(fixtures, 'normal', 'search-turn', 3, {'query': flow.query},
            {'final': {'photoRefs': ['invented'], 'concept': 'a blue jacket', 'summary': 'Incorrect.'}})
    response = flow.turn(found())
    assert response.status_code == 500
    assert response.json()['error']['code'] == 'fixture_invalid'
    state = client.app.state.tokens.verify(response.headers['X-Query-Token'],
        pseudonym(client.app.state.settings.hmac_secret, 'street-fitting-mock'), scenario='normal')
    assert state.sparkTurns == 3 and state.closed


@pytest.mark.parametrize('updates', [{'query': 'Different question'}, {'context': {'now': '2026-11-04T14:01:00+09:00', 'timeZone': 'Asia/Seoul'}}])
def test_query_context_cannot_change(client, updates):
    flow = Flow(client)
    assert flow.turn().status_code == 200
    assert flow.turn(visits(), **updates).status_code == 400


@pytest.mark.parametrize('field', ['model', 'url', 'messages', 'system', 'tools', 'history'])
def test_invalid_model_url_messages_system_rejected(client, field):
    response = client.post('/v1/search/turn', json={'query': 'Find the blue jacket', 'context': CONTEXT, field: 'untrusted'})
    assert response.status_code == 400
    assert 'X-Query-Token' not in response.headers


@pytest.mark.parametrize('body', [provider_call('web_search', {}), provider_call('find_photos', {'phrase': 'jacket', 'k': 4}),
    provider_text('{"final":{"photoRefs":["unknown"],"concept":"jacket","summary":"Found."}}'),
    provider_text('{"not_found":{"reason":"None"},"final":{}}')])
def test_invalid_provider_output_closes_consumed_turn(live_client, body):
    with live_client([body]) as (client, requests):
        response = live_flow(client).turn()
        assert response.status_code == 502
        assert 'X-Query-Token' in response.headers
        assert len(requests) == 1


def test_valid_commentary_and_refusal_are_not_confused(live_client):
    reply = provider_call('list_visits', {})
    commentary = provider_text('Reading trips.')['output'][0]
    commentary['phase'] = 'commentary'
    reply['output'].insert(0, commentary)
    with live_client([reply]) as (client, requests):
        assert live_flow(client).turn().status_code == 200
    refusal = provider_text('')['output'][0]
    refusal['content'] = [{'type': 'refusal', 'refusal': 'policy detail not exposed'}]
    with live_client([{'status': 'completed', 'output': [refusal]}]) as (client, requests):
        response = live_flow(client).turn()
        assert response.status_code == 400
        assert response.json()['error']['code'] == 'content_policy_violation'
        assert 'policy detail' not in response.text


def test_unknown_shop_and_future_photo_rejected_before_provider(client):
    flow = Flow(client)
    assert flow.turn().status_code == 200
    assert flow.turn(visits()).status_code == 200
    bad = found()
    bad[0]['shopRef'] = 'unknown'
    assert flow.turn(bad).status_code == 400
    bad = found()
    bad[0]['takenAt'] = '2027-01-01T00:00:00+09:00'
    assert flow.turn(bad).status_code == 400


def test_fourth_turn_provider_tool_is_error_not_not_found(live_client):
    replies = [provider_call('list_visits', {}, f'call{i}') for i in range(4)]
    with live_client(replies) as (client, requests):
        flow = live_flow(client)
        assert flow.turn().status_code == 200
        assert flow.turn(visits()).status_code == 200
        assert flow.turn(visits()).status_code == 200
        response = flow.turn(visits())
        assert response.status_code == 502
        assert response.json()['error']['code'] == 'upstream_error'
        assert len(requests) == 4


@pytest.mark.parametrize('ident', ['', 'a' * 65, 'call with space', 'call\nnewline'])
def test_invalid_provider_call_id_fails_without_exposing_id(live_client, ident):
    with live_client([provider_call('list_visits', {}, ident)]) as (client, requests):
        response = live_flow(client).turn()
        assert response.status_code == 502
        assert 'X-Query-Token' in response.headers
        assert len(requests) == 1


@pytest.mark.parametrize('arguments', [{'phrase': 'jacket', 'k': '3'}, {'phrase': 'jacket', 'k': True},
                                       {'phrase': 'jacket', 'timeFrom': '2026-11-04T13:00:00'}])
def test_provider_arguments_are_not_coerced(live_client, arguments):
    with live_client([provider_call('find_photos', arguments)]) as (client, requests):
        response = live_flow(client).turn()
        assert response.status_code == 502
        assert len(requests) == 1


def test_final_shop_and_last_extract_concept_must_match(client, fixtures):
    for final in (
        {'photoRefs': ['photo_blue_1'], 'shopRef': 'shop_today_1', 'concept': 'a blue jacket', 'summary': 'Check.'},
        {'photoRefs': ['photo_blue_1'], 'concept': 'a different garment', 'summary': 'Check.'},
    ):
        flow = Flow(client).to_extract()
        segmented = flow.segment()
        assert segmented.status_code == 200
        fixture(fixtures, 'normal', 'search-turn', 4, {'query': flow.query}, {'final': final})
        response = flow.turn(summary(segmented))
        assert response.status_code == 500
        assert response.json()['error']['code'] == 'fixture_invalid'
