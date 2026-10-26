"""Client application endpoints: drafts, submit, simulate, accept, sign, cancel."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status

from app.api.deps import current_user_id, require_role
from app.api.schemas import (
    ApplicationIn,
    ApplicationListOut,
    ApplicationOut,
    SignIn,
    SigningChallenge,
    SimulationIn,
    SimulationOut,
    UserRole,
)
from app.services.application_service import ApplicationService

router = APIRouter(prefix="/applications", tags=["applications"])


def _service(request: Request) -> ApplicationService:
    service: ApplicationService = request.app.state.service
    return service


ClientUser = Annotated[UserRole, Depends(require_role(UserRole.CLIENT))]
CurrentUser = Annotated[UUID, Depends(current_user_id)]


def _version_query(version: int = 1) -> int:
    """Optimistic-lock version carried by command requests."""
    return version


@router.get("", response_model=ApplicationListOut)
def list_applications(
    request: Request, user_id: CurrentUser, _role: ClientUser
) -> ApplicationListOut:
    return _service(request).list_applications(user_id)


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    data: ApplicationIn, request: Request, user_id: CurrentUser, _role: ClientUser
) -> ApplicationOut:
    return _service(request).create_application(user_id, data)


@router.patch("/{application_id}", response_model=ApplicationOut)
def update_application(
    application_id: UUID,
    data: ApplicationIn,
    request: Request,
    user_id: CurrentUser,
    _role: ClientUser,
    version: Annotated[int, Depends(_version_query)],
) -> ApplicationOut:
    return _service(request).update_application(user_id, application_id, data, version)


@router.post("/{application_id}/submit", response_model=ApplicationOut)
def submit_application(
    application_id: UUID,
    request: Request,
    background: BackgroundTasks,
    user_id: CurrentUser,
    _role: ClientUser,
    version: Annotated[int, Depends(_version_query)],
) -> ApplicationOut:
    result = _service(request).submit_application(user_id, application_id, version)
    _schedule_scoring(request, background, application_id, result.version)
    return result


@router.post("/{application_id}/simulate", response_model=SimulationOut)
def simulate(
    application_id: UUID,
    data: SimulationIn,
    request: Request,
    user_id: CurrentUser,
    _role: ClientUser,
) -> SimulationOut:
    return _service(request).simulate(user_id, application_id, data)


@router.post("/{application_id}/accept", response_model=SigningChallenge)
def accept_offer(
    application_id: UUID,
    request: Request,
    user_id: CurrentUser,
    _role: ClientUser,
    version: Annotated[int, Depends(_version_query)],
    offer_id: UUID | None = None,
) -> SigningChallenge:
    return _service(request).accept_offer(user_id, application_id, version, offer_id)


@router.post("/{application_id}/sign", response_model=ApplicationOut)
def sign_application(
    application_id: UUID,
    data: SignIn,
    request: Request,
    background: BackgroundTasks,
    user_id: CurrentUser,
    _role: ClientUser,
    version: Annotated[int, Depends(_version_query)],
) -> ApplicationOut:
    result = _service(request).sign_application(user_id, application_id, version, data.code)
    _schedule_disbursement(request, background, application_id, result.version)
    return result


@router.post("/{application_id}/cancel", response_model=ApplicationOut)
def cancel_application(
    application_id: UUID,
    request: Request,
    user_id: CurrentUser,
    _role: ClientUser,
    version: Annotated[int, Depends(_version_query)],
) -> ApplicationOut:
    return _service(request).cancel_application(user_id, application_id, version)


def _schedule_scoring(
    request: Request, background: BackgroundTasks, application_id: UUID, version: int
) -> None:
    runner = getattr(request.app.state, "scoring_runner", None)
    if runner is not None:
        background.add_task(runner, application_id, version)


def _schedule_disbursement(
    request: Request, background: BackgroundTasks, application_id: UUID, version: int
) -> None:
    runner = getattr(request.app.state, "disbursement_runner", None)
    if runner is not None:
        background.add_task(runner, application_id, version)
