import asyncio
from dataclasses import replace

import httpx
import pytest

from app.errors import RelayError
from app.meta_client import DEADLINES, MetaClient, Operation


def exercise(settings, handler):
    async def run():
        client = MetaClient(replace(settings, mode='live', mock_skip_auth=False, firebase_project_id='test',
                                   firebase_app_id='1:123:android:abc', model_api_key='private-key'),
                            transport=httpx.MockTransport(handler))
        try:
            return await client.responses(Operation.SPARK, {'input': 'coat'}, sub='a' * 64)
        finally:
            await client.aclose()
    return asyncio.run(run())


def failure(settings, status, body, headers=None):
    with pytest.raises(RelayError) as result:
        exercise(settings, lambda request: httpx.Response(status, json=body, headers=headers))
    error = result.value
    assert b'PRIVATE_PROVIDER_SENTINEL' not in error.response().body
    return error


def test_policy_400_false(settings):
    error = failure(settings, 400, {'error': {'code': 'content_policy_violation', 'message': 'PRIVATE_PROVIDER_SENTINEL'}})
    assert (error.code, error.status, error.retryable) == ('content_policy_violation', 400, False)


def test_rate_limit_429_safe_retry_after(settings):
    for value, expected in [('12', '12'), ('0001', '1'), ('PRIVATE_PROVIDER_SENTINEL', None), ('Wed, 04 Nov 2026', None), ('-1', None)]:
        error = failure(settings, 429, {'error': {'message': 'PRIVATE_PROVIDER_SENTINEL'}}, {'Retry-After': value})
        assert (error.status, error.retryable) == (429, True)
        assert error.headers.get('Retry-After') == expected


def test_provider_credentials_502_not_client_401(settings):
    for status in (401, 403):
        error = failure(settings, status, {'error': {'message': 'PRIVATE_PROVIDER_SENTINEL'}})
        assert (error.code, error.status, error.retryable) == ('upstream_error', 502, False)


def test_timeout_504(settings, monkeypatch):
    monkeypatch.setitem(DEADLINES, Operation.SPARK, 0.01)
    cancelled = []
    async def slow(request):
        try:
            await asyncio.sleep(10)
        finally:
            cancelled.append(True)
    with pytest.raises(RelayError) as result:
        exercise(settings, slow)
    assert result.value.status == 504 and result.value.retryable
    assert cancelled == [True]


def test_bad_response_502(settings):
    for response in [httpx.Response(200, text='PRIVATE_PROVIDER_SENTINEL'), httpx.Response(200, json=[]),
                     httpx.Response(302, headers={'Location': 'https://private.invalid'}),
                     httpx.Response(200, content=b'{"x":NaN}'),
                     httpx.Response(200, json={'status': 'incomplete'})]:
        with pytest.raises(RelayError) as error:
            exercise(settings, lambda request: response)
        assert error.value.code == 'upstream_error' and error.value.status == 502


def test_no_automatic_retry(settings):
    attempts = []
    def failed(request):
        attempts.append(request.url.host)
        raise httpx.ConnectError('PRIVATE_PROVIDER_SENTINEL')
    with pytest.raises(RelayError):
        exercise(settings, failed)
    assert attempts == ['api.meta.ai']
    for status in (429, 500, 503):
        attempts.clear()
        def unavailable(request):
            attempts.append(request.url.host)
            return httpx.Response(status)
        with pytest.raises(RelayError):
            exercise(settings, unavailable)
        assert attempts == ['api.meta.ai']


def test_only_allowlisted_tools_and_models(settings):
    client = MetaClient(settings)
    for payload in [{'model': 'other', 'input': 'coat'}, {'url': 'https://private.invalid'},
                    {'input': 'coat', 'tools': [{'type': 'web_search'}]},
                    {'input': 'coat', 'tools': [{'type': 'function', 'name': 'execute_shell'}]}]:
        with pytest.raises(ValueError):
            client._responses_payload(Operation.SPARK, payload, 'a' * 64)
    with pytest.raises(ValueError):
        client._responses_payload(Operation.IMAGE, {'input': 'coat'}, 'a' * 64)
    asyncio.run(client.aclose())
