"""Тесты функции pre_approve (design.md §4, credit-simulation spec).

Проверки:
- P1 на WC_FLEX: 8 640 000 ₽ на 36 мес, binding REVENUE, ставка 21.50%;
- P4 (стоп-фактор) и P5 (мало данных) возвращают None;
- клиент с лимитом ниже минимума продукта возвращает None;
- неизвестный продукт вызывает PolicyViolation.
"""

from decimal import Decimal

import pytest

from app.domain.enums import ConstraintName
from app.domain.errors import PolicyViolation
from app.domain.scoring.engine import pre_approve
from app.domain.scoring.inputs import AccountData
from app.domain.scoring.policy import POLICY_V1
from app.seed.personas import load_inputs


def test_p1_pre_approve_wc_flex() -> None:
    inp = load_inputs("p1_ideal")
    result = pre_approve(inp, "WC_FLEX", POLICY_V1)

    assert result is not None
    assert result.product_code == "WC_FLEX"
    assert result.amount == Decimal("8640000.00")
    assert result.term_months == 36
    assert result.binding is ConstraintName.REVENUE
    assert result.rate_pct == Decimal("21.50")


def test_p4_pre_approve_is_none() -> None:
    inp = load_inputs("p4_overdue")
    assert pre_approve(inp, "WC_FLEX", POLICY_V1) is None


def test_p5_pre_approve_is_none() -> None:
    inp = load_inputs("p5_young")
    assert pre_approve(inp, "WC_FLEX", POLICY_V1) is None


def test_amount_below_min_returns_none() -> None:
    # Заёмщик с очень низкими оборотами (не хватает на минимальную сумму продукта 300 000)
    base = load_inputs("p1_ideal")
    low_revenue_inp = base.__class__(
        as_of=base.as_of,
        company=base.company,
        fns=base.fns,
        bki=base.bki,
        account=AccountData(
            inflows=(Decimal("10000.00"),) * 12,
            outflows=(Decimal("9000.00"),) * 12,
        ),
    )
    assert pre_approve(low_revenue_inp, "WC_FLEX", POLICY_V1) is None


def test_unknown_product_raises_policy_violation() -> None:
    inp = load_inputs("p1_ideal")
    with pytest.raises(PolicyViolation) as exc_info:
        pre_approve(inp, "UNKNOWN_PRODUCT", POLICY_V1)
    assert exc_info.value.code == "UNKNOWN_PRODUCT"
