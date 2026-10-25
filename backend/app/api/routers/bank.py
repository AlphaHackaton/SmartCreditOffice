from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import current_user_id, require_role
from app.api.schemas import (
    ApplicationOut,
    BankDossierOut,
    BankQueueOut,
    MetricsOut,
    UnderwriterDecisionIn,
    UserRole,
)

router = APIRouter(prefix="/bank", tags=["bank"])
BankUser = Annotated[UserRole, Depends(require_role(UserRole.BANK))]
CurrentUser = Annotated[UUID, Depends(current_user_id)]


@router.get("/applications", response_model=BankQueueOut)
def queue(request: Request, _user: CurrentUser, _role: BankUser) -> BankQueueOut:
    return cast(BankQueueOut, request.app.state.bank_service.queue())


@router.get("/applications/{application_id}", response_model=BankDossierOut)
def dossier(
    application_id: UUID, request: Request, _user: CurrentUser, _role: BankUser
) -> BankDossierOut:
    try:
        return cast(BankDossierOut, request.app.state.bank_service.dossier(application_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/applications/{application_id}/decision", response_model=ApplicationOut)
def decision(
    application_id: UUID,
    data: UnderwriterDecisionIn,
    request: Request,
    _user: CurrentUser,
    _role: BankUser,
) -> ApplicationOut:
    try:
        return cast(ApplicationOut, request.app.state.bank_service.decide(application_id, data))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/applications/{application_id}/rescore", response_model=ApplicationOut)
def rescore(
    application_id: UUID, request: Request, _user: CurrentUser, _role: BankUser
) -> ApplicationOut:
    try:
        return cast(ApplicationOut, request.app.state.bank_service.rescore(application_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/metrics", response_model=MetricsOut)
def metrics(request: Request, _user: CurrentUser, _role: BankUser) -> MetricsOut:
    return cast(MetricsOut, request.app.state.bank_service.metrics())
