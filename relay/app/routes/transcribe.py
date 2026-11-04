from fastapi import APIRouter
from app.schemas import TranscribeRequest, TranscribeResponse
from app.main import stub

router = APIRouter()

@router.post('/v1/transcribe', response_model=TranscribeResponse)
def transcribe(request: TranscribeRequest):
    return stub()
