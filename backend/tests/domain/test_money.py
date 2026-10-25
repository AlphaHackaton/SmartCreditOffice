"""Тесты денежной арифметики К1: аннуитет, обратимость, округления, валидация."""

from collections.abc import Callable
from decimal import Decimal
from itertools import pairwise
from typing import Any, cast

import pytest

from app.domain.money import (
    annuity_payment,
    max_principal,
    monthly_rate,
    overpayment,
    round_down,
    to_kopecks,
)

#: Эталон P1 из design.md §4: 2 млн ₽, 21,00 %, 24 мес → платёж 102 770 ± 10 ₽.
P1_PAYMENT = Decimal("102770.00")
P1_TOLERANCE = Decimal("10.00")

#: Сетка обратимости: платёж × ставка × срок (36 комбинаций).
PRINCIPALS = (Decimal("50000.00"), Decimal("103456.78"), Decimal("1000000.00"))
RATES = (Decimal("0.00"), Decimal("19.00"), Decimal("33.00"))
TERMS = (6, 12, 36, 60)
STEP = Decimal("10000.00")

# --- аннуитет -------------------------------------------------------------------------


def test_annuity_payment_p1_reference() -> None:
    payment = annuity_payment(Decimal("2000000.00"), Decimal("21.00"), 24)
    assert abs(payment - P1_PAYMENT) <= P1_TOLERANCE


def test_annuity_payment_zero_rate_divides_principal() -> None:
    # ставка 0 — без деления на ноль: платёж равен principal / n
    assert annuity_payment(Decimal("1200000.00"), Decimal("0.00"), 12) == Decimal("100000.00")


def test_annuity_payment_single_term_compounds_once() -> None:
    # n = 1: платёж равен principal × (1 + i)
    payment = annuity_payment(Decimal("2000000.00"), Decimal("21.00"), 1)
    assert payment == Decimal("2035000.00")


def test_annuity_payment_decreases_with_term() -> None:
    principal = Decimal("1000000.00")
    for rate in (Decimal("0.00"), Decimal("19.00")):
        payments = [annuity_payment(principal, rate, term) for term in TERMS]
        assert all(a > b for a, b in pairwise(payments)), rate


def test_annuity_payment_increases_with_rate() -> None:
    principal = Decimal("1000000.00")
    for term in TERMS:
        payments = [annuity_payment(principal, rate, term) for rate in RATES]
        assert all(a < b for a, b in pairwise(payments)), term


# --- обратимость: лимит → платёж ------------------------------------------------------


@pytest.mark.parametrize("term", TERMS)
@pytest.mark.parametrize("rate", RATES, ids=[str(r) for r in RATES])
@pytest.mark.parametrize("payment", PRINCIPALS, ids=[str(p) for p in PRINCIPALS])
def test_rounded_max_principal_is_affordable(payment: Decimal, rate: Decimal, term: int) -> None:
    """Инвариант: annuity_payment(round_down(max_principal(P, r, n)), r, n) ≤ P."""
    principal = round_down(max_principal(payment, rate, term), STEP)
    assert annuity_payment(principal, rate, term) <= payment


# --- округления -----------------------------------------------------------------------


def test_round_down_floors_to_step_and_clamps_negative() -> None:
    assert round_down(Decimal("1219999.99"), STEP) == Decimal("1210000")
    assert round_down(Decimal("-5.00"), STEP) == Decimal("0")


def test_to_kopecks_is_half_up_not_bankers() -> None:
    # 0.005 — ровно на границе: HALF_UP → 0.01, банковское (HALF_EVEN) дало бы 0.00
    assert to_kopecks(Decimal("0.005")) == Decimal("0.01")


# --- валидация входов -----------------------------------------------------------------

#: В тесты намеренно передаётся float: деньги в домене — только Decimal.
_FLOAT_CALLS: tuple[tuple[str, Callable[[], object]], ...] = (
    ("monthly_rate", lambda: monthly_rate(cast(Any, 21.0))),
    ("annuity.principal", lambda: annuity_payment(cast(Any, 1000.0), Decimal("21.00"), 12)),
    ("annuity.rate", lambda: annuity_payment(Decimal("1000.00"), cast(Any, 21.0), 12)),
    (
        "annuity.term",
        lambda: annuity_payment(Decimal("1000.00"), Decimal("21.00"), cast(Any, 12.0)),
    ),
    ("max_principal.payment", lambda: max_principal(cast(Any, 100.0), Decimal("21.00"), 12)),
    ("max_principal.rate", lambda: max_principal(Decimal("100.00"), cast(Any, 21.0), 12)),
    (
        "max_principal.term",
        lambda: max_principal(Decimal("100.00"), Decimal("21.00"), cast(Any, 12.0)),
    ),
    ("overpayment.payment", lambda: overpayment(cast(Any, 100.0), 12, Decimal("1000.00"))),
    (
        "overpayment.term",
        lambda: overpayment(Decimal("100.00"), cast(Any, 12.0), Decimal("1000.00")),
    ),
    ("overpayment.principal", lambda: overpayment(Decimal("100.00"), 12, cast(Any, 1000.0))),
    ("round_down.value", lambda: round_down(cast(Any, 1219999.99), Decimal("10000.00"))),
    ("round_down.step", lambda: round_down(Decimal("1219999.99"), cast(Any, 10000.0))),
    ("to_kopecks", lambda: to_kopecks(cast(Any, 0.005))),
)


@pytest.mark.parametrize(("name", "call"), _FLOAT_CALLS, ids=[c[0] for c in _FLOAT_CALLS])
def test_float_inputs_raise_type_error(name: str, call: Callable[[], object]) -> None:
    with pytest.raises(TypeError, match="получено float"):
        call()


@pytest.mark.parametrize("term", (0, -6))
def test_nonpositive_term_raises_value_error(term: int) -> None:
    with pytest.raises(ValueError, match="срок"):
        annuity_payment(Decimal("1000.00"), Decimal("21.00"), term)
    with pytest.raises(ValueError, match="срок"):
        max_principal(Decimal("100.00"), Decimal("21.00"), term)
    with pytest.raises(ValueError, match="срок"):
        overpayment(Decimal("100.00"), term, Decimal("1000.00"))


_NEGATIVE_INPUTS: tuple[tuple[str, Callable[[], object]], ...] = (
    ("annuity.principal", lambda: annuity_payment(Decimal("-1.00"), Decimal("21.00"), 12)),
    ("annuity.rate", lambda: annuity_payment(Decimal("1000.00"), Decimal("-1.00"), 12)),
    ("monthly_rate", lambda: monthly_rate(Decimal("-1.00"))),
    ("max_principal.payment", lambda: max_principal(Decimal("-1.00"), Decimal("21.00"), 12)),
    ("max_principal.rate", lambda: max_principal(Decimal("100.00"), Decimal("-1.00"), 12)),
    ("overpayment.payment", lambda: overpayment(Decimal("-1.00"), 12, Decimal("1000.00"))),
    ("overpayment.principal", lambda: overpayment(Decimal("100.00"), 12, Decimal("-1.00"))),
)


@pytest.mark.parametrize(("name", "call"), _NEGATIVE_INPUTS, ids=[c[0] for c in _NEGATIVE_INPUTS])
def test_negative_inputs_raise_value_error(name: str, call: Callable[[], object]) -> None:
    with pytest.raises(ValueError, match="отрицательн"):
        call()


@pytest.mark.parametrize("step", (Decimal("0.00"), Decimal("-10.00")))
def test_nonpositive_step_raises_value_error(step: Decimal) -> None:
    with pytest.raises(ValueError, match="шаг должен быть положительным"):
        round_down(Decimal("10000.00"), step)


def test_overpayment_never_negative_on_zero_rate() -> None:
    # 100 ₽ на 12 мес при 0% дают платёж 8.33 ₽; 8.33 * 12 - 100.00 = -0.04 ₽
    # Переплата обязана быть >= 0.00
    payment = annuity_payment(Decimal("100.00"), Decimal("0.00"), 12)
    assert payment == Decimal("8.33")
    assert overpayment(payment, 12, Decimal("100.00")) == Decimal("0.00")
