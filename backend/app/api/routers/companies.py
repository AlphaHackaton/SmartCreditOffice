"""Company profile of the current client."""

from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import current_user_id, require_role
from app.api.schemas import CompanyOut, UserRole

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/me", response_model=CompanyOut)
def my_company(
    request: Request,
    user_id: Annotated[UUID, Depends(current_user_id)],
    _role: Annotated[UserRole, Depends(require_role(UserRole.CLIENT))],
) -> CompanyOut:
    try:
        return cast(CompanyOut, request.app.state.service.company(user_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
