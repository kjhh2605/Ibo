import asyncio
import base64
import json
import time
from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import Authenticator, pseudonym
from app.config import Settings
from app.errors import RelayError
from app.meta_client import MetaClient, Operation
from conftest import make_app


def test_invalid_signature_audience_issuer_uid_provider_rejected(firebase, image):
    settings, verifier, mint = firebase
    app = make_app(settings, verifier)
    with TestClient(app) as client:
        good = {'Authorization': 'Bearer ' + mint(), 'X-Firebase-AppCheck': mint('check')}
        assert client.post('/v1/describe/piece', headers=good, json={'image': image}).status_code == 200
        invalid = [mint(wrong_key=True), mint(algorithm='HS256'), mint(changes={'aud': 'elsewhere'}),
                   mint(changes={'iss': 'https://attacker.invalid'}), mint(changes={'sub': ''}),
                   mint(changes={'sub': 'x' * 129}), mint(changes={'exp': int(time.time()) - 1}),
                   mint(changes={'firebase': {'sign_in_provider': 'password'}})]
        for token in invalid:
            response = client.post('/v1/describe/piece', headers={**good, 'Authorization': 'Bearer ' + token}, json={'image': image})
            assert response.status_code == 401
            assert response.json()['error']['code'] == 'unauthenticated'
            assert token not in response.text
        # Authentication precedes invalid JSON/media, not merely header presence.
        response = client.post('/v1/describe/piece', headers={'Authorization': 'Bearer fake', 'Content-Type': 'application/json'}, content='not json')
        assert response.status_code == 401
    asyncio.run(app.state.meta.aclose())


def test_wrong_app_check_app_rejected(firebase):
    settings, verifier, mint = firebase
    auth = Authenticator(settings, verifier=verifier)
    for token in [mint('check', {'sub': '1:123:android:other'}), mint('check', {'aud': ['projects/456']}),
                  mint('check', {'iss': 'https://firebaseappcheck.googleapis.com/456'}),
                  mint('check', wrong_key=True), mint('check', {'exp': int(time.time()) - 1}), '']:
        with pytest.raises(RelayError) as error:
            asyncio.run(auth.authenticate({'authorization': 'Bearer ' + mint(), 'x-firebase-appcheck': token}))
        assert error.value.code == 'app_check_failed'


def test_live_skip_auth_fails_startup(settings):
    with pytest.raises(ValueError):
        replace(settings, mode='live', model_api_key='private-key')


def test_mock_skip_preserves_query_token_validation(client, context):
    response = client.post('/v1/search/turn', json={'query': 'coat', 'context': context})
    assert response.status_code == 200
    token = response.json()['queryToken']
    request = {'query': 'coat', 'queryToken': token + 'x', 'toolResults': [{'toolCallId': 'call', 'name': 'find_photos', 'result': []}]}
    response = client.post('/v1/search/turn', json=request)
    assert response.status_code == 401 and response.json()['error']['code'] == 'invalid_query_token'


def test_meta_receives_pseudonym_not_uid(firebase):
    settings, verifier, mint = firebase
    principal = asyncio.run(Authenticator(settings, verifier=verifier).authenticate({
        'authorization': 'Bearer ' + mint(), 'x-firebase-appcheck': mint('check')}))
    assert principal.sub == pseudonym(settings.hmac_secret, 'private-uid')
    requests = []
    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={'output': []})
    async def exercise():
        client = MetaClient(replace(settings, mode='live', model_api_key='provider-key'), transport=httpx.MockTransport(respond))
        await client.responses(Operation.SPARK, {'input': 'Find a coat.'}, sub=principal.sub)
        await client.aclose()
    asyncio.run(exercise())
    payload = json.loads(requests[0].content)
    assert payload['safety_identifier'] == principal.sub and payload['store'] is False
    assert b'private-uid' not in requests[0].content
    assert requests[0].url == 'https://api.meta.ai/v1/responses'


@pytest.mark.parametrize('patch', [
    {'RELAY_MODE': ''}, {'RELAY_MODE': 'unknown'}, {'RELAY_HMAC_SECRET': 'bad'},
    {'RELAY_HMAC_SECRET': base64.b64encode(b'short').decode()}, {'PORT': '0'}, {'PORT': '65536'},
    {'RELAY_MOCK_SKIP_AUTH': 'yes'}, {'RELAY_LOG_TEXT': 'true'},
])
def test_invalid_configuration_rejected_without_secrets(patch):
    values = {'RELAY_MODE': 'mock', 'RELAY_MOCK_SKIP_AUTH': '1', 'RELAY_HMAC_SECRET': base64.b64encode(b'x' * 32).decode(), **patch}
    with pytest.raises(ValueError) as error:
        Settings.from_env(values)
    assert values['RELAY_HMAC_SECRET'] not in str(error.value)
