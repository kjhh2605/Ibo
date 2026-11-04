import builtins
import json
import logging
import tempfile

import pytest

from .harness import provider_call, provider_text, sam_text, summary, visits
from .test_segment import segment_live_replies
from .test_turn import live_flow


@pytest.mark.parametrize('log_text', [False, True])
def test_spark_history_has_no_images_coordinates_masks_or_vectors(live_client, caplog, log_text):
    replies = segment_live_replies(provider_text(sam_text()), provider_text(json.dumps({'final': {
        'photoRefs': ['photo_blue_1'], 'concept': 'a blue jacket', 'summary': 'Check this photo.'}})))
    with live_client(replies, log_text) as (client, requests):
        caplog.set_level(logging.DEBUG)
        flow = live_flow(client).to_extract()
        segmented = flow.segment()
        assert segmented.status_code == 200
        assert flow.turn(summary(segmented)).status_code == 200
        spark = [json.loads(r.content) for r in requests if json.loads(r.content)['model'] == 'muse-spark-1.3']
        # Check only structured input, not policy prose describing forbidden fields.
        serialized = json.dumps([p['input'] for p in spark])
        for forbidden in ['input_image', 'data:image', 'phraseVector', 'bbox', 'latitude', 'longitude', 'queryToken', '"mask"']:
            assert forbidden not in serialized
        assert 'vintage' in serialized  # notes are tool-result DATA, not instructions
        assert 'candidateCount' in serialized
        assert 'data:image' not in caplog.text
        assert segmented.json()['photos'][0]['candidates'][0]['mask']['data'] not in caplog.text
        assert flow.token not in caplog.text
        assert 'synthetic-not-real' not in caplog.text
        assert 'search-test-user' not in caplog.text


def test_phrase_vector_only_leaves_toward_device(live_client):
    replies = [provider_call('list_visits', {}, 'c1'), provider_call('find_photos', {'phrase': 'a blue jacket'}, 'c2')]
    with live_client(replies) as (client, requests):
        flow = live_flow(client)
        assert flow.turn().status_code == 200
        response = flow.turn(visits())
        assert response.status_code == 200
        assert len(response.json()['toolCalls'][0]['phraseVector']) == 512
        from app.auth import pseudonym
        state = client.app.state.tokens.verify(flow.token, pseudonym(client.app.state.settings.hmac_secret, 'search-test-user'))
        assert 'phraseVector' not in json.dumps(state.model_dump())
        assert all('phraseVector' not in r.content.decode() for r in requests)


@pytest.mark.parametrize('log_text', [False, True])
def test_segment_logs_never_contain_image_or_location(live_client, caplog, log_text):
    with live_client(segment_live_replies(provider_text(sam_text())), log_text) as (client, requests):
        caplog.set_level(logging.DEBUG)
        flow = live_flow(client).to_extract()
        from .harness import image
        photo = image()
        response = flow.segment(photos=[{'photoRef': 'photo_blue_1', 'image': photo}])
        assert response.status_code == 200
        assert photo['data'] not in caplog.text
        assert 'data:image' not in caplog.text
        # Structured locations cannot be smuggled in a photo request.
        before = len(requests)
        bad = flow.segment(photos=[{'photoRef': 'photo_blue_1', 'image': photo, 'location': {'lat': 37.123456, 'lng': 127.123456}}])
        assert bad.status_code == 400 and len(requests) == before
        assert '37.123456' not in caplog.text and '127.123456' not in caplog.text


def test_failed_upload_creates_no_temp_files(live_client, monkeypatch):
    replies = segment_live_replies(provider_text('not segmentation'))
    with live_client(replies) as (client, requests):
        flow = live_flow(client).to_extract()
        writes = []
        original_open = builtins.open
        def guarded_open(file, mode='r', *args, **kwargs):
            if any(c in mode for c in 'wax+'):
                writes.append(str(file))
                raise AssertionError('Request attempted file persistence')
            return original_open(file, mode, *args, **kwargs)
        def denied(*args, **kwargs):
            writes.append('temporary file')
            raise AssertionError('Request attempted temporary persistence')
        monkeypatch.setattr(builtins, 'open', guarded_open)
        monkeypatch.setattr(tempfile, 'NamedTemporaryFile', denied)
        monkeypatch.setattr(tempfile, 'TemporaryFile', denied)
        monkeypatch.setattr(tempfile, 'SpooledTemporaryFile', denied)
        response = flow.segment()
        assert response.status_code == 502
        assert writes == []
        assert len(requests) == 4
