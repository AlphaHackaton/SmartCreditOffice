"""Персоны-оракулы: единственный загрузчик personas.json → доменные типы.

Используют и тесты (tests/domain), и моки Dev 2. Числовые поля в JSON —
строками (деньги сохраняют масштаб, float не появляется).
"""

import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Final, TypedDict, cast

from app.domain.enums import BkiSubject, FnsStatus, LegalForm
from app.domain.scoring.inputs import (
    AccountData,
    BkiReport,
    CompanyData,
    FnsData,
    LoanRequest,
    ScoringInputs,
)

_PATH: Final[Path] = Path(__file__).resolve().parent / "personas.json"


class RawCompany(TypedDict):
    inn: str
    legal_form: str
    registered_at: str
    okved: str


class RawFns(TypedDict):
    status: str
    accounts_blocked: bool
    declared_revenue_12m: str | None
    tax_debt: str


class RawBkiReport(TypedDict):
    subject: str
    current_overdue_days: str
    max_overdue_days_12m: str
    max_overdue_days_24m: str
    inquiries_30d: str
    monthly_payments: str
    active_loans: str


class RawAccount(TypedDict):
    inflows: list[str]
    outflows: list[str]


class RawRequest(TypedDict):
    product_code: str
    amount: str
    term_months: str


class RawExpected(TypedDict):
    outcome: str
    route: str
    score: str | None
    grade: str | None
    offer_kinds: list[str]
    binding: str | None
    top_reasons: list[str]
    review_flags: list[str]


class RawPersona(TypedDict):
    id: str
    login: str
    as_of: str
    company: RawCompany
    fns: RawFns
    bki: list[RawBkiReport]
    account: RawAccount
    request: RawRequest
    expected: RawExpected


class RawPersonasData(TypedDict):
    personas: list[RawPersona]


def load_raw() -> RawPersonasData:
    """Сырой JSON персон (проверки данных и блока expected — в тестах)."""
    with _PATH.open(encoding="utf-8") as fh:
        data: RawPersonasData = cast(RawPersonasData, json.load(fh))
    return data


def persona_ids() -> tuple[str, ...]:
    """id всех персон в порядке файла."""
    personas: list[RawPersona] = load_raw()["personas"]
    return tuple(persona["id"] for persona in personas)


def _persona(persona_id: str) -> RawPersona:
    personas: list[RawPersona] = load_raw()["personas"]
    for persona in personas:
        if persona["id"] == persona_id:
            return persona
    raise KeyError(f"неизвестная персона {persona_id!r}")


def load_inputs(persona_id: str) -> ScoringInputs:
    """Снимок клиента (`ScoringInputs`) по id персоны."""
    raw = _persona(persona_id)
    company = raw["company"]
    fns = raw["fns"]
    declared = fns["declared_revenue_12m"]
    return ScoringInputs(
        as_of=date.fromisoformat(str(raw["as_of"])),
        company=CompanyData(
            inn=str(company["inn"]),
            legal_form=LegalForm(str(company["legal_form"])),
            registered_at=date.fromisoformat(str(company["registered_at"])),
            okved=str(company["okved"]),
        ),
        fns=FnsData(
            status=FnsStatus(str(fns["status"])),
            accounts_blocked=bool(fns["accounts_blocked"]),
            declared_revenue_12m=None if declared is None else Decimal(str(declared)),
            tax_debt=Decimal(str(fns["tax_debt"])),
        ),
        bki=tuple(
            BkiReport(
                subject=BkiSubject(str(report["subject"])),
                current_overdue_days=int(str(report["current_overdue_days"])),
                max_overdue_days_12m=int(str(report["max_overdue_days_12m"])),
                max_overdue_days_24m=int(str(report["max_overdue_days_24m"])),
                inquiries_30d=int(str(report["inquiries_30d"])),
                monthly_payments=Decimal(str(report["monthly_payments"])),
                active_loans=int(str(report["active_loans"])),
            )
            for report in raw["bki"]
        ),
        account=AccountData(
            inflows=tuple(Decimal(str(value)) for value in raw["account"]["inflows"]),
            outflows=tuple(Decimal(str(value)) for value in raw["account"]["outflows"]),
        ),
    )


def load_request(persona_id: str) -> LoanRequest:
    """Запрос персоны (`LoanRequest`) по id персоны."""
    raw = _persona(persona_id)["request"]
    return LoanRequest(
        product_code=str(raw["product_code"]),
        amount=Decimal(str(raw["amount"])),
        term_months=int(str(raw["term_months"])),
    )
