"""Тесты функции pre_approve (design.md §4, credit-simulation spec).

Проверки:
- P1 на WC_FLEX: 8 640 000 ₽ на 36 мес, binding REVENUE, ставка 21.50%;
- P4 (стоп-фактор) и P5 (мало данных) возвращают None;
- заёмщик с грейдом D без стоп-факторов возвращает None;
- клиент с лимитом ниже минимума продукта возвращает None;
- неизвестный продукт вызывает PolicyViolation.
"""

from dataclasses import replace
from datetime import date
from decimal import Decimal

import pytest

from app.domain.enums import BkiSubject, ConstraintName, Grade
from app.domain.errors import PolicyViolation
from app.domain.scoring.engine import pre_approve
from app.domain.scoring.inputs import AccountData, BkiReport
from app.domain.scoring.knockout import check_data_sufficiency, check_knockouts
from app.domain.scoring.metrics import compute_metrics
from app.domain.scoring.policy import POLICY_V1
from app.domain.scoring.scorecard import score
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


def test_grade_d_without_knockouts_returns_none() -> None:
    """Заёмщик с грейдом D без стоп-факторов возвращает None (engine.py:247)."""
    base = load_inputs("p1_ideal")
    # Бизнес работает 4 месяца (>= 3 мес min_business_age_months — нет стоп-фактора
    # BUSINESS_TOO_YOUNG, но < 6 мес — M5 даёт 0 баллов BUSINESS_VERY_YOUNG)
    comp = replace(base.company, registered_at=date(2026, 6, 24))
    fns = replace(base.fns, declared_revenue_12m=None)
    bki = (
        BkiReport(
            subject=BkiSubject.COMPANY,
            current_overdue_days=0,
            max_overdue_days_12m=0,
            max_overdue_days_24m=65,
            inquiries_30d=6,
            monthly_payments=Decimal("500000.00"),
            active_loans=1,
        ),
    )
    account = AccountData(
        inflows=(Decimal("100000.00"), Decimal("2000000.00")) * 6,
        outflows=(Decimal("80000.00"), Decimal("1500000.00")) * 6,
    )
    inp = replace(base, company=comp, fns=fns, bki=bki, account=account)

    metrics = compute_metrics(inp)
    assert check_knockouts(inp, metrics, POLICY_V1) == ()
    assert check_data_sufficiency(metrics, inp, POLICY_V1) is None
    _, grade, _ = score(metrics, POLICY_V1)
    assert grade is Grade.D

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
