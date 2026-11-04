from fastapi import APIRouter
from app.schemas import DescribeRequest, StorefrontResponse, PieceResponse
from app.main import stub

router = APIRouter()

@router.post('/v1/describe/storefront', response_model=StorefrontResponse)
def describe_storefront(request: DescribeRequest):
    return stub()

@router.post('/v1/describe/piece', response_model=PieceResponse)
def describe_piece(request: DescribeRequest):
    return stub()
