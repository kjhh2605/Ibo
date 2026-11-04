from fastapi import APIRouter
from app.schemas import SearchTurnRequest, SearchTurnResponse
from app.main import stub

router = APIRouter()

@router.post('/v1/search/turn', response_model=SearchTurnResponse)
def search_turn(request: SearchTurnRequest):
    return stub()
