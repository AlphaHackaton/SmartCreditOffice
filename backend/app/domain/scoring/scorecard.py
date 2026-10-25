"""Скоринговая карта M1–M5 (design.md §2): баллы и грейд, без запроса.

Карта не зависит от параметров запроса: цикл «грейд -> ставка -> платёж ->
нагрузка -> грейд» разорван, поэтому в `score` нет `LoanRequest`.
"""

from collections.abc import Sequence
from decimal import Decimal
from typing import Final

from ..enums import Grade, Impact, ReasonCode, Source
from .metrics import Metrics
from .policy import Bin, Policy
from .result import Factor

#: Максимум шкалы: итог зажимается в [0, 100].
TOTAL_MAX: Final = 100


def pick_bin(value: Decimal, bins: Sequence[Bin]) -> Bin:
    """Бин полуинтервала `[prev.upper, upper)` для значения."""
    if not bins:
        raise ValueError("пустой список бинов")
    for item in bins:
        if item.upper is None or value < item.upper:
            return item
    return bins[-1]


def _max_points(bins: Sequence[Bin]) -> int:
    return max(item.points for item in bins)


def _factor(
    *,
    code: ReasonCode,
    source: Source,
    value: str,
    points: int,
    max_points: int,
    rule_id: str,
) -> Factor:
    """Фактор карты: полные баллы — POSITIVE, потерянные — NEGATIVE."""
    impact = Impact.POSITIVE if max_points > 0 and points >= max_points else Impact.NEGATIVE
    return Factor(
        code=code,
        source=source,
        value=value,
        points=points,
        max_points=max_points,
        impact=impact,
        rule_id=rule_id,
    )


def _turnover_factor(m: Metrics, p: Policy) -> Factor:
    bins = p.bins_turnover_cv
    max_points = _max_points(bins)
    if m.cv is None:
        selected = bins[-1]
        value = "нет поступлений"
    else:
        selected = pick_bin(m.cv, bins)
        value = f"{m.cv:.2f}"
    return _factor(
        code=selected.code,
        source=Source.ACCOUNT,
        value=value,
        points=selected.points,
        max_points=max_points,
        rule_id="M1",
    )


def _debt_burden_factor(m: Metrics, p: Policy) -> Factor:
    bins = p.bins_debt_burden
    max_points = _max_points(bins)
    if m.debt_burden is None:
        selected = bins[-1]
        value = "н/д"
    else:
        selected = pick_bin(m.debt_burden, bins)
        value = f"{m.debt_burden:.2f}"
    return _factor(
        code=selected.code,
        source=Source.BKI,
        value=value,
        points=selected.points,
        max_points=max_points,
        rule_id="M2",
    )


def _overdue_factor(m: Metrics, p: Policy) -> Factor:
    bins = p.bins_overdue_24m
    selected = pick_bin(Decimal(m.worst_overdue_24m), bins)
    return _factor(
        code=selected.code,
        source=Source.BKI,
        value=f"{m.worst_overdue_24m} дн.",
        points=selected.points,
        max_points=_max_points(bins),
        rule_id="M3",
    )


def _fns_factor(m: Metrics, p: Policy) -> Factor:
    bins = p.bins_fns_mismatch
    max_points = _max_points(bins)
    if m.fns_mismatch is None:
        return _factor(
            code=ReasonCode.FNS_NO_DECLARATION,
            source=Source.FNS,
            value="нет декларации",
            points=0,
            max_points=max_points,
            rule_id="M4",
        )
    selected = pick_bin(m.fns_mismatch, bins)
    return _factor(
        code=selected.code,
        source=Source.FNS,
        value=f"{m.fns_mismatch:.1%}",
        points=selected.points,
        max_points=max_points,
        rule_id="M4",
    )


def _business_age_factor(m: Metrics, p: Policy) -> Factor:
    bins = p.bins_business_age
    selected = pick_bin(Decimal(m.business_age_months), bins)
    return _factor(
        code=selected.code,
        source=Source.FNS,
        value=f"{m.business_age_months} мес.",
        points=selected.points,
        max_points=_max_points(bins),
        rule_id="M5",
    )


def score(m: Metrics, p: Policy) -> tuple[int, Grade, tuple[Factor, ...]]:
    """Баллы M1–M5 (зажаты в [0, 100]), грейд и факторы карты."""
    factors = [_turnover_factor(m, p), _debt_burden_factor(m, p), _overdue_factor(m, p)]
    if m.inquiries_30d > p.inquiries_threshold:
        factors.append(
            Factor(
                code=ReasonCode.BKI_MANY_INQUIRIES,
                source=Source.BKI,
                value=f"{m.inquiries_30d} запр.",
                points=p.inquiries_penalty,
                max_points=0,
                impact=Impact.NEGATIVE,
                rule_id="M3_INQUIRIES",
            )
        )
    factors.append(_fns_factor(m, p))
    factors.append(_business_age_factor(m, p))
    total = max(0, min(TOTAL_MAX, sum(factor.points for factor in factors)))
    return total, grade_for(total, p), tuple(factors)


def grade_for(score: int, p: Policy) -> Grade:
    """Грейд по порогам политики: A >= 75, B >= 60, C >= 45, иначе D."""
    for grade, threshold in p.grade_thresholds:
        if score >= threshold:
            return grade
    return Grade.D
