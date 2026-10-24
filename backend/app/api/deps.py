"""Application dependencies; database wiring is intentionally lazy."""

from typing import cast
from uuid import UUID

from fastapi import HTTPException, Request, status


def current_user_id(request: Request) -> UUID:
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_REQUIRED")
    return cast(UUID, user_id)
