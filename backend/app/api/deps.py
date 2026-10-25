"""Application dependencies; database wiring is intentionally lazy."""

from collections.abc import Callable
from typing import Annotated, cast
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status

from app.api.schemas import UserRole


def current_user_id(request: Request) -> UUID:
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_REQUIRED")
    return cast(UUID, user_id)


def current_role(request: Request) -> UserRole:
    role = getattr(request.state, "role", None)
    if role is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_REQUIRED")
    return cast(UserRole, role)


def require_role(*allowed: UserRole) -> Callable[[UserRole], UserRole]:
    def dependency(role: Annotated[UserRole, Depends(current_role)]) -> UserRole:
        if role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
        return role

    return dependency
