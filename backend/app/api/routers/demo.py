"""Demo helpers: persona list for login buttons and demo reset."""

from typing import cast

from fastapi import APIRouter, Request

from app.api.schemas import PersonaOut, ResetOut

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("/personas", response_model=list[PersonaOut])
def personas(request: Request) -> list[PersonaOut]:
    return cast(list[PersonaOut], request.app.state.service.personas())


@router.post("/reset", response_model=ResetOut)
def reset(request: Request) -> ResetOut:
    request.app.state.service.reset_demo()
    return ResetOut()
