from typing import cast
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from app.api.schemas import ApplicationIn, ApplicationListOut, ApplicationOut

router = APIRouter(prefix="/applications", tags=["applications"])


def _user_id(request: Request) -> UUID:
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_REQUIRED")
    return cast(UUID, user_id)


@router.get("", response_model=ApplicationListOut)
def list_applications(request: Request) -> ApplicationListOut:
    return cast(
        ApplicationListOut,
        request.app.state.service.list_applications(_user_id(request)),
    )


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationIn, request: Request) -> ApplicationOut:
    try:
        return cast(
            ApplicationOut,
            request.app.state.service.create_application(_user_id(request), data),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{application_id}/submit", response_model=ApplicationOut)
def submit_application(application_id: UUID, request: Request) -> ApplicationOut:
    try:
        return cast(
            ApplicationOut,
            request.app.state.service.submit_application(_user_id(request), application_id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
