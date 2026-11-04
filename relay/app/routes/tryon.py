from fastapi import APIRouter
from app.schemas import TryOnRequest, TryOnResponse
from app.main import stub

router = APIRouter()

@router.post('/v1/tryon', response_model=TryOnResponse)
def tryon(request: TryOnRequest):
    return stub()
