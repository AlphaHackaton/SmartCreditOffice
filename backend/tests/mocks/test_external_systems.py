from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.enums import BkiSubject
from app.mocks.account import MockAccountGateway
from app.mocks.bki import MockBkiGateway
from app.mocks.core_banking import MockCoreBanking
from app.mocks.fns import MockFnsGateway
from app.mocks.registry import PersonaRegistry, SourceUnavailable
from app.seed.personas import persona_ids


def test_all_personas_are_available_through_fns_bki_and_account() -> None:
    registry = PersonaRegistry()
    fns = MockFnsGateway(registry)
    bki = MockBkiGateway(registry)
    account = MockAccountGateway(registry)

    for persona_id in persona_ids():
        raw = registry.persona(persona_id)
        inn = str(raw["company"]["inn"])
        company = fns.get_company(inn)
        declaration = fns.get_declaration(inn)
        report = bki.get_report(inn, "COMPANY")
        company_id = uuid4()
        registry.bind_company(company_id, inn)
        turnover = account.get_turnover(company_id)

        assert company.inn == inn
        assert declaration.tax_debt >= 0
        assert report.subject == BkiSubject.COMPANY
        assert len(turnover.inflows) == len(turnover.outflows)
        assert len(turnover.inflows) == min(12, len(raw["account"]["inflows"]))


def test_mock_results_are_deterministic() -> None:
    gateway = MockFnsGateway()
    inn = str(gateway.registry.persona("p1_ideal")["company"]["inn"])
    assert gateway.get_company(inn) == gateway.get_company(inn)
    assert gateway.get_declaration(inn) == gateway.get_declaration(inn)


def test_registry_can_simulate_unavailable_source() -> None:
    registry = PersonaRegistry()
    registry.set_unavailable("p3_reduced")
    inn = str(registry.persona("p3_reduced")["company"]["inn"])

    with pytest.raises(SourceUnavailable, match="p3_reduced"):
        MockFnsGateway(registry).get_company(inn)


def test_core_banking_returns_deterministic_demo_account() -> None:
    application_id = uuid4()
    account = MockCoreBanking().open_loan_account(application_id, Decimal("100.00"))
    assert account == f"DEMO-{application_id.hex[:12].upper()}"

    with pytest.raises(ValueError, match="POSITIVE"):
        MockCoreBanking().open_loan_account(application_id, Decimal("0"))
