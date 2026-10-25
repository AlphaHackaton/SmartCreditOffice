"""Тесты скоринговой карты К3: бины, баллы персон, грейды, независимость от запроса."""

import inspect
from collections.abc import Callable
from dataclasses import replace
from decimal import Decimal

import pytest

from app.domain.enums import Grade, Impact, ReasonCode
from app.domain.scoring.inputs import LoanRequest, ScoringInputs
from app.domain.scoring.metrics import compute_metrics
from app.domain.scoring.policy import POLICY_V1, Bin, Policy
from app.domain.scoring.scorecard import grade_for, pick_bin, score

# --- pick_bin: границы полуинтервалов ------------------------------------------------


def test_pick_bin_turnover_boundaries() -> None:
    assert pick_bin(Decimal("0.25"), POLICY_V1.bins_turnover_cv).points == 12
    assert pick_bin(Decimal("0.50"), POLICY_V1.bins_turnover_cv).points == 4
    assert pick_bin(Decimal("0.2499"), POLICY_V1.bins_turnover_cv).points == 20
    assert pick_bin(Decimal("0.25"), POLICY_V1.bins_turnover_cv).code is (
        ReasonCode.TURNOVER_MODERATE
    )


def test_pick_bin_overdue_boundaries() -> None:
    expected = {
        Decimal("0"): 25,
        Decimal("1"): 15,
        Decimal("29"): 15,
        Decimal("30"): 5,
    }
    for value, points in expected.items():
        assert pick_bin(value, POLICY_V1.bins_overdue_24m).points == points, value


def test_pick_bin_business_age_boundaries() -> None:
    assert pick_bin(Decimal("36"), POLICY_V1.bins_business_age).points == 20
    assert pick_bin(Decimal("35"), POLICY_V1.bins_business_age).points == 15


# --- скоринговая карта персон (design.md §4) -----------------------------------------

_SCORECARD: dict[str, tuple[tuple[ReasonCode, int], ...]] = {
    "p1_ideal": (
        (ReasonCode.TURNOVER_STABLE, 20),
        (ReasonCode.DEBT_BURDEN_NONE, 20),
        (ReasonCode.BKI_CLEAN, 25),
        (ReasonCode.FNS_MATCH, 15),
        (ReasonCode.BUSINESS_MATURE, 20),
    ),
    "p2_longer_term": (
        (ReasonCode.TURNOVER_MODERATE, 12),
        (ReasonCode.DEBT_BURDEN_MODERATE, 12),
        (ReasonCode.BKI_PAST_OVERDUE_MINOR, 15),
        (ReasonCode.FNS_MISMATCH_MODERATE, 8),
        (ReasonCode.BUSINESS_MATURE, 20),
    ),
    "p3_reduced": (
        (ReasonCode.TURNOVER_MODERATE, 12),
        (ReasonCode.DEBT_BURDEN_HIGH, 5),
        (ReasonCode.BKI_CLEAN, 25),
        (ReasonCode.BKI_MANY_INQUIRIES, -5),
        (ReasonCode.FNS_MATCH, 15),
        (ReasonCode.BUSINESS_MATURE, 20),
    ),
    "p6_mismatch": (
        (ReasonCode.TURNOVER_MODERATE, 12),
        (ReasonCode.DEBT_BURDEN_NONE, 20),
        (ReasonCode.BKI_CLEAN, 25),
        (ReasonCode.FNS_MISMATCH, 0),
        (ReasonCode.BUSINESS_MATURE, 20),
    ),
}

_EXPECTED_TOTAL: dict[str, tuple[int, Grade]] = {
    "p1_ideal": (100, Grade.A),
    "p2_longer_term": (67, Grade.B),
    "p3_reduced": (72, Grade.B),
    "p6_mismatch": (77, Grade.A),
}


@pytest.mark.parametrize(
    ("persona_id", "expected"),
    sorted(_SCORECARD.items()),
    ids=sorted(_SCORECARD),
)
def test_persona_scorecard_matches_design(
    persona_id: str,
    expected: tuple[tuple[ReasonCode, int], ...],
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    m = compute_metrics(persona_inputs(persona_id))
    total, grade, factors = score(m, POLICY_V1)
    assert tuple((factor.code, factor.points) for factor in factors) == expected
    assert total == sum(points for _, points in expected)
    assert (total, grade) == _EXPECTED_TOTAL[persona_id]
    assert 0 <= total <= 100


def test_impact_reflects_lost_points(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    _, _, p1_factors = score(compute_metrics(persona_inputs("p1_ideal")), POLICY_V1)
    assert all(factor.impact is Impact.POSITIVE for factor in p1_factors)
    _, _, p2_factors = score(compute_metrics(persona_inputs("p2_longer_term")), POLICY_V1)
    for factor in p2_factors:
        expected = Impact.POSITIVE if factor.points == factor.max_points else Impact.NEGATIVE
        assert factor.impact is expected, factor.code
    # у P2 зрелый бизнес — единственный фактор без потерянных баллов
    positives = [factor.code for factor in p2_factors if factor.impact is Impact.POSITIVE]
    assert positives == [ReasonCode.BUSINESS_MATURE]


def test_factor_max_points_match_card_groups(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    _, _, factors = score(compute_metrics(persona_inputs("p2_longer_term")), POLICY_V1)
    assert [factor.max_points for factor in factors] == [20, 20, 25, 15, 20]


# --- запросы в БКИ: штраф только при > порога ----------------------------------------


def _with_inquiries(persona_inputs: Callable[[str], ScoringInputs], count: int) -> ScoringInputs:
    base = persona_inputs("p1_ideal")
    return replace(base, bki=(replace(base.bki[0], inquiries_30d=count),))


def test_many_inquiries_penalty_only_above_threshold(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    total_at, _, factors_at = score(compute_metrics(_with_inquiries(persona_inputs, 5)), POLICY_V1)
    assert ReasonCode.BKI_MANY_INQUIRIES not in [factor.code for factor in factors_at]
    assert total_at == 100

    total_above, grade_above, factors_above = score(
        compute_metrics(_with_inquiries(persona_inputs, 6)), POLICY_V1
    )
    penalty = next(
        factor for factor in factors_above if factor.code is ReasonCode.BKI_MANY_INQUIRIES
    )
    assert penalty.points == -5
    assert penalty.max_points == 0
    assert penalty.impact is Impact.NEGATIVE
    assert total_above == 95
    assert grade_above is Grade.A


# --- зажим итога в [0, 100] ----------------------------------------------------------


def test_total_is_clamped_to_hundred(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    inflated = replace(
        POLICY_V1,
        bins_turnover_cv=(Bin(upper=None, points=500, code=ReasonCode.TURNOVER_STABLE),),
    )
    total, grade, _ = score(compute_metrics(persona_inputs("p1_ideal")), inflated)
    assert total == 100
    assert grade is Grade.A


def _zeroed(policy: Policy) -> Policy:
    """Политика с нулевыми баллами всех групп бинов."""
    return replace(
        policy,
        bins_turnover_cv=(Bin(upper=None, points=0, code=ReasonCode.TURNOVER_VOLATILE),),
        bins_debt_burden=(Bin(upper=None, points=0, code=ReasonCode.DEBT_BURDEN_CRITICAL),),
        bins_overdue_24m=(Bin(upper=None, points=0, code=ReasonCode.BKI_CLEAN),),
        bins_fns_mismatch=(Bin(upper=None, points=0, code=ReasonCode.FNS_MATCH),),
        bins_business_age=(Bin(upper=None, points=0, code=ReasonCode.BUSINESS_MATURE),),
    )


def test_total_is_clamped_to_zero(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    # P3: 6 запросов → штраф −5 при нулевых баллах всех групп
    total, grade, _ = score(compute_metrics(persona_inputs("p3_reduced")), _zeroed(POLICY_V1))
    assert total == 0
    assert grade is Grade.D


# --- грейды --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("points", "grade"),
    [
        (100, Grade.A),
        (75, Grade.A),
        (74, Grade.B),
        (60, Grade.B),
        (59, Grade.C),
        (45, Grade.C),
        (44, Grade.D),
        (0, Grade.D),
    ],
)
def test_grade_for_boundaries(points: int, grade: Grade) -> None:
    assert grade_for(points, POLICY_V1) is grade


# --- независимость от запроса --------------------------------------------------------


def test_score_signature_has_no_loan_request() -> None:
    signature = inspect.signature(score)
    assert tuple(signature.parameters) == ("m", "p")
    for parameter in signature.parameters.values():
        assert parameter.annotation is not LoanRequest, parameter.name
