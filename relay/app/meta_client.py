"""Fixed destinations/models, total deadlines, zero retries, no payload logging.

Endpoint owners build provider payloads from validated DTOs and server prompts.
This module never accepts a URL/model supplied by an HTTP caller.
Sources: https://dev.meta.ai/docs/overview and /docs/image-generation,
/docs/speech-to-text (2026-11-04). Dedicated Voice supports no safety/store field.
"""
from __future__ import annotations

import asyncio
import json
import re
from contextlib import asynccontextmanager
from enum import Enum

import httpx

from app.errors import RelayError, strict_json


class Operation(Enum):
    SPARK = 'spark'
    SAM = 'sam'
    VOICE = 'voice'
    IMAGE = 'image'
    OSRM = 'osrm'


DEADLINES = {Operation.SPARK: 60, Operation.SAM: 90, Operation.VOICE: 30,
             Operation.IMAGE: 180, Operation.OSRM: 15}
MODELS = {Operation.SPARK: 'muse-spark-1.3', Operation.SAM: 'sam-3.1',
          Operation.VOICE: 'muse-voice-transcribe-1.0', Operation.IMAGE: 'muse-image-1.0'}
META_HOST = 'https://api.meta.ai'
OSRM_HOST = 'https://routing.openstreetmap.de'


@asynccontextmanager
async def deadline(operation: Operation):
    """Use around the entire SAM batch / OSRM scheduling wait, not each photo."""
    try:
        async with asyncio.timeout(DEADLINES[operation]):
            yield
    except (TimeoutError, httpx.TimeoutException):
        raise RelayError('upstream_timeout') from None


def provider_error(status: int, body, retry_after=None):
    error = body.get('error', {}) if isinstance(body, dict) else {}
    policy = isinstance(error, dict) and error.get('code') == 'content_policy_violation'
    if status == 400 and policy:
        return RelayError('content_policy_violation')
    if status == 429:
        result = RelayError('upstream_rate_limited')
        if isinstance(retry_after, str) and re.fullmatch('[0-9]{1,6}', retry_after):
            result.headers['Retry-After'] = str(int(retry_after))
        return result
    return RelayError('upstream_error', retryable=status >= 500)


class MetaClient:
    def __init__(self, settings, *, transport=None):
        self.settings = settings
        self.client = httpx.AsyncClient(transport=transport or httpx.AsyncHTTPTransport(retries=0),
                                       follow_redirects=False, trust_env=False)

    async def aclose(self):
        await self.client.aclose()

    def _responses_payload(self, operation, payload, sub):
        if not isinstance(sub, str) or not re.fullmatch('[0-9a-f]{64}', sub):
            raise ValueError('A pseudonymous safety identifier is required')
        allowed = {'input', 'instructions', 'tools', 'tool_choice', 'parallel_tool_calls', 'text', 'reasoning', 'max_output_tokens'}
        if operation == Operation.SAM:
            allowed.add('metadata')
        if set(payload) - allowed:
            raise ValueError('Unsupported Responses fields')
        tools = payload.get('tools', [])
        if operation == Operation.SPARK:
            names = []
            for tool in tools:
                if (tool.get('type') != 'function' or tool.get('name') not in ('list_visits', 'find_photos', 'extract_items') or
                    set(tool) - {'type', 'name', 'description', 'parameters', 'strict'}):
                    raise ValueError('Unsupported tool')
                names.append(tool['name'])
            if len(set(names)) != len(names):
                raise ValueError('Duplicate tools')
        elif operation == Operation.SAM:
            if tools:
                raise ValueError('SAM has no tools')
            metadata = {'include_confidence': 'true', 'mask_encoding': 'one_bit'}
            if 'metadata' in payload and payload['metadata'] != metadata:
                raise ValueError('Unsupported SAM metadata')
            payload = {**payload, 'metadata': metadata}
        else:
            raise ValueError('Not a Responses operation')
        return {**payload, 'model': MODELS[operation], 'store': False,
                'safety_identifier': sub, 'tools': tools}

    async def responses(self, operation: Operation, payload: dict, *, sub: str):
        body = self._responses_payload(operation, payload, sub)
        return await self._send(operation, 'POST', META_HOST + '/v1/responses', json_body=body)

    async def edit_image(self, images, *, prompt, size, sub: str):
        """One stateless Muse edit; the deployed Responses image tool rejects tools.

        The official images endpoint has equivalent tool controls and a `user`
        safety identifier. It has no documented `store`/`safety_identifier` fields.
        Do not fall back to a tool-enabled request or fetch provider result URLs.
        """
        if not isinstance(sub, str) or not re.fullmatch('[0-9a-f]{64}', sub):
            raise ValueError('A pseudonymous safety identifier is required')
        body = {'model': MODELS[Operation.IMAGE], 'prompt': prompt, 'images': images,
                'n': 1, 'size': size, 'output_format': 'png', 'response_format': 'b64_json',
                'user': sub, 'reasoning_strength': 'low',
                'tool_enablement': {'enable_image_search': False, 'enable_web_search': False, 'enable_shell': False}}
        return await self._send(Operation.IMAGE, 'POST', META_HOST + '/v1/images/edits', json_body=body)

    async def transcribe(self, audio: bytes):
        # In-memory multipart for the provider only; public relay input remains JSON.
        request = {'model': MODELS[Operation.VOICE], 'mode': 'PUSH_TO_TALK',
                   'audioEncoding': 'WAV', 'languageBias': ['English']}
        return await self._send(Operation.VOICE, 'POST', META_HOST + '/v1/asr/transcribe',
                                files={'request': (None, json.dumps(request), 'application/json'),
                                       'audio': ('audio.wav', audio, 'audio/wav')})

    async def route(self, origin, destination):
        from app.schemas import Point
        origin, destination = Point.model_validate(origin), Point.model_validate(destination)
        path = f'/routed-foot/route/v1/driving/{origin.lng},{origin.lat};{destination.lng},{destination.lat}'
        return await self._send(Operation.OSRM, 'GET', OSRM_HOST + path,
                                params={'overview': 'full', 'geometries': 'geojson', 'steps': 'true', 'alternatives': 'false'})

    async def _send(self, operation, method, url, *, json_body=None, files=None, params=None):
        if self.settings.mode != 'live':
            raise RelayError('fixture_not_found')  # Never accidentally call a provider in mock.
        headers = {'Accept': 'application/json'}
        if operation != Operation.OSRM:
            headers['Authorization'] = 'Bearer ' + self.settings.model_api_key
        else:
            headers['User-Agent'] = 'StreetFitting/0.1 (+https://github.com/kjhh2605/Meta-Hackathon)'
        buffer = bytearray()
        try:
            async with deadline(operation):
                async with self.client.stream(method, url, json=json_body, files=files, params=params,
                                              headers=headers, timeout=DEADLINES[operation]) as response:
                    # A corrupt/hostile upstream cannot grow process memory indefinitely.
                    limit = 128 * 1048576 if operation in (Operation.SAM, Operation.IMAGE) else 16 * 1048576
                    async for chunk in response.aiter_bytes():
                        if len(buffer) + len(chunk) > limit:
                            raise RelayError('upstream_error')
                        buffer.extend(chunk)
                    try:
                        body = strict_json(buffer)
                    except (ValueError, UnicodeError, RecursionError):
                        body = None
                    if operation == Operation.OSRM and response.status_code in (200, 400) and isinstance(body, dict) and body.get('code') in ('NoRoute', 'NoSegment'):
                        raise RelayError('route_unavailable')
                    if not 200 <= response.status_code < 300:
                        raise provider_error(response.status_code, body, response.headers.get('retry-after'))
                    if not isinstance(body, dict):
                        raise RelayError('upstream_error')
                    if body.get('status') in ('failed', 'incomplete'):
                        error = body.get('error') or body.get('incomplete_details') or {}
                        if isinstance(error, dict) and (error.get('code') == 'content_policy_violation' or error.get('reason') == 'content_filter'):
                            raise RelayError('content_policy_violation')
                        raise RelayError('upstream_error')
                    return body
        except httpx.TimeoutException:
            raise RelayError('upstream_timeout') from None
        except httpx.HTTPError:
            raise RelayError('upstream_error') from None
        finally:
            buffer.clear()
