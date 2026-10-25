"""Persistence operations with transactional status transitions."""

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.db.models import Application, StatusHistory
from app.domain import application_status
from app.domain.enums import Actor, ApplicationStatus
from app.domain.errors import DomainError


class RepositoryError(Exception):
    """Base class for persistence errors exposed by the service layer."""


class ApplicationNotFound(RepositoryError):
    """Application does not exist."""


class VersionConflict(RepositoryError):
    """The command was based on an outdated application version."""

    def __init__(self, application_id: UUID, expected: int, actual: int | None = None) -> None:
        self.application_id = application_id
        self.expected = expected
        self.actual = actual
        super().__init__(f"VERSION_CONFLICT: expected {expected}, actual {actual}")


class ApplicationRepository:
    """Repository for application aggregates and their status history."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, application_id: UUID) -> Application:
        application = self.session.get(Application, application_id)
        if application is None:
            raise ApplicationNotFound(str(application_id))
        return application

    def apply_transition(
        self,
        application_id: UUID,
        expected_version: int,
        target: ApplicationStatus,
        actor: Actor,
        *,
        at: datetime,
        reason: str | None = None,
    ) -> Application:
        """Apply a validated domain transition and persist its event atomically.

        The caller owns the surrounding transaction. The conditional UPDATE makes
        concurrent commands safe even when both requests read the same version.
        """
        application = self.get(application_id)
        if application.version != expected_version:
            raise VersionConflict(application_id, expected_version, application.version)

        try:
            event = application_status.transition(
                ApplicationStatus(application.status),
                target,
                actor,
                at=at,
                reason=reason,
            )
        except DomainError:
            raise

        result = cast(
            CursorResult[Any],
            self.session.execute(
                update(Application)
                .where(Application.id == application_id, Application.version == expected_version)
                .values(status=event.to_status.value, version=expected_version + 1)
            ),
        )
        if result.rowcount != 1:
            self.session.rollback()
            raise VersionConflict(application_id, expected_version)

        self.session.add(
            StatusHistory(
                application_id=application_id,
                from_status=event.from_status.value if event.from_status else None,
                to_status=event.to_status.value,
                actor=event.actor.value,
                reason=event.reason,
                at=event.at,
            )
        )
        application.status = event.to_status.value
        application.version = expected_version + 1
        return application

    def history(self, application_id: UUID) -> list[StatusHistory]:
        self.get(application_id)
        return list(
            self.session.scalars(
                select(StatusHistory)
                .where(StatusHistory.application_id == application_id)
                .order_by(StatusHistory.at, StatusHistory.id)
            ).all()
        )
