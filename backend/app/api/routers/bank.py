"""Bank contour endpoints: queue, dossier, decision, rescore, metrics."""

from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import current_user_id, require_role
from app.api.schemas import (
    ApplicationOut,
    BankDossierOut,
    BankQueueOut,
    MetricsOut,
    ScoringRunOut,
    UnderwriterDecisionIn,
    UserRole,
)
from app.db.repositories import ApplicationNotFound
from app.domain.enums import ApplicationStatus
from app.services.application_service import ApplicationError

router = APIRouter(prefix="/bank", tags=["bank"])
BankUser = Annotated[UserRole, Depends(require_role(UserRole.BANK))]
CurrentUser = Annotated[UUID, Depends(current_user_id)]


def _bank(request: Request):  # type: ignore[no-untyped-def]
    return request.app.state.bank_service


@router.get("/applications", response_model=BankQueueOut)
def queue(
    request: Request,
    _user: Annotated[UUID, Depends(current_user_id)],
    _role: Annotated[UserRole, Depends(require_role(UserRole.BANK))],
    status_filter: ApplicationStatus | None = None,
) -> BankQueueOut:
    return cast(BankQueueOut, _bank(request).queue(status_filter))


@router.get("/applications/{application_id}", response_model=BankDossierOut)
def dossier(
    application_id: UUID, request: Request, _user: CurrentUser, _role: BankUser
) -> BankDossierOut:
    try:
        return cast(BankDossierOut, _bank(request).dossier(application_id))
    except (ApplicationError, ApplicationNotFound) as exc:
        raise HTTPException(status_code=404, detail="APPLICATION_NOT_FOUND") from exc


@router.get("/applications/{application_id}/scoring-runs", response_model=list[ScoringRunOut])
def scoring_runs(
    application_id: UUID, request: Request, _user: CurrentUser, _role: BankUser
) -> list[ScoringRunOut]:
    return cast(list[ScoringRunOut], _bank(request).scoring_runs(application_id))


@router.post("/applications/{application_id}/decision", response_model=ApplicationOut)
def decision(
    application_id: UUID,
    data: UnderwriterDecisionIn,
    request: Request,
    user_id: CurrentUser,
    _role: BankUser,
) -> ApplicationOut:
    try:
        return cast(ApplicationOut, _bank(request).decide(user_id, application_id, data))
    except ApplicationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/applications/{application_id}/rescore", response_model=ApplicationOut)
def rescore(
    application_id: UUID,
    request: Request,
    user_id: CurrentUser,
    _role: BankUser,
) -> ApplicationOut:
    bank = _bank(request)
    try:
        result = bank.rescore(user_id, application_id)
    except ApplicationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if isinstance(result, ApplicationOut):
        return result
    return cast(
        ApplicationOut,
        bank.service._application_out(bank.repository.get(application_id)),
    )


@router.get("/metrics", response_model=MetricsOut)
def metrics(request: Request, _user: CurrentUser, _role: BankUser) -> MetricsOut:
    return cast(MetricsOut, _bank(request).metrics())
