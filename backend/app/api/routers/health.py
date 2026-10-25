from fastapi import APIRouter, Request

from app.api.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(request: Request) -> HealthOut:
    return HealthOut(mode=request.app.state.settings.app_mode)
