"""Synthetic ФНС adapter."""

from datetime import date
from decimal import Decimal

from app.domain.enums import FnsStatus, LegalForm
from app.domain.scoring.inputs import CompanyData, FnsData
from app.mocks.registry import PersonaRegistry


class MockFnsGateway:
    def __init__(self, registry: PersonaRegistry | None = None) -> None:
        self.registry = registry or PersonaRegistry()

    def get_company(self, inn: str) -> CompanyData:
        raw = self.registry.by_inn(inn)[1]["company"]
        return CompanyData(
            inn=str(raw["inn"]),
            legal_form=LegalForm(str(raw["legal_form"])),
            registered_at=date.fromisoformat(str(raw["registered_at"])),
            okved=str(raw["okved"]),
        )

    def get_declaration(self, inn: str) -> FnsData:
        raw = self.registry.by_inn(inn)[1]["fns"]
        revenue = raw["declared_revenue_12m"]
        return FnsData(
            status=FnsStatus(str(raw["status"])),
            accounts_blocked=bool(raw["accounts_blocked"]),
            declared_revenue_12m=None if revenue is None else Decimal(str(revenue)),
            tax_debt=Decimal(str(raw["tax_debt"])),
        )
