from fastapi import APIRouter
from app.schemas import SearchSegmentRequest, SearchSegmentResponse
from app.main import stub

router = APIRouter()

@router.post('/v1/search/segment', response_model=SearchSegmentResponse)
def search_segment(request: SearchSegmentRequest):
    return stub()
