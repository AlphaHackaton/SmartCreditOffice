"""Политика кредитования v1 (значения — design.md §2).

`POLICY_V1` immutable: `Mapping`-поля обёрнуты в `MappingProxyType`.
`version` и `with_key_rate` реализуются в К4.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType
from typing import Final

from ..enums import Grade, ReasonCode
from ..errors import PolicyViolation


@dataclass(frozen=True, slots=True)
class Bin:
    """Бин полуинтервала [prev.upper, upper); последний бин — `upper is None`."""

    upper: Decimal | None
    points: int
    code: ReasonCode


@dataclass(frozen=True, slots=True)
class Product:
    """Кредитный продукт: границы суммы/срока и спред к ключевой ставке."""

    code: str
    name: str
    min_amount: Decimal
    max_amount: Decimal
    min_term: int
    max_term: int
    spread_pct: Decimal


@dataclass(frozen=True, slots=True)
class Policy:
    """Кредитная политика: продукты, ценообразование, лимиты, скоринговая карта."""

    name: str
    key_rate_pct: Decimal
    products: tuple[Product, ...]
    risk_premium: Mapping[Grade, Decimal]
    term_premium: tuple[tuple[int, Decimal], ...]
    rate_floor_add: Decimal
    rate_cap_add: Decimal
    dscr_min: Decimal
    revenue_multiplier: Decimal
    grade_caps: Mapping[Grade, Decimal]
    auto_limit: Decimal
    amount_step: Decimal
    term_step: int
    grade_thresholds: tuple[tuple[Grade, int], ...]
    min_history_months: int
    min_business_age_months: int
    inquiries_threshold: int
    inquiries_penalty: int
    bins_turnover_cv: tuple[Bin, ...]
    bins_debt_burden: tuple[Bin, ...]
    bins_overdue_24m: tuple[Bin, ...]
    bins_fns_mismatch: tuple[Bin, ...]
    bins_business_age: tuple[Bin, ...]

    def product(self, code: str) -> Product:
        """Продукт по коду; неизвестный код — PolicyViolation(UNKNOWN_PRODUCT)."""
        for item in self.products:
            if item.code == code:
                return item
        raise PolicyViolation("UNKNOWN_PRODUCT", f"неизвестный продукт {code!r}", {"product": code})

    @property
    def version(self) -> str:
        """Стабильная версия из содержимого (канонический JSON, sha256) — К4."""
        raise NotImplementedError("version — К4")

    def with_key_rate(self, key_rate_pct: Decimal) -> "Policy":
        """Новая политика с другой ключевой ставкой; исходная не меняется — К4."""
        raise NotImplementedError("with_key_rate — К4")


#: Политика v1: ключевая ставка — плейсхолдер 16,50 (сверка с cbr.ru перед сдачей).
POLICY_V1: Final[Policy] = Policy(
    name="v1",
    key_rate_pct=Decimal("16.50"),
    products=(
        Product(
            code="WC_FLEX",
            name="Оборотный (гибкий)",
            min_amount=Decimal("300000.00"),
            max_amount=Decimal("10000000.00"),
            min_term=6,
            max_term=36,
            spread_pct=Decimal("4.00"),
        ),
        Product(
            code="CAPEX",
            name="Инвестиционный",
            min_amount=Decimal("500000.00"),
            max_amount=Decimal("15000000.00"),
            min_term=12,
            max_term=60,
            spread_pct=Decimal("3.00"),
        ),
    ),
    risk_premium=MappingProxyType(
        {Grade.A: Decimal("0.00"), Grade.B: Decimal("2.00"), Grade.C: Decimal("4.00")}
    ),
    term_premium=(
        (12, Decimal("0.00")),
        (24, Decimal("0.50")),
        (36, Decimal("1.00")),
        (60, Decimal("1.50")),
    ),
    rate_floor_add=Decimal("3.00"),
    rate_cap_add=Decimal("12.00"),
    dscr_min=Decimal("1.30"),
    revenue_multiplier=Decimal("0.40"),
    grade_caps=MappingProxyType(
        {
            Grade.A: Decimal("10000000.00"),
            Grade.B: Decimal("5000000.00"),
            Grade.C: Decimal("3000000.00"),
        }
    ),
    auto_limit=Decimal("5000000.00"),
    amount_step=Decimal("10000.00"),
    term_step=6,
    grade_thresholds=((Grade.A, 75), (Grade.B, 60), (Grade.C, 45)),
    min_history_months=3,
    min_business_age_months=3,
    inquiries_threshold=5,
    inquiries_penalty=-5,
    bins_turnover_cv=(
        Bin(upper=Decimal("0.25"), points=20, code=ReasonCode.TURNOVER_STABLE),
        Bin(upper=Decimal("0.50"), points=12, code=ReasonCode.TURNOVER_MODERATE),
        Bin(upper=None, points=4, code=ReasonCode.TURNOVER_VOLATILE),
    ),
    bins_debt_burden=(
        Bin(upper=Decimal("0.10"), points=20, code=ReasonCode.DEBT_BURDEN_NONE),
        Bin(upper=Decimal("0.35"), points=12, code=ReasonCode.DEBT_BURDEN_MODERATE),
        Bin(upper=Decimal("0.60"), points=5, code=ReasonCode.DEBT_BURDEN_HIGH),
        Bin(upper=None, points=0, code=ReasonCode.DEBT_BURDEN_CRITICAL),
    ),
    bins_overdue_24m=(
        Bin(upper=Decimal("1"), points=25, code=ReasonCode.BKI_CLEAN),
        Bin(upper=Decimal("30"), points=15, code=ReasonCode.BKI_PAST_OVERDUE_MINOR),
        Bin(upper=None, points=5, code=ReasonCode.BKI_PAST_OVERDUE_MAJOR),
    ),
    bins_fns_mismatch=(
        Bin(upper=Decimal("0.20"), points=15, code=ReasonCode.FNS_MATCH),
        Bin(upper=Decimal("0.40"), points=8, code=ReasonCode.FNS_MISMATCH_MODERATE),
        Bin(upper=None, points=0, code=ReasonCode.FNS_MISMATCH),
    ),
    bins_business_age=(
        Bin(upper=Decimal("6"), points=0, code=ReasonCode.BUSINESS_VERY_YOUNG),
        Bin(upper=Decimal("12"), points=8, code=ReasonCode.BUSINESS_YOUNG),
        Bin(upper=Decimal("36"), points=15, code=ReasonCode.BUSINESS_ESTABLISHED),
        Bin(upper=None, points=20, code=ReasonCode.BUSINESS_MATURE),
    ),
)
