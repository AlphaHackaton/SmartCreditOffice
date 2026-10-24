from typing import cast

from fastapi import APIRouter, HTTPException, Request, status

from app.api.schemas import LoginIn, LoginOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, request: Request) -> LoginOut:
    try:
        return cast(LoginOut, request.app.state.service.login(data.login, data.password))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.get("/me", response_model=UserOut)
def me(request: Request) -> UserOut:
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_REQUIRED")
    return cast(UserOut, request.app.state.service.user(user_id))
