"""Тесты объяснений К5: полнота каталога, `client_text`, порядок `top_reasons`."""

from collections.abc import Mapping
from typing import Final

import pytest

from app.domain.enums import ConstraintName, Impact, Outcome, ReasonCode, Source
from app.domain.scoring.explain import CATALOG, TOP_LIMIT, render, top_reasons
from app.domain.scoring.result import Factor

#: Эталонный контекст для шаблонов: все поля, которые могут понадобиться тексту.
_REFERENCE_CONTEXT: Final[Mapping[str, str]] = {
    "value": "0,35",
    "term_months": "24",
    "amount": "2 000 000 ₽",
    "limit": "1 210 000 ₽",
    "product": "Оборотный",
    "grade": "B",
    "date": "24.11.2026",
}


def _factor(
    code: ReasonCode,
    points: int = 0,
    max_points: int = 0,
    impact: Impact = Impact.NEGATIVE,
) -> Factor:
    return Factor(
        code=code,
        source=Source.POLICY,
        value="—",
        points=points,
        max_points=max_points,
        impact=impact,
        rule_id="TEST",
    )


def test_catalog_covers_every_reason_code() -> None:
    assert set(CATALOG) == set(ReasonCode)


def test_catalog_templates_format_without_braces() -> None:
    for code, template in CATALOG.items():
        text = template.format(**_REFERENCE_CONTEXT)
        assert text, code
        assert "{" not in text, code
        assert "}" not in text, code


def test_catalog_texts_do_not_expose_policy_numbers() -> None:
    for code, template in CATALOG.items():
        text = template.format(**_REFERENCE_CONTEXT)
        assert not any(char.isdigit() for char in text), (code, text)


def test_render_fills_client_text_without_mutating_factor() -> None:
    factor = _factor(ReasonCode.TURNOVER_MODERATE, points=12, max_points=20)

    rendered = render(factor, value="0,35")

    assert rendered.client_text == CATALOG[ReasonCode.TURNOVER_MODERATE]
    assert factor.client_text == ""
    assert rendered.code is factor.code
    assert rendered.points == factor.points
    assert rendered.value == factor.value


def test_top_reasons_empty_for_clean_approved() -> None:
    factors = [
        _factor(ReasonCode.TURNOVER_STABLE, 20, 20, Impact.POSITIVE),
        _factor(ReasonCode.BKI_CLEAN, 25, 25, Impact.POSITIVE),
    ]

    assert top_reasons(factors, ConstraintName.DSCR, Outcome.APPROVED) == ()


def test_top_reasons_put_knockouts_first() -> None:
    factors = [
        _factor(ReasonCode.TURNOVER_MODERATE, 12, 20),
        _factor(ReasonCode.BKI_CURRENT_OVERDUE, 0, 0, Impact.KNOCKOUT),
        _factor(ReasonCode.INSUFFICIENT_DATA, 0, 0, Impact.KNOCKOUT),
        _factor(ReasonCode.FNS_MISMATCH, 0, 15),
    ]

    result = top_reasons(factors, None, Outcome.REJECTED)

    assert result == (
        ReasonCode.BKI_CURRENT_OVERDUE,
        ReasonCode.INSUFFICIENT_DATA,
        ReasonCode.FNS_MISMATCH,
    )


@pytest.mark.parametrize(
    ("binding", "expected"),
    [
        (ConstraintName.DSCR, ReasonCode.DSCR_BELOW_MIN),
        (ConstraintName.REVENUE, ReasonCode.REVENUE_LIMIT),
        (ConstraintName.GRADE_CAP, ReasonCode.GRADE_CAP_LIMIT),
        (ConstraintName.PRODUCT_MAX, ReasonCode.PRODUCT_MAX_LIMIT),
    ],
)
def test_top_reasons_put_binding_code_first_for_counter_offer(
    binding: ConstraintName,
    expected: ReasonCode,
) -> None:
    factors = [_factor(ReasonCode.TURNOVER_MODERATE, 12, 20)]

    assert top_reasons(factors, binding, Outcome.COUNTER_OFFER) == (
        expected,
        ReasonCode.TURNOVER_MODERATE,
    )


@pytest.mark.parametrize("outcome", [Outcome.APPROVED, Outcome.REJECTED])
def test_top_reasons_ignore_binding_outside_counter_offer(outcome: Outcome) -> None:
    factors = [_factor(ReasonCode.TURNOVER_MODERATE, 12, 20)]

    assert top_reasons(factors, ConstraintName.DSCR, outcome) == (ReasonCode.TURNOVER_MODERATE,)


def test_top_reasons_order_by_lost_points_then_code() -> None:
    factors = [
        _factor(ReasonCode.FNS_MISMATCH_MODERATE, 8, 15),
        _factor(ReasonCode.TURNOVER_MODERATE, 12, 20),
        _factor(ReasonCode.BKI_PAST_OVERDUE_MINOR, 15, 25),
        _factor(ReasonCode.DEBT_BURDEN_MODERATE, 12, 20),
    ]

    result = top_reasons(factors, ConstraintName.DSCR, Outcome.COUNTER_OFFER)

    assert result == (
        ReasonCode.DSCR_BELOW_MIN,
        ReasonCode.BKI_PAST_OVERDUE_MINOR,
        ReasonCode.DEBT_BURDEN_MODERATE,
    )


def test_top_reasons_are_limited_to_three() -> None:
    factors = [
        _factor(ReasonCode.TURNOVER_VOLATILE, 4, 20),
        _factor(ReasonCode.DEBT_BURDEN_HIGH, 5, 20),
        _factor(ReasonCode.BKI_PAST_OVERDUE_MAJOR, 5, 25),
        _factor(ReasonCode.FNS_MISMATCH, 0, 15),
    ]

    assert len(top_reasons(factors, None, Outcome.REJECTED)) == TOP_LIMIT


def test_top_reasons_do_not_repeat_codes() -> None:
    factors = [
        _factor(ReasonCode.DSCR_BELOW_MIN, 0, 20),
        _factor(ReasonCode.TURNOVER_VOLATILE, 4, 20),
    ]

    assert top_reasons(factors, ConstraintName.DSCR, Outcome.COUNTER_OFFER) == (
        ReasonCode.DSCR_BELOW_MIN,
        ReasonCode.TURNOVER_VOLATILE,
    )


def test_top_reasons_skip_positive_and_neutral_factors() -> None:
    factors = [
        _factor(ReasonCode.TURNOVER_STABLE, 20, 20, Impact.POSITIVE),
        _factor(ReasonCode.FNS_MATCH, 15, 15, Impact.NEUTRAL),
    ]

    assert top_reasons(factors, None, Outcome.COUNTER_OFFER) == ()
