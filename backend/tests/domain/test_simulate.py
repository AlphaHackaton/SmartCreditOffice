"""Тесты функции simulate (design.md §4, credit-simulation spec).

Проверки:
- согласованность с evaluate (predicted_outcome, offers, requires_review);
- max_amount_for_term = round_down(limit);
- headroom = max_amount_for_term − req.amount (может быть отрицательным);
- requires_review истинно тогда и только тогда, когда маршрут evaluate — UNDERWRITING;
- запрос вне границ продукта даёт PolicyViolation (без тихого зажима).
"""

from decimal import Decimal

import pytest

from app.domain.enums import Outcome, Route
from app.domain.errors import PolicyViolation
from app.domain.money import round_down
from app.domain.scoring.affordability import amount_limit
from app.domain.scoring.engine import evaluate, simulate
from app.domain.scoring.inputs import LoanRequest
from app.domain.scoring.metrics import compute_metrics
from app.domain.scoring.policy import POLICY_V1
from app.domain.scoring.scorecard import score
from app.seed.personas import RawPersona, load_inputs, load_raw, load_request

_PERSONAS: list[RawPersona] = load_raw()["personas"]
_PERSONA_IDS = tuple(persona["id"] for persona in _PERSONAS)


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_simulate_matches_evaluate(raw: RawPersona) -> None:
    persona_id = raw["id"]
    inp = load_inputs(persona_id)
    req = load_request(persona_id)

    eval_res = evaluate(inp, req, POLICY_V1)
    sim_res = simulate(inp, req, POLICY_V1)

    assert sim_res.predicted_outcome is eval_res.recommendation
    assert sim_res.offers == eval_res.offers
    assert sim_res.constraints == eval_res.constraints
    assert sim_res.binding_constraint is eval_res.binding_constraint
    assert sim_res.requires_review == (eval_res.route is Route.UNDERWRITING)


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_simulate_headroom_and_max_amount(raw: RawPersona) -> None:
    persona_id = raw["id"]
    inp = load_inputs(persona_id)
    req = load_request(persona_id)

    sim_res = simulate(inp, req, POLICY_V1)

    # headroom равен max_amount_for_term - req.amount
    assert sim_res.headroom == sim_res.max_amount_for_term - req.amount

    # Для персон с одобрением/контроффером max_amount_for_term равен округлённому лимиту
    if sim_res.predicted_outcome in {Outcome.APPROVED, Outcome.COUNTER_OFFER}:
        metrics = compute_metrics(inp)
        _, grade, _ = score(metrics, POLICY_V1)
        product = POLICY_V1.product(req.product_code)
        limit, _, _ = amount_limit(metrics, product, grade, req.term_months, POLICY_V1)
        expected_max = round_down(limit, POLICY_V1.amount_step)
        assert sim_res.max_amount_for_term == expected_max


def test_p2_headroom_is_negative() -> None:
    inp = load_inputs("p2_longer_term")
    req = load_request("p2_longer_term")
    sim_res = simulate(inp, req, POLICY_V1)

    assert sim_res.predicted_outcome is Outcome.COUNTER_OFFER
    assert sim_res.headroom < Decimal("0")


def test_p6_requires_review_is_true() -> None:
    inp = load_inputs("p6_mismatch")
    req = load_request("p6_mismatch")
    sim_res = simulate(inp, req, POLICY_V1)

    assert sim_res.predicted_outcome is Outcome.APPROVED
    assert sim_res.requires_review is True


def test_p1_requires_review_is_false() -> None:
    inp = load_inputs("p1_ideal")
    req = load_request("p1_ideal")
    sim_res = simulate(inp, req, POLICY_V1)

    assert sim_res.predicted_outcome is Outcome.APPROVED
    assert sim_res.requires_review is False


def test_simulate_rejects_out_of_range_amount() -> None:
    inp = load_inputs("p1_ideal")
    bad_req = LoanRequest("WC_FLEX", Decimal("15000000.00"), 24)

    with pytest.raises(PolicyViolation) as exc_info:
        simulate(inp, bad_req, POLICY_V1)

    assert exc_info.value.code == "AMOUNT_OUT_OF_RANGE"


def test_simulate_rejects_out_of_range_term() -> None:
    inp = load_inputs("p1_ideal")
    bad_req = LoanRequest("WC_FLEX", Decimal("2000000.00"), 48)

    with pytest.raises(PolicyViolation) as exc_info:
        simulate(inp, bad_req, POLICY_V1)

    assert exc_info.value.code == "TERM_OUT_OF_RANGE"
