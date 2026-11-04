"""English-biased file transcription; preserve the provider transcript verbatim."""
import base64

from fastapi import APIRouter, Request
from pydantic import ValidationError

from app.errors import RelayError
from app.schemas import TranscribeRequest, TranscribeResponse

router = APIRouter()


@router.post('/v1/transcribe', response_model=TranscribeResponse)
async def transcribe(request: TranscribeRequest, http: Request):
    if http.app.state.settings.mode == 'mock':
        replay, _ = http.app.state.fixtures.prepare(
            http.state.fixture_scenario, 'transcribe', 1, request.model_dump())
        return replay.result()
    # Audio's validator already checks actual PCM samples, chunks and file size.
    result = await http.app.state.meta.transcribe(base64.b64decode(request.audio.data))
    try:
        return TranscribeResponse.model_validate(
            {'text': result['transcript'], 'language': 'en'}, strict=True)
    except (KeyError, TypeError, ValidationError):
        raise RelayError('upstream_error') from None
