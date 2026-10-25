"""Bank-contour operations over the in-memory demo service."""

from collections import Counter
from typing import Any, cast
from uuid import UUID

from app.api.schemas import (
    ApplicationOut,
    BankApplicationSummary,
    BankDossierOut,
    BankQueueOut,
    MetricsOut,
    UnderwriterDecisionIn,
)
from app.domain.enums import ApplicationStatus


class BankService:
    def __init__(self, application_service: Any) -> None:
        self.service = application_service
        self._audit: dict[UUID, list[dict[str, Any]]] = {}

    def queue(self) -> BankQueueOut:
        items = []
        for item in self.service._applications.values():
            items.append(
                BankApplicationSummary(
                    id=item.id,
                    company_id=item.company_id,
                    status=item.status,
                    product_code=item.product_code,
                    amount=item.amount,
                    term_months=item.term_months,
                    version=item.version,
                )
            )
        return BankQueueOut(items=items)

    def dossier(self, application_id: UUID) -> BankDossierOut:
        item = self.service._applications.get(application_id)
        if item is None:
            raise ValueError("APPLICATION_NOT_FOUND")
        return BankDossierOut(
            application=self.service._out(item),
            inputs_snapshot={},
            audit=self._audit.get(application_id, []),
        )

    def decide(self, application_id: UUID, data: UnderwriterDecisionIn) -> ApplicationOut:
        item = self.service._applications.get(application_id)
        if item is None:
            raise ValueError("APPLICATION_NOT_FOUND")
        if item.status != ApplicationStatus.UNDERWRITING:
            raise ValueError("INVALID_STATUS")
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

    def rescore(self, application_id: UUID) -> ApplicationOut:
        item = self.service._applications.get(application_id)
        if item is None:
            raise ValueError("APPLICATION_NOT_FOUND")
        self._audit.setdefault(application_id, []).append({"action": "RESCORE"})
        return cast(ApplicationOut, self.service._out(item))

    def metrics(self) -> MetricsOut:
        statuses = Counter(item.status for item in self.service._applications.values())
        return MetricsOut(
            total_applications=len(self.service._applications),
            automated_decisions=statuses[ApplicationStatus.APPROVED]
            + statuses[ApplicationStatus.COUNTER_OFFER]
            + statuses[ApplicationStatus.REJECTED],
            underwriting_decisions=statuses[ApplicationStatus.UNDERWRITING],
            approved=statuses[ApplicationStatus.APPROVED],
            counter_offer=statuses[ApplicationStatus.COUNTER_OFFER],
            rejected=statuses[ApplicationStatus.REJECTED],
        )
