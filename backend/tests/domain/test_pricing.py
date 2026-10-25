"""Тесты ценообразования К4: ставки, коридор, премия за срок, независимость от суммы."""

import inspect
from dataclasses import replace
from decimal import Decimal
from types import MappingProxyType

import pytest

from app.domain.enums import Grade
from app.domain.errors import PolicyViolation
from app.domain.scoring.policy import POLICY_V1
from app.domain.scoring.pricing import price, term_premium


def test_persona_rates_match_design() -> None:
    p1 = price(POLICY_V1.product("WC_FLEX"), Grade.A, 24, POLICY_V1)
    p6 = price(POLICY_V1.product("CAPEX"), Grade.A, 24, POLICY_V1)
    p2 = price(POLICY_V1.product("WC_FLEX"), Grade.B, 30, POLICY_V1)

    assert p1 == Decimal("21.00")  # 16,5 + 4,0 + 0 + 0,5
    assert p6 == Decimal("20.00")  # 16,5 + 3,0 + 0 + 0,5
    assert p2 == Decimal("23.50")  # 16,5 + 4,0 + 2,0 + 1,0


def test_rate_is_capped_by_policy_corridor() -> None:
    huge_premium = MappingProxyType(
        {grade: Decimal("100.00") for grade in (Grade.A, Grade.B, Grade.C)}
    )
    synthetic = replace(POLICY_V1, risk_premium=huge_premium)

    rate = price(synthetic.product("WC_FLEX"), Grade.A, 24, synthetic)

    assert rate == synthetic.key_rate_pct + synthetic.rate_cap_add == Decimal("28.50")


def test_price_signature_has_no_amount() -> None:
    signature = inspect.signature(price)

    assert tuple(signature.parameters) == ("product", "grade", "term_months", "p")
    assert "amount" not in signature.parameters


@pytest.mark.parametrize(
    ("term_months", "expected"),
    [
        (12, Decimal("0.00")),
        (13, Decimal("0.50")),
        (24, Decimal("0.50")),
        (25, Decimal("1.00")),
        (36, Decimal("1.00")),
        (37, Decimal("1.50")),
        (60, Decimal("1.50")),
    ],
)
def test_term_premium_steps(term_months: int, expected: Decimal) -> None:
    assert term_premium(term_months, POLICY_V1) == expected


def test_term_above_policy_maximum_is_rejected() -> None:
    with pytest.raises(PolicyViolation) as exc:
        term_premium(61, POLICY_V1)

    assert exc.value.code == "TERM_OUT_OF_RANGE"


def test_grade_d_has_no_offers() -> None:
    with pytest.raises(PolicyViolation):
        price(POLICY_V1.product("WC_FLEX"), Grade.D, 24, POLICY_V1)
