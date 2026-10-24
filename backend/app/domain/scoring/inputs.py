"""Входные данные скоринга: снимок клиента на дату `as_of` и запрос.

Все dataclass frozen+slots; проверки — в `__post_init__`.
Деньги — только `Decimal` (float в рядах счёта → TypeError).
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from ..enums import BkiSubject, FnsStatus, LegalForm


@dataclass(frozen=True, slots=True)
class CompanyData:
    """Реквизиты заёмщика. ИНН: 12 цифр у ИП, 10 у ООО (контрольная сумма)."""

    inn: str
    legal_form: LegalForm
    registered_at: date
    okved: str


@dataclass(frozen=True, slots=True)
class FnsData:
    """Снимок ФНС. Декларации может не быть (None)."""

    status: FnsStatus
    accounts_blocked: bool
    declared_revenue_12m: Decimal | None
    tax_debt: Decimal


@dataclass(frozen=True, slots=True)
class BkiReport:
    """Отчёт БКИ по одному субъекту (COMPANY или PERSON)."""

    subject: BkiSubject
    current_overdue_days: int
    max_overdue_days_12m: int
    max_overdue_days_24m: int
    inquiries_30d: int
    monthly_payments: Decimal
    active_loans: int


@dataclass(frozen=True, slots=True)
class AccountData:
    """Хронология счёта: последний элемент — последний полный месяц.

    `outflows` НЕ включают платежи по существующим кредитам.
    Ряды одной длины, суммы неотрицательные, только `Decimal`.
    """

    inflows: tuple[Decimal, ...]
    outflows: tuple[Decimal, ...]

    def __post_init__(self) -> None:
        for name, row in (("inflows", self.inflows), ("outflows", self.outflows)):
            for value in row:
                if not isinstance(value, Decimal):
                    msg = f"{name}: ожидаются Decimal, получено {type(value).__name__}"
                    raise TypeError(msg)
                if value < 0:
                    msg = f"{name}: суммы не могут быть отрицательными ({value})"
                    raise ValueError(msg)
        if len(self.inflows) != len(self.outflows):
            msg = (
                "inflows и outflows должны быть одной длины: "
                f"{len(self.inflows)} != {len(self.outflows)}"
            )
            raise ValueError(msg)


@dataclass(frozen=True, slots=True)
class ScoringInputs:
    """Снимок клиента на дату `as_of` (моки ФНС/БКИ/счёта Dev 2 дают эти данные)."""

    as_of: date
    company: CompanyData
    fns: FnsData
    bki: tuple[BkiReport, ...]
    account: AccountData


@dataclass(frozen=True, slots=True)
class LoanRequest:
    """Запрос клиента: продукт, сумма, срок. Валидация — `policy.validate_request` (К4)."""

    product_code: str
    amount: Decimal
    term_months: int
