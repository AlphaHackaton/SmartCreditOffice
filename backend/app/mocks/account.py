"""Synthetic account turnover adapter."""

from decimal import Decimal
from uuid import UUID

from app.domain.scoring.inputs import AccountData
from app.mocks.registry import PersonaRegistry


class MockAccountGateway:
    def __init__(self, registry: PersonaRegistry | None = None) -> None:
        self.registry = registry or PersonaRegistry()

    def get_turnover(self, company_id: UUID, months: int = 12) -> AccountData:
        raw = self.registry.persona_for_company(company_id)[1]["account"]
        inflows = tuple(Decimal(str(value)) for value in raw["inflows"][-months:])
        outflows = tuple(Decimal(str(value)) for value in raw["outflows"][-months:])
        return AccountData(inflows=inflows, outflows=outflows)
