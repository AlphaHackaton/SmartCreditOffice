"""Денежная арифметика кредитного конвейера: только Decimal, без float.

Правила (design.md §5): все вычисления — в `localcontext` с `prec=28`;
округления ровно на выходе — `to_kopecks` для платежей (HALF_UP) и
`round_down` для лимитов (к шагу). Внутри формул округлений нет.
Литералы `Decimal` — только из строки.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Context, Decimal, localcontext
from typing import Final

MONEY_Q: Final = Decimal("0.01")
RATE_Q: Final = Decimal("0.01")


@contextmanager
def _prec28() -> Iterator[Context]:
    """Контекст вычислений: prec=28, изолирован от окружения вызывающего."""
    with localcontext() as ctx:
        ctx.prec = 28
        yield ctx


def _require_decimal(name: str, value: Decimal) -> None:
    """Деньги — только Decimal: float и прочие типы → TypeError."""
    if not isinstance(value, Decimal):
        msg = f"{name}: ожидаются Decimal, получено {type(value).__name__}"
        raise TypeError(msg)


def _require_term(name: str, value: int) -> None:
    """Срок — положительное целое; не-int → TypeError, ≤ 0 → ValueError."""
    if isinstance(value, bool) or not isinstance(value, int):
        msg = f"{name}: ожидается int, получено {type(value).__name__}"
        raise TypeError(msg)
    if value <= 0:
        msg = f"{name}: срок должен быть положительным ({value})"
        raise ValueError(msg)


def _require_non_negative(name: str, value: Decimal) -> None:
    if value < 0:
        msg = f"{name}: сумма не может быть отрицательной ({value})"
        raise ValueError(msg)


def monthly_rate(annual_rate_pct: Decimal) -> Decimal:
    """Месячная доля ставки: annual_rate_pct / 1200, без округления."""
    _require_decimal("annual_rate_pct", annual_rate_pct)
    with _prec28():
        return annual_rate_pct / Decimal("1200")  # 100 (пцт → доля) × 12 (мес)


def annuity_payment(principal: Decimal, annual_rate_pct: Decimal, term_months: int) -> Decimal:
    """Аннуитетный платёж; на выходе — копейки (HALF_UP)."""
    _require_decimal("principal", principal)
    _require_decimal("annual_rate_pct", annual_rate_pct)
    _require_term("term_months", term_months)
    _require_non_negative("principal", principal)
    with _prec28():
        rate = monthly_rate(annual_rate_pct)
        if rate.is_zero():
            return to_kopecks(principal / term_months)
        factor = (Decimal("1") + rate) ** term_months
        payment = principal * rate * factor / (factor - Decimal("1"))
        return to_kopecks(payment)


def max_principal(payment: Decimal, annual_rate_pct: Decimal, term_months: int) -> Decimal:
    """Максимальная сумма кредита под платёж (обратная аннуитету), БЕЗ округления."""
    _require_decimal("payment", payment)
    _require_decimal("annual_rate_pct", annual_rate_pct)
    _require_term("term_months", term_months)
    with _prec28():
        rate = monthly_rate(annual_rate_pct)
        if rate.is_zero():
            return payment * term_months
        factor = (Decimal("1") + rate) ** term_months
        return payment * (factor - Decimal("1")) / (rate * factor)


def overpayment(payment: Decimal, term_months: int, principal: Decimal) -> Decimal:
    """Переплата: payment × term_months − principal, в копейках."""
    _require_decimal("payment", payment)
    _require_decimal("principal", principal)
    _require_term("term_months", term_months)
    _require_non_negative("principal", principal)
    with _prec28():
        return to_kopecks(payment * term_months - principal)


def round_down(value: Decimal, step: Decimal) -> Decimal:
    """Округление вниз к шагу; value < 0 → 0."""
    _require_decimal("value", value)
    _require_decimal("step", step)
    with _prec28():
        if value <= 0:
            return Decimal("0")
        return (value / step).to_integral_value(rounding=ROUND_FLOOR) * step


def to_kopecks(value: Decimal) -> Decimal:
    """Копейки: ROUND_HALF_UP (не банковское)."""
    _require_decimal("value", value)
    with _prec28():
        return value.quantize(MONEY_Q, rounding=ROUND_HALF_UP)
