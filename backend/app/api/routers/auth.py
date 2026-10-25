from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import current_user_id
from app.api.schemas import LoginIn, LoginOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, request: Request) -> LoginOut:
    try:
        return cast(LoginOut, request.app.state.service.login(data.login, data.password))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.get("/me", response_model=UserOut)
def me(
    request: Request,
    user_id: Annotated[UUID, Depends(current_user_id)],
) -> UserOut:
    return cast(UserOut, request.app.state.service.user(user_id))
