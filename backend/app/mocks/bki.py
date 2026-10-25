"""Synthetic БКИ adapter."""

from typing import Literal

from app.domain.enums import BkiSubject
from app.domain.scoring.inputs import BkiReport
from app.mocks.registry import PersonaRegistry


class MockBkiGateway:
    def __init__(self, registry: PersonaRegistry | None = None) -> None:
        self.registry = registry or PersonaRegistry()

    def get_report(self, inn: str, subject: Literal["COMPANY", "PERSON"]) -> BkiReport:
        reports = self.registry.by_inn(inn)[1]["bki"]
        requested = BkiSubject(subject)
        for report in reports:
            if BkiSubject(str(report["subject"])) == requested:
                from decimal import Decimal

                return BkiReport(
                    subject=requested,
                    current_overdue_days=int(str(report["current_overdue_days"])),
                    max_overdue_days_12m=int(str(report["max_overdue_days_12m"])),
                    max_overdue_days_24m=int(str(report["max_overdue_days_24m"])),
                    inquiries_30d=int(str(report["inquiries_30d"])),
                    monthly_payments=Decimal(str(report["monthly_payments"])),
                    active_loans=int(str(report["active_loans"])),
                )
        raise KeyError(f"no {subject} BKI report for {inn}")
