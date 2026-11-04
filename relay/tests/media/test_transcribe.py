import base64
import struct

import httpx
import pytest

from .conftest import audio


def test_15_seconds_allowed_16_rejected_before_provider(provider):
    client, calls = provider({'transcript': 'Find the blue coat.'})
    assert client.post('/v1/transcribe', json=audio(240000)).status_code == 200
    assert client.post('/v1/transcribe', json=audio(256000)).status_code == 400
    assert len(calls) == 1


@pytest.mark.parametrize('body', [audio(0), audio(240001), audio(rate=24000), audio(channels=2),
                                  audio(bits=8), audio(extra=b'LIST' + struct.pack('<I', 4) + b'GPS!')])
def test_real_sample_count_wav_format_and_metadata_validated(provider, body):
    client, calls = provider({'transcript': 'unused'})
    assert client.post('/v1/transcribe', json=body).json()['error']['code'] == 'invalid_request'
    assert not calls


@pytest.mark.parametrize('text', ['', '  ', '  Find the café-blue coat?\n'])
def test_english_transcript_preserved_verbatim(provider, text):
    client, calls = provider({'transcript': text, 'turns': [], 'audioDurationMs': 10})
    response = client.post('/v1/transcribe', json=audio())
    assert response.status_code == 200
    assert response.json() == {'text': text, 'language': 'en'}
    wire = calls[0].content
    assert b'"languageBias": ["English"]' in wire
    assert b'"mode": "PUSH_TO_TALK"' in wire
    assert b'"audioEncoding": "WAV"' in wire
    assert b'store' not in wire and b'safety_identifier' not in wire
    assert base64.b64decode(audio()['audio']['data']) in wire


def test_audio_size_limit_413(provider):
    client, calls = provider({'transcript': ''})
    assert client.post('/v1/transcribe', json=audio(262145)).status_code == 413
    assert not calls


@pytest.mark.parametrize('body', [{}, {'transcript': None}, {'transcript': 3}, {'transcript': 'a' * 2001}])
def test_invalid_output_is_error_not_empty_transcript(provider, body):
    client, calls = provider(body)
    response = client.post('/v1/transcribe', json=audio())
    assert response.status_code == 502
    assert response.json()['error']['code'] == 'upstream_error'
    assert len(calls) == 1


@pytest.mark.parametrize('status,body,expected,retryable', [
    (400, {'error': {'code': 'content_policy_violation'}}, 400, False),
    (401, {}, 502, False), (403, {}, 502, False), (429, {}, 429, True), (503, {}, 502, True)])
def test_provider_errors_preserve_retryability(provider, status, body, expected, retryable):
    client, calls = provider(body, status, {'Retry-After': '4'})
    response = client.post('/v1/transcribe', json=audio())
    assert response.status_code == expected
    assert response.json()['error']['retryable'] is retryable
    assert len(calls) == 1
    if expected == 429:
        assert response.headers['Retry-After'] == '4'


def test_timeout_no_retry(provider):
    client, calls = provider(exception=httpx.ReadTimeout('private upstream body'))
    response = client.post('/v1/transcribe', json=audio())
    assert response.status_code == 504
    assert len(calls) == 1
    assert 'private' not in response.text
