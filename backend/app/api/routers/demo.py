from typing import cast

from fastapi import APIRouter, Request

from app.api.schemas import PersonaOut

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("/personas", response_model=list[PersonaOut])
def personas(request: Request) -> list[PersonaOut]:
    return cast(list[PersonaOut], request.app.state.service.personas())
