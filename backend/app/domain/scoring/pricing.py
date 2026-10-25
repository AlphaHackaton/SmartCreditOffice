"""Ценообразование: премия за срок и ставка по продукту (design.md §2).

Ставка = ключевая + спред продукта + премия за риск по грейду + премия за
срок; зажимается в коридор политики и квантуется до 0,01. Сумма кредита в
ценообразование не входит: ставка от суммы не зависит.
"""

from decimal import ROUND_HALF_UP, Decimal, localcontext

from ..enums import Grade
from ..errors import PolicyViolation
from ..money import RATE_Q
from .policy import Policy, Product


def _require_term(term_months: int) -> None:
    """Срок — положительное целое; не-int → TypeError, ≤ 0 → ValueError."""
    if isinstance(term_months, bool) or not isinstance(term_months, int):
        msg = f"term_months: ожидается int, получено {type(term_months).__name__}"
        raise TypeError(msg)
    if term_months <= 0:
        msg = f"term_months: срок должен быть положительным ({term_months})"
        raise ValueError(msg)


def term_premium(term_months: int, p: Policy) -> Decimal:
    """Премия за срок по таблице политики; срок больше последнего порога — PolicyViolation."""
    _require_term(term_months)
    if not p.term_premium:
        raise PolicyViolation("TERM_OUT_OF_RANGE", "в политике нет таблицы премий за срок")
    last_threshold = p.term_premium[-1][0]
    if term_months > last_threshold:
        raise PolicyViolation(
            "TERM_OUT_OF_RANGE",
            f"срок {term_months} больше максимального порога {last_threshold}",
            {"term_months": str(term_months), "max": str(last_threshold)},
        )
    for threshold, premium in p.term_premium:
        if term_months <= threshold:
            return premium
    raise PolicyViolation(
        "TERM_OUT_OF_RANGE",
        f"для срока {term_months} нет премии в таблице политики",
        {"term_months": str(term_months)},
    )


def price(product: Product, grade: Grade, term_months: int, p: Policy) -> Decimal:
    """Ставка продукта для грейда и срока; грейд D офферов не предполагает."""
    _require_term(term_months)
    if grade not in p.risk_premium:
        raise PolicyViolation(
            "GRADE_NOT_OFFERED",
            f"грейд {grade.value} не предполагает офферов",
            {"grade": grade.value},
        )
    with localcontext() as ctx:
        ctx.prec = 28
        raw = (
            p.key_rate_pct
            + product.spread_pct
            + p.risk_premium[grade]
            + term_premium(term_months, p)
        )
        lower = p.key_rate_pct + p.rate_floor_add
        upper = p.key_rate_pct + p.rate_cap_add
        clamped = min(max(raw, lower), upper)
        return clamped.quantize(RATE_Q, rounding=ROUND_HALF_UP)
