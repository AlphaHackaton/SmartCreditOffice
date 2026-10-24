"""Результаты решения: факторы, ограничения, офферы, итог.

Все dataclass frozen+slots. `client_text` заполняется в К5 (explain),
пока остаётся пустым.
"""

from dataclasses import dataclass
from decimal import Decimal

from ..enums import (
    ConstraintName,
    Grade,
    Impact,
    OfferKind,
    Outcome,
    ReasonCode,
    ReviewFlag,
    Route,
    Source,
)


@dataclass(frozen=True, slots=True)
class Factor:
    """Фактор решения: баллы, источник, влияние, строка для показа клиенту/банку.

    `value` — строка для показа («0.35», «45 дн.»); сравнения — по сырым Decimal.
    """

    code: ReasonCode
    source: Source
    value: str
    points: int
    max_points: int
    impact: Impact
    rule_id: str
    client_text: str = ""
    hint: str | None = None


@dataclass(frozen=True, slots=True)
class Constraint:
    """Ограничение лимита суммы; `binding` — связывающее (минимальное)."""

    name: ConstraintName
    limit: Decimal
    binding: bool


@dataclass(frozen=True, slots=True)
class OfferDraft:
    """Оффер клиенту: сумма кратна шагу, срок из сетки, ставка и платёж."""

    kind: OfferKind
    amount: Decimal
    term_months: int
    rate_pct: Decimal
    monthly_payment: Decimal
    overpayment: Decimal


@dataclass(frozen=True, slots=True)
class ScoringResult:
    """Полный результат `evaluate` (снимок уходит в JSONB через Dev 2)."""

    recommendation: Outcome
    route: Route
    score: int | None
    grade: Grade | None
    factors: tuple[Factor, ...]
    constraints: tuple[Constraint, ...]
    binding_constraint: ConstraintName | None
    offers: tuple[OfferDraft, ...]
    top_reasons: tuple[ReasonCode, ...]
    review_flags: tuple[ReviewFlag, ...]
    policy_version: str


@dataclass(frozen=True, slots=True)
class SimulationResult:
    """Результат `simulate`: предсказание без создания заявки."""

    predicted_outcome: Outcome
    requires_review: bool
    offers: tuple[OfferDraft, ...]
    constraints: tuple[Constraint, ...]
    binding_constraint: ConstraintName | None
    max_amount_for_term: Decimal
    headroom: Decimal


@dataclass(frozen=True, slots=True)
class PreApproval:
    """Предодобрение: максимальный доступный оффер по продукту без запроса."""

    product_code: str
    amount: Decimal
    term_months: int
    rate_pct: Decimal
    binding: ConstraintName
