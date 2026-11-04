import base64
import io

from fastapi import APIRouter, Request
from PIL import Image

from app.errors import RelayError
from app.meta_client import Operation, deadline
from app.mock import fixture_scenario
from app.prompts.sam import sam_candidates, sam_payload, validate_segment_dimensions
from app.schemas import SearchSegmentRequest, SearchSegmentResponse

router = APIRouter()


@router.post('/v1/search/segment', response_model=SearchSegmentResponse)
async def search_segment(request: SearchSegmentRequest, http: Request):
    services = http.app.state
    sub = http.state.principal.sub
    scenario = fixture_scenario(services.settings.mode, http.headers.get('X-SF-Fixture'))
    tokens = services.tokens
    state = tokens.prepare_segment(request, sub, scenario=scenario)
    # Upload pixels must already be upright; never reinterpret provider coordinates.
    for photo in request.photos:
        with Image.open(io.BytesIO(base64.b64decode(photo.image.data))) as image:
            if image.getexif().get(274, 1) != 1:
                raise RelayError('invalid_request')
    replay = None
    if services.settings.mode == 'mock':
        replay, state = services.fixtures.prepare(
            scenario, 'search-segment', state.samPhotos + 1, await http.json(), tokens=tokens, sub=sub)
    with tokens.attempt(state, 'sam', photos=len(request.photos)) as consumed:
        if replay is not None:
            if not replay.error:
                validate_segment_dimensions(replay.body, request, error='fixture_invalid')
            return replay.result(tokens=tokens, state=consumed)
        photos = []
        # One atomic relay batch; SAM documents one image per Responses request.
        # Consume the whole batch first, and never return partial results.
        async with deadline(Operation.SAM):
            for photo in request.photos:
                raw = await services.meta.responses(Operation.SAM, sam_payload(photo, request.concept), sub=sub)
                photos.append({'photoRef': photo.photoRef,
                               'candidates': sam_candidates(raw, photo, request.concept)})
        body = {'photos': photos}
        validate_segment_dimensions(body, request)
        return tokens.finish_segment(consumed, body)
