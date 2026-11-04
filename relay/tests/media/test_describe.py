import json

import pytest

from .conftest import image, text_output


def test_storefront_one_image_and_short_english_description(provider):
    expected = {'description': 'A blue awning above a narrow brick entrance.'}
    client, calls = provider(text_output(expected))
    response = client.post('/v1/describe/storefront', json={'image': image()})
    assert response.status_code == 200
    assert response.json() == expected
    wire = json.loads(calls[0].content)
    assert wire['model'] == 'muse-spark-1.3'
    assert wire['tools'] == [] and wire['store'] is False
    assert [part['type'] for part in wire['input'][0]['content']] == ['input_image']
    assert wire['text']['format']['schema']['additionalProperties'] is False


def test_wardrobe_and_direct_shop_cutouts_share_request_schema(provider):
    expected = {'label': 'Blue coat', 'category': 'outer'}
    client, calls = provider(text_output(expected))
    for color in (10, 200):
        response = client.post('/v1/describe/piece', json={'image': image(color)})
        assert response.status_code == 200
        assert response.json() == expected
    assert len(calls) == 2
    assert json.loads(calls[0].content)['instructions'] == json.loads(calls[1].content)['instructions']


@pytest.mark.parametrize('extra', [{'origin': 'shop'}, {'tripPhoto': image()},
                                   {'coordinates': {'lat': 1, 'lng': 2}}, {'images': [image(), image()]}])
def test_origin_trip_photo_and_coordinates_not_accepted(provider, extra):
    client, calls = provider(text_output({'label': 'coat', 'category': 'outer'}))
    assert client.post('/v1/describe/piece', json={'image': image(), **extra}).status_code == 400
    assert not calls


@pytest.mark.parametrize('path,body', [
    ('piece', {'label': '', 'category': 'outer'}), ('piece', {'label': 'a' * 121, 'category': 'outer'}),
    ('piece', {'label': 'coat', 'category': 'a' * 65}), ('piece', {'label': 'coat', 'category': ' '}),
    ('piece', {'label': 'coat', 'category': 'jacket'}), ('piece', {'label': 'coat', 'category': 'unknown'}),
    ('piece', {'label': 'coat', 'category': 'outer', 'origin': 'shop'}),
    ('storefront', {'description': ' '}), ('storefront', {'description': 'a' * 301})])
def test_empty_or_oversize_labels_rejected(provider, path, body):
    client, calls = provider(text_output(body))
    assert client.post('/v1/describe/' + path, json={'image': image()}).status_code == 502
    assert len(calls) == 1


@pytest.mark.parametrize('output,expected', [
    ({'status': 'completed', 'output': [{'type': 'message', 'role': 'assistant',
      'content': [{'type': 'refusal', 'refusal': 'private policy message'}]}]}, 400),
    ({'status': 'completed', 'output': [{'type': 'function_call', 'name': 'web_search'}]}, 502),
    ({'status': 'incomplete', 'output': []}, 502),
    ({'status': 'completed', 'output': []}, 502),
    ({'status': 'completed', 'output': [{'type': 'message', 'role': 'assistant',
      'content': [{'type': 'output_text', 'text': '{"label":"a","label":"b","category":"coat"}'}]}]}, 502)])
def test_refusal_and_malformed_outputs_not_success(provider, output, expected):
    client, _ = provider(output)
    response = client.post('/v1/describe/piece', json={'image': image()})
    assert response.status_code == expected
    assert 'private policy message' not in response.text
