"""Stateless latest-chain budgets. Deliberately no replay/fork ledger."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from contextlib import contextmanager
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError, model_validator

from app import schemas as s
from app.errors import RelayError, strict_json

MAX_TOKEN = 12 * 1048576
_RESULT = TypeAdapter(s.ToolResult)
_ARGS = {'list_visits': s.ListVisitsArguments, 'find_photos': s.FindPhotosArguments,
         'extract_items': s.ExtractItemsArguments}


def wire(value):
    return value.model_dump(mode='json', by_alias=True, exclude_none=True)


def validated_call(value):
    required = {'id', 'name', 'arguments'}
    if not isinstance(value, dict) or not required <= set(value) or set(value) - required - {'providerCallId'}:
        raise ValueError('Invalid call')
    TypeAdapter(s.Ref).validate_python(value['id'])
    if 'providerCallId' in value and (not isinstance(value['providerCallId'], str) or not re.fullmatch(r'[\x21-\x7e]{1,64}', value['providerCallId'])):
        raise ValueError('Invalid provider call ID')
    cls = _ARGS.get(value['name'])
    if cls is None:
        raise ValueError('Invalid tool')
    cls.model_validate(value['arguments'])
    return value


class QueryState(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)
    v: Literal[1] = 1
    qid: str
    sub: Annotated[str, Field(pattern='^[0-9a-f]{64}$')]
    sparkTurns: Annotated[int, Field(ge=0, le=4)] = 0
    samPhotos: Annotated[int, Field(ge=0, le=3)] = 0
    iat: int
    exp: int
    query: Annotated[str, Field(min_length=1, max_length=2000)]
    context: dict
    history: list[dict] = Field(default_factory=list)
    pending: dict | None = None
    closed: bool = False
    fixtureScenario: str | None = None

    @model_validator(mode='after')
    def validate_payload(self):
        from uuid import UUID
        UUID(self.qid)
        if self.exp != self.iat + 900 or not self.query.strip():
            raise ValueError('Invalid lifetime or query')
        s.QueryContext.model_validate(self.context)
        if self.fixtureScenario is not None and not re.fullmatch('[a-z0-9-]{1,64}', self.fixtureScenario):
            raise ValueError('Invalid scenario')
        for entry in self.history:
            if len(entry) != 1:
                raise ValueError('Invalid history')
            key, value = next(iter(entry.items()))
            if key == 'call':
                validated_call(value)
            elif key == 'result':
                _RESULT.validate_python(value)
            elif key == 'final':
                s.Final.model_validate(value)
            elif key == 'not_found':
                s.NotFound.model_validate(value)
            else:
                raise ValueError('Invalid history')
        if self.pending is not None:
            if set(self.pending) - {'id', 'name', 'arguments', 'summary', 'providerCallId'}:
                raise ValueError('Invalid pending')
            validated_call({k: v for k, v in self.pending.items() if k != 'summary'})
            if 'summary' in self.pending:
                if self.pending['name'] != 'extract_items':
                    raise ValueError('Invalid summary')
                TypeAdapter(list[s.ExtractSummary]).validate_python(self.pending['summary'])
        return self


class QueryTokens:
    def __init__(self, secret: bytes, *, clock=time.time):
        if len(secret) < 32:
            raise ValueError('HMAC secret is too short')
        self.secret, self.clock = secret, clock

    def start(self, sub: str, query: str, context, *, scenario: str | None = None) -> QueryState:
        now = int(self.clock())
        try:
            return QueryState(qid=str(uuid4()), sub=sub, iat=now, exp=now + 900, query=query,
                              context=wire(s.QueryContext.model_validate(context)), fixtureScenario=scenario)
        except (ValueError, TypeError):
            raise RelayError('invalid_request') from None

    def sign(self, state: QueryState) -> str:
        try:
            state = QueryState.model_validate(state.model_dump())
            payload = json.dumps(state.model_dump(exclude_none=True), separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
            encoded = base64.urlsafe_b64encode(payload).rstrip(b'=')
            signature = base64.urlsafe_b64encode(hmac.new(self.secret, b'query:v1:' + encoded, hashlib.sha256).digest()).rstrip(b'=')
            token = (encoded + b'.' + signature).decode()
        except (ValueError, TypeError):
            raise RelayError('invalid_request') from None
        if len(token) > MAX_TOKEN:
            raise RelayError('invalid_request')
        return token

    def verify(self, token: str, sub: str, *, scenario: str | None = None) -> QueryState:
        try:
            if not isinstance(token, str) or len(token) > MAX_TOKEN:
                raise ValueError()
            encoded, signature = token.split('.')
            if not re.fullmatch('[A-Za-z0-9_-]+', encoded) or not re.fullmatch('[A-Za-z0-9_-]{43}', signature):
                raise ValueError()
            expected = base64.urlsafe_b64encode(hmac.new(self.secret, b'query:v1:' + encoded.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
            if not hmac.compare_digest(expected, signature):
                raise ValueError()
            payload = base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4))
            if base64.urlsafe_b64encode(payload).rstrip(b'=').decode() != encoded:
                raise ValueError()
            state = QueryState.model_validate(strict_json(payload))
            if not hmac.compare_digest(state.sub, sub) or state.iat > self.clock():
                raise ValueError()
        except (ValueError, TypeError, UnicodeError, RecursionError):
            raise RelayError('invalid_query_token') from None
        if state.exp <= self.clock():
            raise RelayError('query_token_expired')
        if state.fixtureScenario != scenario:
            raise RelayError('invalid_request')
        return state

    def prepare_turn(self, request: s.SearchTurnRequest, sub: str, *, scenario=None) -> QueryState:
        if request.queryToken is None:
            return self.start(sub, request.query, request.context, scenario=scenario)
        state = self.verify(request.queryToken, sub, scenario=scenario)
        self.check_turn(state)
        if request.query != state.query or (request.context is not None and wire(request.context) != state.context):
            raise RelayError('invalid_request')
        pending = state.pending
        results = request.toolResults or []
        if pending is None or len(results) != 1:
            raise RelayError('invalid_request')
        result = results[0]
        if result.toolCallId != pending['id'] or result.name != pending['name']:
            raise RelayError('invalid_request')
        value = result.model_dump(mode='json', by_alias=True, exclude_none=True)
        # topScore:null is contractual, not an omitted optional field.
        if result.name == 'extract_items':
            value = result.model_dump(mode='json', by_alias=True)
            if value['result'] != pending.get('summary'):
                raise RelayError('invalid_request')
        if result.name == 'list_visits':
            args = s.ListVisitsArguments.model_validate(pending['arguments'])
            visits = result.result.visits
            if (args.limit is not None and len(visits) > args.limit or
                args.limit is None and result.result.truncated or
                len({v.shopRef for v in visits}) != len(visits)):
                raise RelayError('invalid_request')
            if any(args.from_ is not None and visit.startedAt < args.from_ or
                   args.to is not None and visit.startedAt >= args.to for visit in visits):
                raise RelayError('invalid_request')
        if result.name == 'find_photos':
            args = s.FindPhotosArguments.model_validate(pending['arguments'])
            if len(result.result) > args.k:
                raise RelayError('invalid_request')
            for photo in result.result:
                if (args.shopRefs is not None and photo.shopRef not in args.shopRefs or
                    args.timeFrom is not None and photo.takenAt < args.timeFrom or
                    args.timeTo is not None and photo.takenAt >= args.timeTo):
                    raise RelayError('invalid_request')
        state.history.append({'result': value})
        state.pending = None
        self.sign(state)  # Reject an oversized accumulated history before provider I/O.
        return state

    @staticmethod
    def check_turn(state):
        if state.sparkTurns >= 4:
            raise RelayError('turn_limit_exceeded')
        if state.closed:
            raise RelayError('query_closed')

    def prepare_segment(self, request: s.SearchSegmentRequest, sub: str, *, scenario=None) -> QueryState:
        state = self.verify(request.queryToken, sub, scenario=scenario)
        if state.samPhotos + len(request.photos) > 3:
            raise RelayError('photo_limit_exceeded')
        if state.closed:
            raise RelayError('query_closed')
        pending = state.pending
        if (pending is None or pending['name'] != 'extract_items' or 'summary' in pending or
            pending['arguments']['concept'] != request.concept or
            pending['arguments']['photoRefs'] != [p.photoRef for p in request.photos]):
            raise RelayError('invalid_request')
        return state

    @contextmanager
    def attempt(self, state: QueryState, operation: str, *, photos: int = 0):
        """Enter only AFTER all input/fixture matching validation, immediately before I/O.

        Yield the consumed state; finish/sign it inside this block so malformed
        provider responses also return a consumed, closed X-Query-Token.
        """
        if operation == 'spark':
            self.check_turn(state)
        elif operation == 'sam':
            if type(photos) is not int or not 1 <= photos <= 3:
                raise RelayError('invalid_request')
            if state.samPhotos + photos > 3:
                raise RelayError('photo_limit_exceeded')
            if state.closed:
                raise RelayError('query_closed')
        else:
            raise ValueError('Unknown query operation')
        consumed = state.model_copy(deep=True)
        if operation == 'spark':
            consumed.sparkTurns += 1
        else:
            consumed.samPhotos += photos
        self.sign(consumed)
        try:
            yield consumed
        except RelayError as exc:
            failed = state.model_copy(update={'closed': True, 'sparkTurns': consumed.sparkTurns, 'samPhotos': consumed.samPhotos})
            exc.headers['X-Query-Token'] = self.sign(failed)
            raise
        except Exception:
            failed = state.model_copy(update={'closed': True, 'sparkTurns': consumed.sparkTurns, 'samPhotos': consumed.samPhotos})
            error = RelayError('upstream_error')
            error.headers['X-Query-Token'] = self.sign(failed)
            raise error from None

    def finish_turn(self, state: QueryState, body: dict, *, provider_call_id: str | None = None) -> dict:
        """Validate endpoint output, strip vector from token, sign current refs."""
        try:
            response = TypeAdapter(s.SearchTurnResponse).validate_python({**body, 'queryToken': 'runtime'})
            data = response.model_dump(mode='json', by_alias=True, exclude_none=True)
            data.pop('queryToken')
            if 'toolCalls' in data:
                if state.sparkTurns >= 4:
                    raise ValueError('Tools forbidden on last turn')
                call = {k: v for k, v in data['toolCalls'][0].items() if k != 'phraseVector'}
                if provider_call_id is not None:
                    call['providerCallId'] = provider_call_id
                validated_call(call)
                state.pending = call
                state.history.append({'call': call.copy()})
            else:
                if provider_call_id is not None:
                    raise ValueError('Provider call ID requires a tool call')
                state.closed, state.pending = True, None
                state.history.append(data)
            return {**data, 'queryToken': self.sign(state)}
        except (ValidationError, ValueError, TypeError):
            raise RelayError('upstream_error') from None

    def finish_segment(self, state: QueryState, body: dict) -> dict:
        try:
            response = s.SearchSegmentResponse.model_validate({**body, 'queryToken': 'runtime'})
            pending = state.pending
            if pending is None or [p.photoRef for p in response.photos] != pending['arguments']['photoRefs']:
                raise ValueError('Photo mismatch')
            if any(c.label != pending['arguments']['concept'] for p in response.photos for c in p.candidates):
                raise ValueError('Concept mismatch')
            pending['summary'] = [{'photoRef': p.photoRef, 'candidateCount': len(p.candidates),
                                   'topScore': max((c.score for c in p.candidates), default=None)} for p in response.photos]
            return {**wire(response), 'queryToken': self.sign(state)}
        except (ValueError, TypeError):
            raise RelayError('upstream_error') from None
