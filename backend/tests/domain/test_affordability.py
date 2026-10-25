"""Тесты платёжеспособности и лимитов К4: сетка сроков, binding, инвариант DSCR."""

from collections.abc import Callable
from dataclasses import replace
from decimal import Decimal

import pytest

from app.domain.enums import ConstraintName, Grade
from app.domain.money import annuity_payment, round_down
from app.domain.scoring.affordability import amount_limit, payment_capacity, term_grid
from app.domain.scoring.inputs import ScoringInputs
from app.domain.scoring.metrics import Metrics, compute_metrics
from app.domain.scoring.policy import POLICY_V1
from app.domain.scoring.pricing import price
from app.domain.scoring.result import Constraint
from app.domain.scoring.scorecard import score
from app.seed.personas import load_request

PersonaInputs = Callable[[str], ScoringInputs]

_PERSONAS = (
    "p1_ideal",
    "p2_longer_term",
    "p3_reduced",
    "p4_overdue",
    "p5_young",
    "p6_mismatch",
)


def _limit_for(
    persona_id: str,
    persona_inputs: PersonaInputs,
    term_months: int,
) -> tuple[Decimal, tuple[Constraint, ...], ConstraintName]:
    inp = persona_inputs(persona_id)
    metrics = compute_metrics(inp)
    product = POLICY_V1.product(load_request(persona_id).product_code)
    _, grade, _ = score(metrics, POLICY_V1)
    return amount_limit(metrics, product, grade, term_months, POLICY_V1)


def test_term_grid_includes_upper_bound() -> None:
    assert term_grid(POLICY_V1.product("WC_FLEX"), POLICY_V1) == (6, 12, 18, 24, 30, 36)


def test_term_grid_includes_non_aligned_max_term() -> None:
    product = replace(POLICY_V1.product("CAPEX"), min_term=12, max_term=40)

    assert term_grid(product, POLICY_V1) == (12, 18, 24, 30, 36, 40)


def test_p1_36m_is_revenue_bound(persona_inputs: PersonaInputs) -> None:
    limit, constraints, binding = _limit_for("p1_ideal", persona_inputs, 36)

    assert binding is ConstraintName.REVENUE
    assert limit == Decimal("8640000.00")
    assert tuple(constraint.name for constraint in constraints) == tuple(ConstraintName)
    assert sum(constraint.binding for constraint in constraints) == 1
    revenue = next(
        constraint for constraint in constraints if constraint.name is ConstraintName.REVENUE
    )
    assert revenue.binding is True


def test_p1_24m_is_dscr_bound_and_limit_is_not_rounded(
    persona_inputs: PersonaInputs,
) -> None:
    limit, constraints, binding = _limit_for("p1_ideal", persona_inputs, 24)

    assert binding is ConstraintName.DSCR
    # design.md §4: ориентир ≈ 6 736 293 ₽; точное значение фиксирует golden в К5.
    assert abs(limit - Decimal("6736293")) <= Decimal("150")
    assert limit % POLICY_V1.amount_step != 0
    assert limit == min(constraint.limit for constraint in constraints)


@pytest.mark.parametrize(
    ("persona_id", "term_months"),
    [("p2_longer_term", 12), ("p3_reduced", 36)],
)
def test_p2_and_p3_are_dscr_bound(
    persona_id: str,
    term_months: int,
    persona_inputs: PersonaInputs,
) -> None:
    _, constraints, binding = _limit_for(persona_id, persona_inputs, term_months)

    assert binding is ConstraintName.DSCR
    dscr = next(constraint for constraint in constraints if constraint.name is ConstraintName.DSCR)
    assert dscr.limit == min(constraint.limit for constraint in constraints)


def test_payment_capacity_formula(persona_inputs: PersonaInputs) -> None:
    metrics = compute_metrics(persona_inputs("p1_ideal"))

    expected = metrics.ncf / POLICY_V1.dscr_min - metrics.existing_payments
    assert payment_capacity(metrics, POLICY_V1) == expected


def test_zero_capacity_when_ncf_is_not_positive(persona_inputs: PersonaInputs) -> None:
    metrics = replace(compute_metrics(persona_inputs("p1_ideal")), ncf=Decimal("0.00"))
    product = POLICY_V1.product("WC_FLEX")

    assert payment_capacity(metrics, POLICY_V1) == 0

    limit, constraints, binding = amount_limit(metrics, product, Grade.A, 24, POLICY_V1)
    assert binding is ConstraintName.DSCR
    assert limit == 0
    assert all(constraint.limit >= 0 for constraint in constraints)


def test_zero_capacity_when_existing_payments_exceed_dscr_room(
    persona_inputs: PersonaInputs,
) -> None:
    metrics = replace(
        compute_metrics(persona_inputs("p1_ideal")),
        ncf=Decimal("100000.00"),
        existing_payments=Decimal("100000.00"),
    )
    product = POLICY_V1.product("WC_FLEX")

    assert payment_capacity(metrics, POLICY_V1) == 0

    limit, constraints, binding = amount_limit(metrics, product, Grade.A, 24, POLICY_V1)
    assert binding is ConstraintName.DSCR
    assert limit == 0
    assert all(constraint.limit >= 0 for constraint in constraints)


def test_equal_constraints_follow_enum_order(persona_inputs: PersonaInputs) -> None:
    metrics = compute_metrics(persona_inputs("p1_ideal"))
    product = replace(POLICY_V1.product("WC_FLEX"), max_amount=Decimal("5000000.00"))

    limit, constraints, binding = amount_limit(metrics, product, Grade.B, 36, POLICY_V1)

    assert limit == Decimal("5000000.00")
    assert binding is ConstraintName.GRADE_CAP
    by_name = {constraint.name: constraint for constraint in constraints}
    assert by_name[ConstraintName.GRADE_CAP].binding is True
    assert by_name[ConstraintName.PRODUCT_MAX].binding is False


@pytest.mark.parametrize("persona_id", _PERSONAS)
def test_dscr_invariant_for_all_personas_and_terms(
    persona_id: str,
    persona_inputs: PersonaInputs,
) -> None:
    inp = persona_inputs(persona_id)
    metrics: Metrics = compute_metrics(inp)
    request = load_request(persona_id)
    product = POLICY_V1.product(request.product_code)
    _, grade, _ = score(metrics, POLICY_V1)

    for term_months in term_grid(product, POLICY_V1):
        limit, constraints, binding = amount_limit(metrics, product, grade, term_months, POLICY_V1)
        rate = price(product, grade, term_months, POLICY_V1)
        amount = round_down(limit, POLICY_V1.amount_step)
        payment = annuity_payment(amount, rate, term_months)

        assert binding in {constraint.name for constraint in constraints}
        assert limit == min(constraint.limit for constraint in constraints)
        assert (
            payment * POLICY_V1.dscr_min
            <= metrics.ncf - metrics.existing_payments * POLICY_V1.dscr_min
        ), (persona_id, term_months)
