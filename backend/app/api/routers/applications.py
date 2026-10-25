from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import current_user_id, require_role
from app.api.schemas import ApplicationIn, ApplicationListOut, ApplicationOut, UserRole

router = APIRouter(prefix="/applications", tags=["applications"])


def _user_id(user_id: Annotated[UUID, Depends(current_user_id)]) -> UUID:
    return user_id


@router.get("", response_model=ApplicationListOut)
def list_applications(
    request: Request,
    user_id: Annotated[UUID, Depends(_user_id)],
    _role: Annotated[UserRole, Depends(require_role(UserRole.CLIENT))],
) -> ApplicationListOut:
    return cast(ApplicationListOut, request.app.state.service.list_applications(user_id))


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    data: ApplicationIn,
    request: Request,
    user_id: Annotated[UUID, Depends(_user_id)],
    _role: Annotated[UserRole, Depends(require_role(UserRole.CLIENT))],
) -> ApplicationOut:
    try:
        return cast(ApplicationOut, request.app.state.service.create_application(user_id, data))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{application_id}/submit", response_model=ApplicationOut)
def submit_application(
    application_id: UUID,
    request: Request,
    user_id: Annotated[UUID, Depends(_user_id)],
    _role: Annotated[UserRole, Depends(require_role(UserRole.CLIENT))],
) -> ApplicationOut:
    try:
        return cast(
            ApplicationOut,
            request.app.state.service.submit_application(user_id, application_id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
