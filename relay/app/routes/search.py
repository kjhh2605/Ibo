from fastapi import APIRouter, Request
from starlette.concurrency import run_in_threadpool

from app.errors import RelayError
from app.logging import log_search_text
from app.meta_client import Operation
from app.mock import fixture_scenario
from app.prompts.search import parse_spark, spark_payload, validate_output_refs, validate_result_refs
from app.schemas import SearchTurnRequest, SearchTurnResponse

router = APIRouter()


@router.post('/v1/search/turn', response_model=SearchTurnResponse, response_model_exclude_none=True)
async def search_turn(request: SearchTurnRequest, http: Request):
    services = http.app.state
    sub = http.state.principal.sub
    scenario = fixture_scenario(services.settings.mode, http.headers.get('X-SF-Fixture'))
    tokens = services.tokens
    state = tokens.prepare_turn(request, sub, scenario=scenario)
    validate_result_refs(state)
    replay = None
    if services.settings.mode == 'mock':
        replay, state = services.fixtures.prepare(
            scenario, 'search-turn', state.sparkTurns + 1, await http.json(), tokens=tokens, sub=sub)
    with tokens.attempt(state, 'spark') as consumed:
        http.state.spark_turns = consumed.sparkTurns
        if replay is not None:
            if not replay.error:
                validate_output_refs(consumed, replay.body, error='fixture_invalid')
            response = replay.result(tokens=tokens, state=consumed)
        else:
            raw = await services.meta.responses(Operation.SPARK, spark_payload(consumed), sub=sub)
            body, provider_id = parse_spark(raw)
            if provider_id is not None and any(
                entry.get('call', {}).get('providerCallId') == provider_id for entry in consumed.history
            ):
                raise RelayError('upstream_error')
            validate_output_refs(consumed, body)
            if 'toolCalls' in body and body['toolCalls'][0]['name'] == 'find_photos':
                encoder = getattr(services, 'pe_text', None)
                if encoder is None:
                    raise RelayError('model_unavailable')
                call = body['toolCalls'][0]
                call['phraseVector'] = await run_in_threadpool(encoder.encode, call['arguments']['phrase'])
            response = tokens.finish_turn(consumed, body, provider_call_id=provider_id)
        log_search_text(services.settings, query=consumed.query, response=response)
        return response
