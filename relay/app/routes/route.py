from fastapi import APIRouter
from app.schemas import RouteRequest, RouteResponse
from app.main import stub

router = APIRouter()

@router.post('/v1/route', response_model=RouteResponse)
def route(request: RouteRequest):
    return stub()
