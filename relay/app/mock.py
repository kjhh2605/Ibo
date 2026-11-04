"""Strict, memory-only replay. Fixture data cannot relax runtime validation."""
from __future__ import annotations

import base64
import copy
import re
from dataclasses import dataclass
from pathlib import Path

from pydantic import TypeAdapter, ValidationError

from app import schemas as s
from app.errors import ERRORS, RelayError, strict_json, validation_failure

OPERATIONS = {
    'search-turn': (s.SearchTurnRequest, s.SearchTurnResponse),
    'search-segment': (s.SearchSegmentRequest, s.SearchSegmentResponse),
    'transcribe': (s.TranscribeRequest, s.TranscribeResponse),
    'describe-storefront': (s.DescribeRequest, s.StorefrontResponse),
    'describe-piece': (s.DescribeRequest, s.PieceResponse),
    'tryon': (s.TryOnRequest, s.TryOnResponse),
    'route': (s.RouteRequest, s.RouteResponse),
}
REF_FIELDS = {'photoRef', 'shopRef', 'tripRef', 'pieceRef', 'toolCallId', 'id', 'photoRefs', 'shopRefs', 'pieceRefs'}


def fixture_scenario(mode, header):
    if mode == 'live':
        if header is not None:
            raise RelayError('invalid_request')
        return None
    value = 'normal' if header is None else header
    if not isinstance(value, str) or not re.fullmatch('[a-z0-9-]{1,64}', value):
        raise RelayError('invalid_request')
    return value


def pointer_parts(pointer):
    if not isinstance(pointer, str) or (pointer and not pointer.startswith('/')) or re.search('~(?![01])', pointer):
        raise ValueError('Invalid pointer')
    return tuple(p.replace('~1', '/').replace('~0', '~') for p in pointer.split('/')[1:]) if pointer else ()


def lookup(value, parts):
    for part in parts:
        if isinstance(value, list):
            if not re.fullmatch('0|[1-9][0-9]*', part):
                raise KeyError(part)
            value = value[int(part)]
        elif isinstance(value, dict):
            value = value[part]
        else:
            raise KeyError(part)
    return value


def _mismatch(actual, expected, path, ignored):
    if path in ignored:
        return None
    if type(actual) is not type(expected):
        return path
    if isinstance(expected, dict):
        keys_a = {k for k in actual if (*path, k) not in ignored}
        keys_e = {k for k in expected if (*path, k) not in ignored}
        for key in sorted(keys_a | keys_e, key=lambda k: k.replace('~', '~0').replace('/', '~1')):
            child = (*path, key)
            if key not in keys_a or key not in keys_e:
                return child
            mismatch = _mismatch(actual[key], expected[key], child, ignored)
            if mismatch is not None:
                return mismatch
        return None
    if isinstance(expected, list):
        if len(actual) != len(expected):
            return path
        for i in sorted(range(len(expected)), key=str):
            mismatch = _mismatch(actual[i], expected[i], (*path, str(i)), ignored)
            if mismatch is not None:
                return mismatch
        return None
    return None if actual == expected else path


def _ref_path(parts):
    return bool(parts) and (parts[-1] in REF_FIELDS or len(parts) >= 2 and parts[-1].isdigit() and parts[-2] in REF_FIELDS)


def _echo_path(expression):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9]*(?:(?:\.[A-Za-z][A-Za-z0-9]*)|(?:\[(?:0|[1-9][0-9]*)\]))*', expression):
        raise ValueError('Invalid echo')
    return tuple(re.findall('[A-Za-z][A-Za-z0-9]*|[0-9]+', expression))


def _resolve(value, request, directory, path=()):
    if isinstance(value, dict):
        if 'queryToken' in value:
            raise ValueError('Fixture tokens are forbidden')
        if 'asset' in value:
            if set(value) != {'asset'} or not path or path[-1] != 'data' or not isinstance(value['asset'], str):
                raise ValueError('Invalid asset')
            relative = Path(value['asset'])
            if relative.is_absolute() or '..' in relative.parts or not relative.parts or relative.parts[0] != 'assets':
                raise ValueError('Invalid asset path')
            file = (directory / relative).resolve()
            if not file.is_relative_to(directory.resolve()) or not file.is_file() or file.stat().st_size > 32 * 1048576:
                raise ValueError('Invalid asset path')
            return base64.b64encode(file.read_bytes()).decode()
        return {key: _resolve(child, request, directory, (*path, key)) for key, child in value.items()}
    if isinstance(value, list):
        return [_resolve(child, request, directory, (*path, str(i))) for i, child in enumerate(value)]
    if isinstance(value, str) and ('{{' in value or '}}' in value):
        if not value.startswith('{{') or not value.endswith('}}') or not _ref_path(path):
            raise ValueError('Invalid echo destination')
        parts = _echo_path(value[2:-2])
        if not _ref_path(parts):
            raise ValueError('Invalid echo source')
        result = lookup(request, parts)
        if not isinstance(result, (str, list)) or isinstance(result, list) and not all(isinstance(v, str) for v in result):
            raise ValueError('Invalid echo value')
        return copy.deepcopy(result)
    return value


@dataclass(frozen=True)
class Replay:
    operation: str
    body: dict
    error: RelayError | None = None

    def result(self, *, tokens=None, state=None):
        """Call inside QueryTokens.attempt for query ops; no network is performed."""
        if self.error:
            raise self.error
        if self.operation == 'search-turn':
            if tokens is None or state is None:
                raise ValueError('Query state required')
            return tokens.finish_turn(state, self.body)
        if self.operation == 'search-segment':
            if tokens is None or state is None:
                raise ValueError('Query state required')
            return tokens.finish_segment(state, self.body)
        return copy.deepcopy(self.body)


class FixtureLoader:
    def __init__(self, root):
        self.root = Path(root).resolve()

    def prepare(self, scenario: str, operation: str, step: int, request: dict, *, tokens=None, sub=None):
        """Validate token/media/request and match fixture BEFORE consuming budget.

        Returns (Replay, QueryState | None). Query callers use the returned state
        with tokens.attempt, then replay.result(tokens=tokens,state=consumed).
        """
        scenario = fixture_scenario('mock', scenario)
        if operation not in OPERATIONS or type(step) is not int or not 1 <= step <= 99 or (not operation.startswith('search-') and step != 1):
            raise RelayError('invalid_request')
        request_type, response_type = OPERATIONS[operation]
        if not isinstance(request, dict):
            raise RelayError('invalid_request')
        query_operation = operation.startswith('search-')
        if query_operation:
            if tokens is None or sub is None:
                raise ValueError('Query token service and authenticated subject required')
            if 'queryToken' in request:
                tokens.verify(request['queryToken'], sub, scenario=scenario)
        try:
            parsed = request_type.model_validate(request)
        except ValidationError as exc:
            raise validation_failure(exc) from None
        state = None
        if query_operation:
            state = (tokens.prepare_turn(parsed, sub, scenario=scenario) if operation == 'search-turn'
                     else tokens.prepare_segment(parsed, sub, scenario=scenario))
            expected_step = state.sparkTurns + 1 if operation == 'search-turn' else state.samPhotos + 1
            if step != expected_step:
                raise RelayError('invalid_request')
        directory = (self.root / scenario).resolve()
        if not directory.is_relative_to(self.root):
            raise RelayError('fixture_invalid')
        stem = f'{operation}.{step:02d}'
        paths = [directory / (stem + suffix) for suffix in ('.request.json', '.response.json')]
        try:
            for path in paths:
                if not path.resolve().is_relative_to(directory):
                    raise ValueError('Invalid fixture path')
                if not path.is_file():
                    raise RelayError('fixture_not_found')
                if path.stat().st_size > 64 * 1048576:
                    raise ValueError('Fixture too large')
            definition, response = [strict_json(p.read_bytes()) for p in paths]
            if not isinstance(definition, dict) or set(definition) != {'expected', 'match', 'ignore'} or not isinstance(definition['expected'], dict):
                raise ValueError('Invalid request definition')
            if any(not isinstance(definition[k], list) for k in ('match', 'ignore')):
                raise ValueError('Invalid pointer list')
            matches = [(p, pointer_parts(p)) for p in definition['match']]
            ignored = {pointer_parts(p) for p in definition['ignore']}
            if any(m[:len(i)] == i for _, m in matches for i in ignored):
                raise ValueError('Ignored match')
            for pointer, parts in matches:
                expected = lookup(definition['expected'], parts)
                try:
                    actual = lookup(request, parts)
                except (KeyError, IndexError, TypeError):
                    raise RelayError('fixture_request_mismatch', pointer=pointer) from None
                mismatch = _mismatch(actual, expected, parts, ignored)
                if mismatch is not None:
                    at = ''.join('/' + part.replace('~', '~0').replace('/', '~1') for part in mismatch)
                    raise RelayError('fixture_request_mismatch', pointer=at)
            if not isinstance(response, dict) or set(response) - {'status', 'body', 'headers'} or not {'status', 'body'} <= set(response):
                raise ValueError('Invalid response envelope')
            status, headers = response['status'], response.get('headers', {})
            if type(status) is not int or not isinstance(headers, dict) or set(headers) - {'Retry-After'}:
                raise ValueError('Invalid response metadata')
            if headers and (status != 429 or not isinstance(headers['Retry-After'], str) or not re.fullmatch('[0-9]{1,6}', headers['Retry-After'])):
                raise ValueError('Invalid retry header')
            body = _resolve(response['body'], request, directory)
            if status != 200:
                if not isinstance(body, dict) or set(body) != {'error'} or not isinstance(body['error'], dict) or set(body['error']) != {'code', 'message', 'retryable'}:
                    raise ValueError('Invalid error envelope')
                error = body['error']
                if error['code'] not in ERRORS:
                    raise ValueError('Invalid error code')
                # Provider credentials/other 4xx and transient failures share 502,
                # but only upstream_error permits both retryability values.
                retryable = error['retryable']
                if type(retryable) is not bool:
                    raise ValueError('Invalid retryability')
                failure = RelayError(error['code'], retryable=retryable if error['code'] == 'upstream_error' else None)
                if failure.status != status or retryable != failure.retryable:
                    raise ValueError('Invalid error status')
                # Hand-authored fixture text is not trusted for client/log output.
                failure.headers.update(headers)
                return Replay(operation, {}, failure), state
            if headers:
                raise ValueError('Unexpected success headers')
            to_validate = {**body, 'queryToken': 'runtime'} if query_operation and isinstance(body, dict) else body
            validated = TypeAdapter(response_type).validate_python(to_validate)
            body = validated.model_dump(mode='json', by_alias=True, exclude_none=True)
            body.pop('queryToken', None)
            return Replay(operation, body), state
        except RelayError:
            raise
        except (ValueError, TypeError, KeyError, IndexError, OSError, RecursionError):
            raise RelayError('fixture_invalid') from None
