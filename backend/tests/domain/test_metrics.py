"""Тесты метрик К3: определения design.md §2 и цели персон design.md §4."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import pytest

from app.domain.enums import BkiSubject, FnsStatus, LegalForm
from app.domain.scoring.inputs import (
    AccountData,
    BkiReport,
    CompanyData,
    FnsData,
    ScoringInputs,
)
from app.domain.scoring.metrics import compute_metrics
from app.seed.personas import persona_ids

from .conftest import FIXED_AS_OF

_TOLERANCE = Decimal("0.001")


def _close(actual: Decimal, expected: Decimal) -> bool:
    """Совпадение с допуском 0,1 % (для нуля — точное)."""
    if expected == 0:
        return actual == 0
    return abs(actual - expected) <= abs(expected) * _TOLERANCE


def _report(
    *,
    subject: BkiSubject = BkiSubject.COMPANY,
    current_overdue_days: int = 0,
    max_overdue_days_12m: int = 0,
    max_overdue_days_24m: int = 0,
    inquiries_30d: int = 0,
    monthly_payments: Decimal = Decimal("0.00"),
) -> BkiReport:
    """Отчёт БКИ с нулями по умолчанию."""
    return BkiReport(
        subject=subject,
        current_overdue_days=current_overdue_days,
        max_overdue_days_12m=max_overdue_days_12m,
        max_overdue_days_24m=max_overdue_days_24m,
        inquiries_30d=inquiries_30d,
        monthly_payments=monthly_payments,
        active_loans=0,
    )


def _inputs(
    account: AccountData,
    *,
    bki: tuple[BkiReport, ...] | None = None,
    declared: Decimal | None = Decimal("12000000.00"),
    registered_at: date = date(2020, 1, 1),
) -> ScoringInputs:
    """Синтетический снимок клиента для проверок метрик."""
    return ScoringInputs(
        as_of=FIXED_AS_OF,
        company=CompanyData(
            inn="770123456703",
            legal_form=LegalForm.IP,
            registered_at=registered_at,
            okved="47.19",
        ),
        fns=FnsData(
            status=FnsStatus.ACTIVE,
            accounts_blocked=False,
            declared_revenue_12m=declared,
            tax_debt=Decimal("0.00"),
        ),
        bki=(_report(),) if bki is None else bki,
        account=account,
    )


def _account(
    inflows: tuple[Decimal, ...],
    outflows: tuple[Decimal, ...] | None = None,
) -> AccountData:
    """Ряды счёта; по умолчанию расходы = поступления − 200 000."""
    if outflows is None:
        outflows = tuple(value - Decimal("200000.00") for value in inflows)
    return AccountData(inflows=inflows, outflows=outflows)


@dataclass(frozen=True)
class _Target:
    """Ожидаемые метрики персоны из design.md §4."""

    history_months: int
    mean_inflow: Decimal
    inflows_12m: Decimal
    cv: Decimal | None
    ncf: Decimal
    existing_payments: Decimal
    debt_burden: Decimal | None
    worst_overdue_24m: int
    worst_overdue_12m: int
    current_overdue: int
    inquiries_30d: int
    fns_mismatch: Decimal | None
    business_age_months: int


_TARGETS: dict[str, _Target] = {
    "p1_ideal": _Target(
        history_months=12,
        mean_inflow=Decimal("1800000.00"),
        inflows_12m=Decimal("21600000.00"),
        cv=Decimal("0.10"),
        ncf=Decimal("450000.00"),
        existing_payments=Decimal("0.00"),
        debt_burden=Decimal("0.00"),
        worst_overdue_24m=0,
        worst_overdue_12m=0,
        current_overdue=0,
        inquiries_30d=1,
        fns_mismatch=Decimal("0.028571429"),
        business_age_months=74,
    ),
    "p2_longer_term": _Target(
        history_months=12,
        mean_inflow=Decimal("1200000.00"),
        inflows_12m=Decimal("14400000.00"),
        cv=Decimal("0.35"),
        ncf=Decimal("200000.00"),
        existing_payments=Decimal("40000.00"),
        debt_burden=Decimal("0.20"),
        worst_overdue_24m=12,
        worst_overdue_12m=12,
        current_overdue=0,
        inquiries_30d=2,
        fns_mismatch=Decimal("0.25"),
        business_age_months=48,
    ),
    "p3_reduced": _Target(
        history_months=12,
        mean_inflow=Decimal("2500000.00"),
        inflows_12m=Decimal("30000000.00"),
        cv=Decimal("0.35"),
        ncf=Decimal("500000.00"),
        existing_payments=Decimal("250000.00"),
        debt_burden=Decimal("0.50"),
        worst_overdue_24m=0,
        worst_overdue_12m=0,
        current_overdue=0,
        inquiries_30d=6,
        fns_mismatch=Decimal("0.0797546"),
        business_age_months=60,
    ),
    "p4_overdue": _Target(
        history_months=12,
        mean_inflow=Decimal("1200000.00"),
        inflows_12m=Decimal("14400000.00"),
        cv=Decimal("0.15"),
        ncf=Decimal("300000.00"),
        existing_payments=Decimal("60000.00"),
        debt_burden=Decimal("0.20"),
        worst_overdue_24m=45,
        worst_overdue_12m=45,
        current_overdue=45,
        inquiries_30d=1,
        fns_mismatch=Decimal("0.00"),
        business_age_months=48,
    ),
    "p5_young": _Target(
        history_months=2,
        mean_inflow=Decimal("375000.00"),
        inflows_12m=Decimal("4500000.00"),
        cv=Decimal("0.20"),
        ncf=Decimal("150000.00"),
        existing_payments=Decimal("0.00"),
        debt_burden=Decimal("0.00"),
        worst_overdue_24m=0,
        worst_overdue_12m=0,
        current_overdue=0,
        inquiries_30d=0,
        fns_mismatch=None,
        business_age_months=2,
    ),
    "p6_mismatch": _Target(
        history_months=12,
        mean_inflow=Decimal("1500000.00"),
        inflows_12m=Decimal("18000000.00"),
        cv=Decimal("0.38"),
        ncf=Decimal("350000.00"),
        existing_payments=Decimal("20000.00"),
        debt_burden=Decimal("0.05714286"),
        worst_overdue_24m=0,
        worst_overdue_12m=0,
        current_overdue=0,
        inquiries_30d=1,
        fns_mismatch=Decimal("0.50"),
        business_age_months=84,
    ),
}


def test_targets_cover_all_personas() -> None:
    assert set(_TARGETS) == set(persona_ids())


@pytest.mark.parametrize(
    ("persona_id", "target"),
    sorted(_TARGETS.items()),
    ids=sorted(_TARGETS),
)
def test_persona_metrics_match_design(
    persona_id: str,
    target: _Target,
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    m = compute_metrics(persona_inputs(persona_id))
    assert m.history_months == target.history_months
    assert _close(m.mean_inflow, target.mean_inflow), f"mean_inflow={m.mean_inflow}"
    assert _close(m.inflows_12m, target.inflows_12m), f"inflows_12m={m.inflows_12m}"
    assert _close(m.ncf, target.ncf), f"ncf={m.ncf}"
    assert _close(m.existing_payments, target.existing_payments)
    assert (m.cv is None) == (target.cv is None), f"cv={m.cv}"
    if m.cv is not None and target.cv is not None:
        assert _close(m.cv, target.cv), f"cv={m.cv}"
    assert (m.debt_burden is None) == (target.debt_burden is None), m.debt_burden
    if m.debt_burden is not None and target.debt_burden is not None:
        assert _close(m.debt_burden, target.debt_burden), m.debt_burden
    assert (m.fns_mismatch is None) == (target.fns_mismatch is None), m.fns_mismatch
    if m.fns_mismatch is not None and target.fns_mismatch is not None:
        assert _close(m.fns_mismatch, target.fns_mismatch), m.fns_mismatch
    assert m.worst_overdue_24m == target.worst_overdue_24m
    assert m.worst_overdue_12m == target.worst_overdue_12m
    assert m.current_overdue == target.current_overdue
    assert m.inquiries_30d == target.inquiries_30d
    assert m.business_age_months == target.business_age_months


def test_zero_inflows_have_no_division_by_zero() -> None:
    # нулевые поступления: cv не определён, NCF не положителен, нагрузка — None
    zeros = (Decimal("0.00"),) * 12
    inputs = _inputs(
        _account(zeros, zeros),
        declared=Decimal("1000.00"),
    )
    m = compute_metrics(inputs)
    assert m.cv is None
    assert m.ncf <= 0
    assert m.debt_burden is None
    assert m.inflows_12m == 0


def test_window_uses_last_twelve_months() -> None:
    # 15 месяцев истории: метрики считаются по последним 12, старые месяцы не влияют
    old = (Decimal("9000000.00"),) * 3
    window = (Decimal("1000000.00"), Decimal("2000000.00")) * 6
    inflows = old + window
    outflows = old + tuple(value - Decimal("100000.00") for value in window)
    m = compute_metrics(_inputs(_account(inflows, outflows)))
    assert m.history_months == 15
    assert m.mean_inflow == Decimal("1500000.00")
    assert m.inflows_12m == Decimal("18000000.00")
    assert m.ncf == Decimal("100000.00")
    assert m.cv is not None
    assert _close(m.cv, Decimal("0.333333333"))


def test_short_history_is_scaled_to_twelve_months() -> None:
    # история 2 месяца: inflows_12m = среднее × 12 (P5: 375 000 × 12 = 4,5 млн)
    inputs = _inputs(
        _account((Decimal("300000.00"), Decimal("450000.00"))),
        declared=None,
    )
    m = compute_metrics(inputs)
    assert m.history_months == 2
    assert m.inflows_12m == Decimal("4500000.00")


def test_bki_aggregates_across_subjects() -> None:
    # платежи суммируются, просрочки и запросы — максимум по субъектам
    extra = _report(
        subject=BkiSubject.PERSON,
        current_overdue_days=3,
        max_overdue_days_12m=40,
        max_overdue_days_24m=45,
        inquiries_30d=7,
        monthly_payments=Decimal("15000.00"),
    )
    inputs = _inputs(
        _account((Decimal("1000000.00"),) * 12),
        bki=(
            _report(
                max_overdue_days_12m=5,
                max_overdue_days_24m=5,
                inquiries_30d=2,
                monthly_payments=Decimal("10000.00"),
            ),
            extra,
        ),
    )
    m = compute_metrics(inputs)
    assert m.existing_payments == Decimal("25000.00")
    assert m.worst_overdue_24m == 45
    assert m.worst_overdue_12m == 40
    assert m.current_overdue == 3
    assert m.inquiries_30d == 7
