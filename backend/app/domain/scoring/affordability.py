"""Платёжеспособность и лимит суммы (design.md §2, §3).

Лимит — минимум четырёх ограничений: DSCR, выручка, потолок грейда и
максимум продукта. Внутри `amount_limit` лимит не округляется: округление
до шага делает только контроффер. При равенстве ограничений связывающим
считается первое по порядку `ConstraintName`.
"""

from decimal import Decimal, localcontext

from ..enums import ConstraintName, Grade
from ..money import max_principal
from .metrics import Metrics
from .policy import Policy, Product
from .pricing import price
from .result import Constraint


def payment_capacity(m: Metrics, p: Policy) -> Decimal:
    """Максимальный платёж по DSCR: `max(0, NCF / dscr_min − существующие платежи)`."""
    if p.dscr_min <= 0:
        msg = f"dscr_min: должен быть положительным ({p.dscr_min})"
        raise ValueError(msg)
    with localcontext() as ctx:
        ctx.prec = 28
        capacity = m.ncf / p.dscr_min - m.existing_payments
    return max(Decimal("0"), capacity)


def amount_limit(
    m: Metrics,
    product: Product,
    grade: Grade,
    term_months: int,
    p: Policy,
) -> tuple[Decimal, tuple[Constraint, ...], ConstraintName]:
    """Лимит суммы без округления, все ограничения и связывающее (tie-break по enum)."""
    rate = price(product, grade, term_months, p)
    capacity = payment_capacity(m, p)
    with localcontext() as ctx:
        ctx.prec = 28
        dscr_limit = max_principal(capacity, rate, term_months)
        revenue_limit = p.revenue_multiplier * m.inflows_12m

    candidates = (
        (ConstraintName.DSCR, max(Decimal("0"), dscr_limit)),
        (ConstraintName.REVENUE, max(Decimal("0"), revenue_limit)),
        (ConstraintName.GRADE_CAP, max(Decimal("0"), p.grade_caps[grade])),
        (ConstraintName.PRODUCT_MAX, max(Decimal("0"), product.max_amount)),
    )

    binding_name, limit = candidates[0]
    for name, value in candidates[1:]:
        if value < limit:
            binding_name, limit = name, value

    constraints = tuple(
        Constraint(name=name, limit=value, binding=name is binding_name)
        for name, value in candidates
    )
    return limit, constraints, binding_name


def term_grid(product: Product, p: Policy) -> tuple[int, ...]:
    """Сетка сроков продукта: шаг политики, верхний срок всегда включён."""
    if p.term_step <= 0:
        msg = f"term_step: шаг должен быть положительным ({p.term_step})"
        raise ValueError(msg)
    if product.min_term <= 0 or product.max_term < product.min_term:
        msg = (
            "product: границы срока должны быть положительными и упорядоченными "
            f"({product.min_term}…{product.max_term})"
        )
        raise ValueError(msg)
    terms = set(range(product.min_term, product.max_term + 1, p.term_step))
    terms.add(product.max_term)
    return tuple(sorted(terms))
