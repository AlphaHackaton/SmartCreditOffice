"""Bank-contour operations: queue, dossier, underwriting decision, rescore, metrics."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import (
    ApplicationOut,
    BankApplicationSummary,
    BankDossierOut,
    BankQueueOut,
    MetricsOut,
    ScoringRunOut,
    UnderwriterDecisionIn,
)
from app.db.models import Application, AuditLog, ScoringRun
from app.db.repositories import ApplicationRepository
from app.domain.enums import Actor, ApplicationStatus
from app.services.application_service import ApplicationError, ApplicationService


class BankService:
    """Reads and decides on applications; every status change goes through the FSM."""

    def __init__(self, service: ApplicationService) -> None:
        self.service = service
        self.session: Session = service.session
        self.repository: ApplicationRepository = service.repository

    def queue(self, status_filter: ApplicationStatus | None = None) -> BankQueueOut:
        statement = select(Application).order_by(Application.created_at)
        if status_filter is not None:
            statement = statement.where(Application.status == status_filter.value)
        return BankQueueOut(
            items=[
                BankApplicationSummary(
                    id=row.id,
                    company_id=row.company_id,
                    status=ApplicationStatus(row.status),
                    product_code=row.product_code,
                    amount=row.amount,
                    term_months=row.term_months,
                    version=row.version,
                )
                for row in self.session.scalars(statement).all()
            ]
        )

    def dossier(self, application_id: UUID) -> BankDossierOut:
        application = self.repository.get(application_id)
        run = self.session.scalar(
            select(ScoringRun)
            .where(ScoringRun.application_id == application_id)
            .order_by(ScoringRun.created_at.desc(), ScoringRun.id.desc())
        )
        audit = list(
            self.session.scalars(
                select(AuditLog)
                .where(AuditLog.application_id == application_id)
                .order_by(AuditLog.created_at, AuditLog.id)
            ).all()
        )
        return BankDossierOut(
            application=self.service._application_out(application),
            inputs_snapshot=run.inputs_snapshot if run else {},
            audit=[
                {"action": row.action, "payload": row.payload, "at": row.created_at.isoformat()}
                for row in audit
            ],
        )

    def scoring_runs(self, application_id: UUID) -> list[ScoringRunOut]:
        self.repository.get(application_id)
        return [
            ScoringRunOut(
                id=row.id,
                application_id=row.application_id,
                inputs_snapshot=row.inputs_snapshot,
                factors=row.factors,
                result=row.result,
                policy_version=row.policy_version,
                created_at=row.created_at,
            )
            for row in self.session.scalars(
                select(ScoringRun)
                .where(ScoringRun.application_id == application_id)
                .order_by(ScoringRun.created_at, ScoringRun.id)
            ).all()
        ]

    def decide(
        self, bank_user_id: UUID, application_id: UUID, data: UnderwriterDecisionIn
    ) -> ApplicationOut:
        application = self.repository.get(application_id)
        if application.status != ApplicationStatus.UNDERWRITING.value:
            raise ApplicationError("INVALID_STATUS")
        target = ApplicationStatus(data.outcome.value)
        application = self.repository.apply_transition(
            application_id,
            application.version,
            target,
            Actor.BANK,
            at=datetime.now(UTC),
            reason=data.comment,
        )
        self.service._audit(
            bank_user_id,
            application_id,
            "UNDERWRITER_DECISION",
            {"outcome": data.outcome.value, "comment": data.comment},
        )
        self.session.commit()
        return self.service._application_out(application)

    def rescore(self, bank_user_id: UUID, application_id: UUID) -> ApplicationStatus:
        """Manual rescore from an underwriting-adjacent status."""
        application = self.repository.get(application_id)
        if application.status not in (
            ApplicationStatus.UNDERWRITING.value,
            ApplicationStatus.REJECTED.value,
            ApplicationStatus.COUNTER_OFFER.value,
        ):
            raise ApplicationError("INVALID_STATUS")
        self.service._audit(bank_user_id, application_id, "RESCORE", {})
        self.session.commit()
        return self.service.run_scoring(application_id, application.version)

    def metrics(self) -> MetricsOut:
        rows = list(self.session.scalars(select(Application.status)).all())
        counter: dict[str, int] = {status.value: 0 for status in ApplicationStatus}
        for status_value in rows:
            counter[status_value] += 1
        return MetricsOut(
            total_applications=len(rows),
            automated_decisions=counter[ApplicationStatus.APPROVED.value]
            + counter[ApplicationStatus.COUNTER_OFFER.value]
            + counter[ApplicationStatus.REJECTED.value]
            + counter[ApplicationStatus.SIGNED.value]
            + counter[ApplicationStatus.DISBURSED.value],
            underwriting_decisions=counter[ApplicationStatus.UNDERWRITING.value],
            approved=counter[ApplicationStatus.APPROVED.value]
            + counter[ApplicationStatus.SIGNED.value]
            + counter[ApplicationStatus.DISBURSED.value],
            counter_offer=counter[ApplicationStatus.COUNTER_OFFER.value],
            rejected=counter[ApplicationStatus.REJECTED.value],
        )


class StubBankService:
    """Bank contour over the in-memory demo service (APP_MODE=stub)."""

    def __init__(self, service: Any) -> None:
        self.service = service
        self._audit: dict[UUID, list[dict[str, Any]]] = {}

    def queue(self, status_filter: ApplicationStatus | None = None) -> BankQueueOut:
        items = []
        for item in self.service._applications.values():
            if status_filter is not None and item.status != status_filter:
                continue
            items.append(
                BankApplicationSummary(
                    id=item.id,
                    company_id=item.company_id,
                    status=item.status,
                    product_code=item.product_code,
                    amount=Decimal(item.amount),
                    term_months=item.term_months,
                    version=item.version,
                )
            )
        return BankQueueOut(items=items)

    def dossier(self, application_id: UUID) -> BankDossierOut:
        item = self.service._applications.get(application_id)
        if item is None:
            raise ApplicationError("APPLICATION_NOT_FOUND")
        return BankDossierOut(
            application=self.service._out(item),
            inputs_snapshot={},
            audit=self._audit.get(application_id, []),
        )

    def scoring_runs(self, application_id: UUID) -> list[ScoringRunOut]:
        return []

    def decide(
        self, user_id: UUID, application_id: UUID, data: UnderwriterDecisionIn
    ) -> ApplicationOut:
        from typing import cast

        item = self.service._applications.get(application_id)
        if item is None:
            raise ApplicationError("APPLICATION_NOT_FOUND")
        if item.status != ApplicationStatus.UNDERWRITING:
            raise ApplicationError("INVALID_STATUS")
        item.status = ApplicationStatus(data.outcome.value)
        item.version += 1
        self._audit.setdefault(application_id, []).append(
            {
                "action": "UNDERWRITER_DECISION",
                "outcome": data.outcome.value,
                "comment": data.comment,
            }
        )
        return cast(ApplicationOut, self.service._out(item))

    def rescore(self, user_id: UUID, application_id: UUID) -> ApplicationOut:
        from typing import cast

        item = self.service._applications.get(application_id)
        if item is None:
            raise ApplicationError("APPLICATION_NOT_FOUND")
        self._audit.setdefault(application_id, []).append({"action": "RESCORE"})
        return cast(ApplicationOut, self.service._out(item))

    def metrics(self) -> MetricsOut:
        from collections import Counter

        statuses = Counter(item.status for item in self.service._applications.values())
        metrics = MetricsOut(
            total_applications=len(self.service._applications),
            automated_decisions=statuses[ApplicationStatus.APPROVED]
            + statuses[ApplicationStatus.COUNTER_OFFER]
            + statuses[ApplicationStatus.REJECTED],
            underwriting_decisions=statuses[ApplicationStatus.UNDERWRITING],
            approved=statuses[ApplicationStatus.APPROVED],
            counter_offer=statuses[ApplicationStatus.COUNTER_OFFER],
            rejected=statuses[ApplicationStatus.REJECTED],
        )
        return metrics
