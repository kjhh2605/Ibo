import base64
import io
import json

import httpx
import pytest
from PIL import Image

from app.auth import pseudonym
from .harness import Flow, call, candidates, fixture, found, image, provider_call, provider_text, sam_text, summary, visits
from .test_turn import live_flow


def segment_live_replies(*sam):
    return [provider_call('list_visits', {}, 'p1'), provider_call('find_photos', {'phrase': 'a blue jacket'}, 'p2'),
            provider_call('extract_items', {'photoRefs': ['photo_blue_1'], 'concept': 'a blue jacket'}, 'p3'), *sam]


def test_one_then_two_photos_allowed_fourth_rejected(client, fixtures):
    # Legal four-turn chain: find -> extract one -> extract two -> terminal.
    # Start with visits already known through an ordinary first list turn would
    # leave no second extract turn; unscoped find is allowed as the first call.
    fixture(fixtures, 'photo-limit', 'search-turn', 1, {'query': 'Find the blue jacket'}, call('find_photos', {'phrase': 'a blue jacket'}, 'f'))
    flow = Flow(client, 'photo-limit')
    assert flow.turn().status_code == 200
    # find without list can report opaque shopRefs, provided no invented filter was used.
    fixture(fixtures, 'photo-limit', 'search-turn', 2, {'query': flow.query}, call('extract_items',
        {'photoRefs': ['photo_blue_1'], 'concept': 'a blue jacket'}, 'e1'))
    assert flow.turn(found(refs=['photo_blue_1', 'photo_blue_2', 'photo_blue_3'])).status_code == 200
    first = flow.segment()
    assert first.status_code == 200
    fixture(fixtures, 'photo-limit', 'search-turn', 3, {'query': flow.query}, call('extract_items',
        {'photoRefs': ['photo_blue_2', 'photo_blue_3'], 'concept': 'a blue jacket'}, 'e2'))
    assert flow.turn(summary(first)).status_code == 200
    fixture(fixtures, 'photo-limit', 'search-segment', 2, {'concept': 'a blue jacket'},
            {'photos': [{'photoRef': ref, 'candidates': []} for ref in ['photo_blue_2', 'photo_blue_3']]}, match=['/concept'])
    second = flow.segment()
    assert second.status_code == 200
    fourth = flow.segment(photos=[{'photoRef': 'photo_blue_1', 'image': image()}])
    assert fourth.status_code == 409
    assert fourth.json()['error']['code'] == 'photo_limit_exceeded'


def test_duplicate_ref_or_pending_order_mismatch_rejected(client):
    flow = Flow(client).to_extract()
    photo = {'photoRef': 'photo_blue_1', 'image': image()}
    assert flow.segment(photos=[photo, photo]).status_code == 400
    assert flow.segment(photos=[{'photoRef': 'other', 'image': image()}]).status_code == 400
    assert flow.segment(concept='different').status_code == 400


def test_new_segment_token_used_by_next_turn(client):
    flow = Flow(client).to_extract()
    old = flow.token
    result = flow.segment()
    assert result.status_code == 200 and flow.token != old
    assert flow.turn(summary(result), queryToken=old).status_code == 400
    assert flow.turn(summary(result)).status_code == 200


def test_failed_sam_consumes_photos_and_closes_token(live_client):
    with live_client(segment_live_replies(httpx.ReadTimeout('private provider data'))) as (client, requests):
        flow = live_flow(client).to_extract()
        response = flow.segment()
        assert response.status_code == 504
        state = client.app.state.tokens.verify(response.headers['X-Query-Token'],
            pseudonym(client.app.state.settings.hmac_secret, 'search-test-user'))
        assert state.samPhotos == 1 and state.sparkTurns == 3 and state.closed
        assert 'private provider data' not in response.text
        assert len(requests) == 4


def test_zero_candidates_success(live_client):
    with live_client(segment_live_replies(provider_text(''))) as (client, requests):
        response = live_flow(client).to_extract().segment()
        assert response.status_code == 200
        assert response.json()['photos'] == [{'photoRef': 'photo_blue_1', 'candidates': []}]


def test_low_score_candidates_not_filtered(live_client):
    with live_client(segment_live_replies(provider_text(sam_text()))) as (client, requests):
        response = live_flow(client).to_extract().segment()
        assert response.status_code == 200
        values = response.json()['photos'][0]['candidates']
        assert [v['score'] for v in values] == [0.9, 0.9, 0.01]
        assert [v['id'] for v in values] == ['1', '2', '0']
        payload = json.loads(requests[-1].content)
        assert payload['metadata'] == {'include_confidence': 'true', 'mask_encoding': 'one_bit'}
        assert payload['store'] is False and payload['tools'] == []


def test_binary_masks_bbox_and_order_match_schema(live_client):
    with live_client(segment_live_replies(provider_text(sam_text()))) as (client, requests):
        response = live_flow(client).to_extract().segment()
        assert response.status_code == 200
        candidate = response.json()['photos'][0]['candidates'][0]
        assert candidate['bbox'] == [0, 0, 5, 5]
        with Image.open(io.BytesIO(base64.b64decode(candidate['mask']['data']))) as mask:
            assert mask.mode == 'L' and mask.size == (5, 5)
            assert set(mask.getdata()) == {0, 255}


@pytest.mark.parametrize('text', [sam_text().replace('w=5', 'w=6'), sam_text().replace('c=0.01', 'c=2'),
    sam_text().replace('data=5,5', 'data=99999999,99999999'), sam_text().replace('<0f>', '<1f>'),
    sam_text() + ',bad', 'ordinary prose', '<0f>'])
def test_malformed_sam_is_batch_failure(live_client, text):
    with live_client(segment_live_replies(provider_text(text))) as (client, requests):
        response = live_flow(client).to_extract().segment()
        assert response.status_code == 502
        assert 'X-Query-Token' in response.headers
        assert 'photos' not in response.json()


def test_mock_mask_resolution_cannot_differ_from_upload(client, fixtures):
    flow = Flow(client).to_extract()
    bad = candidates()
    bad[0]['mask'] = image(6, 6, 255, mask=True)
    fixture(fixtures, 'normal', 'search-segment', 1, {'concept': 'a blue jacket'},
            {'photos': [{'photoRef': 'photo_blue_1', 'candidates': bad}]}, match=['/concept'])
    response = flow.segment()
    assert response.status_code == 500
    assert response.json()['error']['code'] == 'fixture_invalid'


def test_mask_crop_placed_at_inclusive_box_origin(live_client):
    text = sam_text((0.7,)).replace('x1=0;y1=0;x2=4;y2=4;w=5;h=5', 'x1=2;y1=1;x2=6;y2=5;w=8;h=7')
    with live_client(segment_live_replies(provider_text(text))) as (client, requests):
        flow = live_flow(client).to_extract()
        response = flow.segment(photos=[{'photoRef': 'photo_blue_1', 'image': image(8, 7)}])
        assert response.status_code == 200
        candidate = response.json()['photos'][0]['candidates'][0]
        assert candidate['bbox'] == [2, 1, 5, 5]
        with Image.open(io.BytesIO(base64.b64decode(candidate['mask']['data']))) as mask:
            assert mask.size == (8, 7)
            assert mask.crop((0, 0, 2, 7)).getbbox() is None
            assert mask.crop((7, 0, 8, 7)).getbbox() is None
            assert mask.crop((2, 1, 7, 6)).getbbox() is not None


def test_partial_sam_failure_returns_no_successful_photo(live_client):
    replies = [provider_call('list_visits', {}, 'p1'), provider_call('find_photos', {'phrase': 'a blue jacket'}, 'p2'),
               provider_call('extract_items', {'photoRefs': ['photo_blue_1', 'photo_blue_2'], 'concept': 'a blue jacket'}, 'p3'),
               provider_text(sam_text()), httpx.ReadTimeout('second photo failed')]
    with live_client(replies) as (client, requests):
        flow = live_flow(client).to_extract(refs=['photo_blue_1', 'photo_blue_2'])
        response = flow.segment()
        assert response.status_code == 504 and 'photos' not in response.json()
        state = client.app.state.tokens.verify(response.headers['X-Query-Token'],
            pseudonym(client.app.state.settings.hmac_secret, 'search-test-user'))
        assert state.samPhotos == 2 and state.closed
        assert len(requests) == 5


def test_unrotated_exif_upload_rejected_before_sam(client):
    flow = Flow(client).to_extract()
    buffer = io.BytesIO()
    exif = Image.Exif()
    exif[274] = 6
    Image.new('RGB', (5, 5)).save(buffer, format='JPEG', exif=exif)
    upload = {'mimeType': 'image/jpeg', 'data': base64.b64encode(buffer.getvalue()).decode(), 'width': 5, 'height': 5}
    response = flow.segment(photos=[{'photoRef': 'photo_blue_1', 'image': upload}])
    assert response.status_code == 400
    assert 'X-Query-Token' not in response.headers
