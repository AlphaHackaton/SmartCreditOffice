"""Стоп-факторы и достаточность данных (design.md §2).

Стоп-факторы собираются ВСЕ, без раннего выхода: текущая просрочка,
просрочка >= 90 дней за 12 месяцев, возраст бизнеса меньше минимума,
статус ФНС не ACTIVE, приостановленные счета.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Final

from ..enums import FnsStatus, Impact, ReasonCode, Source
from .inputs import ScoringInputs
from .metrics import Metrics
from .policy import Policy
from .result import Factor


@dataclass(frozen=True, slots=True)
class _Rule:
    """Правило стоп-фактора: проверка снимка и текст значения фактора."""

    code: ReasonCode
    source: Source
    rule_id: str
    triggered: Callable[[ScoringInputs, Metrics, Policy], bool]
    label: Callable[[ScoringInputs, Metrics, Policy], str]


#: Канонический порядок сбора (порядок кодов `ReasonCode`).
_KNOCKOUTS: Final[tuple[_Rule, ...]] = (
    _Rule(
        code=ReasonCode.BKI_CURRENT_OVERDUE,
        source=Source.BKI,
        rule_id="KO_BKI_CURRENT_OVERDUE",
        triggered=lambda inp, m, p: m.current_overdue > 0,
        label=lambda inp, m, p: f"{m.current_overdue} дн.",
    ),
    _Rule(
        code=ReasonCode.BKI_OVERDUE_90_12M,
        source=Source.BKI,
        rule_id="KO_BKI_OVERDUE_90_12M",
        triggered=lambda inp, m, p: m.worst_overdue_12m >= 90,
        label=lambda inp, m, p: f"{m.worst_overdue_12m} дн.",
    ),
    _Rule(
        code=ReasonCode.BUSINESS_TOO_YOUNG,
        source=Source.FNS,
        rule_id="KO_BUSINESS_TOO_YOUNG",
        triggered=lambda inp, m, p: m.business_age_months < p.min_business_age_months,
        label=lambda inp, m, p: f"{m.business_age_months} мес.",
    ),
    _Rule(
        code=ReasonCode.FNS_INACTIVE,
        source=Source.FNS,
        rule_id="KO_FNS_INACTIVE",
        triggered=lambda inp, m, p: inp.fns.status != FnsStatus.ACTIVE,
        label=lambda inp, m, p: str(inp.fns.status),
    ),
    _Rule(
        code=ReasonCode.FNS_ACCOUNTS_BLOCKED,
        source=Source.FNS,
        rule_id="KO_FNS_ACCOUNTS_BLOCKED",
        triggered=lambda inp, m, p: inp.fns.accounts_blocked,
        label=lambda inp, m, p: "да",
    ),
)


def check_knockouts(inp: ScoringInputs, m: Metrics, p: Policy) -> tuple[Factor, ...]:
    """Все сработавшие стоп-факторы в каноническом порядке кодов."""
    return tuple(
        Factor(
            code=rule.code,
            source=rule.source,
            value=rule.label(inp, m, p),
            points=0,
            max_points=0,
            impact=Impact.KNOCKOUT,
            rule_id=rule.rule_id,
        )
        for rule in _KNOCKOUTS
        if rule.triggered(inp, m, p)
    )


def check_data_sufficiency(m: Metrics, inp: ScoringInputs, p: Policy) -> Factor | None:
    """`INSUFFICIENT_DATA`, если данных мало (история счёта короче минимума)."""
    if m.history_months >= p.min_history_months:
        return None
    return Factor(
        code=ReasonCode.INSUFFICIENT_DATA,
        source=Source.ACCOUNT,
        value=f"{m.history_months} мес.",
        points=0,
        max_points=0,
        impact=Impact.KNOCKOUT,
        rule_id="DATA_HISTORY",
    )
