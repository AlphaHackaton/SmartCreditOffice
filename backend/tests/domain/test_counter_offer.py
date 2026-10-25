"""Тесты контроффера К5: сетка сроков, LONGER_TERM/MAX, отказы, завершаемость."""

from collections.abc import Callable
from dataclasses import replace
from decimal import Decimal

import pytest

import app.domain.scoring.counter_offer as counter_offer
from app.domain.enums import ConstraintName, Grade, OfferKind, Outcome, ReasonCode
from app.domain.errors import PolicyViolation
from app.domain.money import annuity_payment, overpayment
from app.domain.scoring.affordability import term_grid
from app.domain.scoring.counter_offer import build_offers, make_offer, reject_reason
from app.domain.scoring.engine import evaluate
from app.domain.scoring.inputs import AccountData, LoanRequest, ScoringInputs
from app.domain.scoring.metrics import Metrics, compute_metrics
from app.domain.scoring.policy import POLICY_V1, Policy, Product
from app.domain.scoring.pricing import price
from app.domain.scoring.result import Constraint, OfferDraft
from app.domain.scoring.scorecard import score
from app.seed.personas import load_inputs, load_request

PersonaInputs = Callable[[str], ScoringInputs]


def _build(
    inp: ScoringInputs,
    req: LoanRequest,
    product: Product | None = None,
) -> tuple[Outcome, tuple[OfferDraft, ...], ConstraintName | None, tuple[Constraint, ...]]:
    """`build_offers` для снимка: метрики, грейд и продукт считаются здесь."""
    metrics = compute_metrics(inp)
    chosen = product or POLICY_V1.product(req.product_code)
    _, grade, _ = score(metrics, POLICY_V1)
    return build_offers(metrics, req, chosen, grade, POLICY_V1)


def _build_persona(
    persona_id: str, req: LoanRequest | None = None
) -> tuple[
    Outcome,
    tuple[OfferDraft, ...],
    ConstraintName | None,
    tuple[Constraint, ...],
]:
    return _build(load_inputs(persona_id), req or load_request(persona_id))


def _synthetic_inputs(inflow: str, outflow: str, declared: str) -> ScoringInputs:
    """Снимок P1 с заменёнными рядами счёта и декларацией."""
    base = load_inputs("p1_ideal")
    return replace(
        base,
        account=AccountData(
            inflows=(Decimal(inflow),) * 12,
            outflows=(Decimal(outflow),) * 12,
        ),
        fns=replace(base.fns, declared_revenue_12m=Decimal(declared)),
    )


def _offer_cases() -> list[tuple[str, Metrics, LoanRequest, Product, Grade]]:
    """Синтетические и персональные кейсы с непустыми офферами."""
    cases: list[tuple[str, Metrics, LoanRequest, Product, Grade]] = []
    for persona_id in ("p2_longer_term", "p3_reduced"):
        inp = load_inputs(persona_id)
        metrics = compute_metrics(inp)
        req = load_request(persona_id)
        _, grade, _ = score(metrics, POLICY_V1)
        cases.append((persona_id, metrics, req, POLICY_V1.product(req.product_code), grade))

    inp = load_inputs("p3_reduced")
    metrics = compute_metrics(inp)
    req = replace(load_request("p3_reduced"), term_months=6)
    _, grade, _ = score(metrics, POLICY_V1)
    cases.append(("p3_reduced_6m", metrics, req, POLICY_V1.product("WC_FLEX"), grade))
    return cases


def test_requested_amount_gives_only_requested_offer() -> None:
    outcome, offers, binding, constraints = _build_persona("p1_ideal")

    assert outcome is Outcome.APPROVED
    assert tuple(offer.kind for offer in offers) == (OfferKind.REQUESTED,)
    assert binding is ConstraintName.DSCR
    assert offers[0].amount == Decimal("2000000.00")
    assert offers[0].term_months == 24
    assert offers[0].rate_pct == Decimal("21.00")
    assert abs(offers[0].monthly_payment - Decimal("102770")) <= Decimal("10")
    assert len(constraints) == len(ConstraintName)


def test_p2_gets_longer_term_and_reduced_amount() -> None:
    outcome, offers, binding, _ = _build_persona("p2_longer_term")

    assert outcome is Outcome.COUNTER_OFFER
    assert binding is ConstraintName.DSCR
    assert tuple(offer.kind for offer in offers) == (
        OfferKind.LONGER_TERM,
        OfferKind.REDUCED_AMOUNT,
    )

    longer, reduced = offers
    assert longer.amount == Decimal("2500000.00")
    assert longer.term_months == 30
    assert reduced.term_months == 12
    assert reduced.amount < Decimal("2500000.00")
    # design.md §4: ориентир ≈ 1 210 000 ₽; точное значение фиксирует golden.
    assert abs(reduced.amount - Decimal("1210000")) <= Decimal("10000")


def test_longer_term_found_means_no_max_offer() -> None:
    _, offers, _, _ = _build_persona("p2_longer_term")

    assert OfferKind.MAX not in {offer.kind for offer in offers}


def test_max_term_request_has_no_longer_term_and_no_duplicate_max() -> None:
    outcome, offers, _, _ = _build_persona("p3_reduced")

    assert outcome is Outcome.COUNTER_OFFER
    assert tuple(offer.kind for offer in offers) == (OfferKind.REDUCED_AMOUNT,)
    assert offers[0].term_months == 36


def test_max_offer_appears_when_longer_term_is_missing() -> None:
    inp = load_inputs("p3_reduced")
    metrics = compute_metrics(inp)
    req = replace(load_request("p3_reduced"), term_months=6)
    product = POLICY_V1.product("WC_FLEX")
    _, grade, _ = score(metrics, POLICY_V1)

    outcome, offers, _, _ = build_offers(metrics, req, product, grade, POLICY_V1)

    assert outcome is Outcome.COUNTER_OFFER
    assert tuple(offer.kind for offer in offers) == (OfferKind.REDUCED_AMOUNT, OfferKind.MAX)
    reduced, maximum = offers
    assert maximum.term_months == product.max_term
    assert maximum.amount > reduced.amount
    assert len({(offer.amount, offer.term_months) for offer in offers}) == len(offers)


def test_limit_below_product_min_rejects_with_amount_below_min() -> None:
    inp = _synthetic_inputs("50000.00", "40000.00", "600000.00")
    req = load_request("p1_ideal")

    outcome, offers, binding, constraints = _build(inp, req)

    assert outcome is Outcome.REJECTED
    assert offers == ()
    assert binding is ConstraintName.DSCR
    limit = min(constraint.limit for constraint in constraints)
    assert limit > 0
    assert reject_reason(limit) is ReasonCode.AMOUNT_BELOW_MIN

    result = evaluate(inp, req, POLICY_V1)
    assert result.recommendation is Outcome.REJECTED
    assert result.offers == ()
    assert result.top_reasons[0] is ReasonCode.AMOUNT_BELOW_MIN


def test_zero_capacity_rejects_with_no_debt_capacity() -> None:
    inp = _synthetic_inputs("100000.00", "100000.00", "1200000.00")
    req = load_request("p1_ideal")

    outcome, offers, binding, constraints = _build(inp, req)

    assert outcome is Outcome.REJECTED
    assert offers == ()
    assert binding is ConstraintName.DSCR
    limit = min(constraint.limit for constraint in constraints)
    assert limit == 0
    assert reject_reason(limit) is ReasonCode.NO_DEBT_CAPACITY

    result = evaluate(inp, req, POLICY_V1)
    assert result.recommendation is Outcome.REJECTED
    assert result.offers == ()
    assert result.top_reasons[0] is ReasonCode.NO_DEBT_CAPACITY


@pytest.mark.parametrize("case", _offer_cases(), ids=lambda case: case[0])
def test_every_offer_respects_product_bounds_and_step(
    case: tuple[str, Metrics, LoanRequest, Product, Grade],
) -> None:
    _, metrics, req, product, grade = case
    outcome, offers, _, _ = build_offers(metrics, req, product, grade, POLICY_V1)

    assert outcome in {Outcome.COUNTER_OFFER, Outcome.APPROVED}
    assert offers

    for offer in offers:
        assert offer.amount % POLICY_V1.amount_step == 0
        assert product.min_amount <= offer.amount <= product.max_amount
        assert offer.term_months in term_grid(product, POLICY_V1)
        assert offer.rate_pct == price(product, grade, offer.term_months, POLICY_V1)
        assert offer.monthly_payment == annuity_payment(
            offer.amount, offer.rate_pct, offer.term_months
        )
        assert offer.overpayment == overpayment(
            offer.monthly_payment, offer.term_months, offer.amount
        )
        if offer.kind is OfferKind.LONGER_TERM:
            assert offer.amount == req.amount
            assert offer.term_months > req.term_months
        if offer.kind is OfferKind.REDUCED_AMOUNT:
            assert offer.amount < req.amount
            assert offer.term_months == req.term_months


def test_build_offers_is_finite(monkeypatch: pytest.MonkeyPatch) -> None:
    original = counter_offer.amount_limit
    calls: list[int] = []

    def counting(
        m: Metrics,
        product: Product,
        grade: Grade,
        term_months: int,
        p: Policy,
    ) -> tuple[Decimal, tuple[Constraint, ...], ConstraintName]:
        calls.append(term_months)
        return original(m, product, grade, term_months, p)

    monkeypatch.setattr(counter_offer, "amount_limit", counting)

    for _, metrics, req, product, grade in _offer_cases():
        calls.clear()
        build_offers(metrics, req, product, grade, POLICY_V1)
        assert calls
        assert calls[0] == req.term_months
        assert len(calls) <= len(term_grid(product, POLICY_V1)) + 2, (req, calls)


def test_make_offer_computes_money_fields() -> None:
    product = POLICY_V1.product("WC_FLEX")

    offer = make_offer(
        OfferKind.REDUCED_AMOUNT,
        Decimal("1000000.00"),
        24,
        product,
        Grade.B,
        POLICY_V1,
    )

    assert offer.rate_pct == Decimal("23.00")
    assert offer.monthly_payment == annuity_payment(Decimal("1000000.00"), Decimal("23.00"), 24)
    assert offer.overpayment == overpayment(offer.monthly_payment, 24, Decimal("1000000.00"))


def test_make_offer_rejects_invalid_request() -> None:
    product = POLICY_V1.product("WC_FLEX")

    with pytest.raises(PolicyViolation) as below_min:
        make_offer(OfferKind.MAX, Decimal("200000.00"), 24, product, Grade.A, POLICY_V1)
    assert below_min.value.code == "AMOUNT_OUT_OF_RANGE"

    with pytest.raises(PolicyViolation) as bad_step:
        make_offer(OfferKind.MAX, Decimal("1005000.00"), 24, product, Grade.A, POLICY_V1)
    assert bad_step.value.code == "AMOUNT_OUT_OF_RANGE"

    with pytest.raises(PolicyViolation) as bad_term:
        make_offer(OfferKind.MAX, Decimal("1000000.00"), 25, product, Grade.A, POLICY_V1)
    assert bad_term.value.code == "TERM_OUT_OF_RANGE"
