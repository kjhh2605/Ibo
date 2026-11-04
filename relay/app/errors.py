"""Safe public errors and an auth-first, memory-only ASGI boundary."""
from __future__ import annotations

import json
import time

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.requests import Request

from app.schemas import PayloadTooLarge

ERRORS = {
    'unauthenticated': (401, 'Authentication required.', False),
    'app_check_failed': (403, 'App verification failed.', False),
    'invalid_request': (400, 'Invalid request.', False),
    'payload_too_large': (413, 'Payload too large.', False),
    'invalid_query_token': (401, 'Invalid query token.', False),
    'query_token_expired': (401, 'Query token expired.', False),
    'query_closed': (409, 'This query has ended.', False),
    'turn_limit_exceeded': (409, 'Search turn limit reached.', False),
    'photo_limit_exceeded': (409, 'Search photo limit reached.', False),
    'content_policy_violation': (400, 'The request was blocked by content policy.', False),
    'upstream_rate_limited': (429, 'The provider is busy. Try again later.', True),
    'upstream_timeout': (504, 'The provider timed out.', True),
    'upstream_error': (502, 'The provider could not complete the request.', True),
    'model_unavailable': (503, 'The model is unavailable.', False),
    'route_unavailable': (404, 'No walking route is available.', False),
    'fixture_not_found': (501, 'No fixture is available.', False),
    'fixture_request_mismatch': (409, 'Fixture request mismatch.', False),
    'fixture_invalid': (500, 'Invalid fixture definition.', False),
    'internal_error': (500, 'The request could not be completed.', False),
    'not_found': (404, 'Endpoint not found.', False),
    'method_not_allowed': (405, 'Method not allowed.', False),
}


class RelayError(Exception):
    def __init__(self, code: str, *, retryable: bool | None = None, pointer: str | None = None):
        self.code = code
        self.status, self.message, default_retry = ERRORS[code]
        self.retryable = default_retry if retryable is None else retryable
        if code == 'fixture_request_mismatch' and pointer is not None:
            self.message = 'Fixture request mismatch at ' + pointer[:220]
        self.headers: dict[str, str] = {}
        super().__init__(code)  # Exception rendering never includes provider/input data.

    def response(self):
        return JSONResponse(status_code=self.status, content={'error': {
            'code': self.code, 'message': self.message, 'retryable': self.retryable,
        }}, headers={**self.headers, 'Cache-Control': 'no-store'})


def validation_failure(exc: RequestValidationError) -> RelayError:
    too_large = any(isinstance(e.get('ctx', {}).get('error'), PayloadTooLarge) or
                    (e['type'] in ('string_too_long', 'less_than_equal') and
                     any(p in ('data', 'width', 'height') for p in e['loc']))
                    for e in exc.errors())
    return RelayError('payload_too_large' if too_large else 'invalid_request')


def install_error_handlers(app):
    async def relay_error(request, exc):
        return exc.response()

    async def validation_error(request, exc):
        return validation_failure(exc).response()

    async def http_error(request, exc):
        code = {404: 'not_found', 405: 'method_not_allowed'}.get(exc.status_code, 'invalid_request')
        return RelayError(code).response()

    app.add_exception_handler(RelayError, relay_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(HTTPException, http_error)


BODY_LIMITS = {
    '/v1/search/turn': 16 * 1048576, '/v1/search/segment': 20 * 1048576,
    '/v1/transcribe': 1048576, '/v1/describe/storefront': 7 * 1048576,
    '/v1/describe/piece': 7 * 1048576, '/v1/tryon': 44 * 1048576,
    '/v1/route': 4096,
}


def strict_json(data):
    def object_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('Duplicate JSON key')
            result[key] = value
        return result

    def invalid_number(value):
        raise ValueError('Non-finite JSON number')

    return json.loads(data, object_pairs_hook=object_pairs, parse_constant=invalid_number)


class CoreBoundary:
    """Install before outer CORS; authenticate before reading any endpoint body."""
    def __init__(self, app, *, authenticator, settings):
        self.app, self.authenticator, self.settings = app, authenticator, settings

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        from app.logging import log_request
        from app.mock import fixture_scenario
        start, status, started = time.monotonic(), 500, False
        state = scope.setdefault('state', {})
        body = bytearray()

        async def safe_send(message):
            nonlocal status, started
            if message['type'] == 'http.response.start':
                started, status = True, message['status']
                headers = [(k, v) for k, v in message.get('headers', []) if k.lower() != b'cache-control']
                message = {**message, 'headers': [*headers, (b'cache-control', b'no-store')]}
            await send(message)

        try:
            if scope['method'] == 'POST' and scope['path'] in BODY_LIMITS:
                request = Request(scope)
                state['principal'] = await self.authenticator.authenticate(request.headers)
                state['fixture_scenario'] = fixture_scenario(self.settings.mode, request.headers.get('x-sf-fixture'))
                if request.headers.get('content-encoding', 'identity').lower() != 'identity':
                    raise RelayError('invalid_request')
                content_type = request.headers.get('content-type', '').lower().replace(' ', '')
                if content_type not in ('application/json', 'application/json;charset=utf-8'):
                    raise RelayError('invalid_request')
                limit = BODY_LIMITS[scope['path']]
                while True:
                    chunk = await receive()
                    if chunk['type'] == 'http.disconnect':
                        return
                    if chunk['type'] != 'http.request':
                        raise RelayError('invalid_request')
                    data = chunk.get('body', b'')
                    if len(body) + len(data) > limit:
                        raise RelayError('payload_too_large')
                    body.extend(data)
                    if not chunk.get('more_body', False):
                        break
                try:
                    parsed = strict_json(body.decode('utf-8'))
                    if not isinstance(parsed, dict):
                        raise ValueError('Object required')
                    if 'queryToken' in parsed and scope['path'] in ('/v1/search/turn', '/v1/search/segment'):
                        tokens = scope['app'].state.tokens
                        query_state = tokens.verify(parsed['queryToken'], state['principal'].sub,
                                                    scenario=state['fixture_scenario'])
                        if scope['path'] == '/v1/search/turn':
                            tokens.check_turn(query_state)
                        elif query_state.closed:
                            raise RelayError('query_closed')
                        state['spark_turns'] = query_state.sparkTurns
                    del parsed
                except (ValueError, UnicodeError, RecursionError):
                    raise RelayError('invalid_request') from None
                delivered = False

                async def replay():
                    nonlocal delivered
                    if not delivered:
                        delivered = True
                        return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
                    return await receive()

                await self.app(scope, replay, safe_send)
            else:
                await self.app(scope, receive, safe_send)
        except RelayError as exc:
            if not started:
                await exc.response()(scope, receive, safe_send)
        except Exception:
            if not started:
                await RelayError('internal_error').response()(scope, receive, safe_send)
        finally:
            body.clear()
            principal = state.get('principal')
            log_request(endpoint=scope['path'], pseudonymous_id=principal.sub if principal else None,
                        latency_ms=(time.monotonic() - start) * 1000, status_code=status,
                        spark_turns=state.get('spark_turns'))
