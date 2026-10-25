"""Метрики клиента: извлечение признаков из снимка, ничего не решает.

Определения (design.md §2, §4):
- окно — последние `min(len(ряда), 12)` месяцев;
- `history_months` — полная длина истории счёта (не только окно);
- `inflows_12m` — сумма поступлений окна, при истории короче 12 месяцев
  пересчитывается на 12 (среднее × 12);
- `cv = pstdev / mean`, при `mean == 0` — `None` (деления на ноль нет);
- `ncf` — среднее `(inflow − outflow)` по окну (без платежей по кредитам);
- `existing_payments` — сумма `monthly_payments` по всем отчётам БКИ;
- `debt_burden = existing_payments / ncf`, при `ncf <= 0` — `None` (бин CRITICAL);
- просрочки и запросы — максимум по субъектам БКИ;
- `fns_mismatch = |declared − inflows_12m| / declared`, без декларации — `None`.
  Нулевая декларация при ненулевых поступлениях даёт расхождение 1 (100 %),
  это защищает от деления на ноль.
"""

from dataclasses import dataclass
from decimal import Decimal
from statistics import pstdev
from typing import Final

from ..dates import months_between
from .inputs import ScoringInputs

#: Длина окна метрик в месяцах.
WINDOW_MONTHS: Final = 12


@dataclass(frozen=True, slots=True)
class Metrics:
    """Извлечённые признаки клиента (вход скоринговой карты и стоп-факторов)."""

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


def compute_metrics(inp: ScoringInputs) -> Metrics:
    """Посчитать метрики по снимку клиента на дату `as_of`."""
    inflows = inp.account.inflows[-WINDOW_MONTHS:]
    outflows = inp.account.outflows[-WINDOW_MONTHS:]
    months = len(inflows)
    mean_inflow = sum(inflows, Decimal("0")) / months
    history_months = len(inp.account.inflows)
    inflows_12m = mean_inflow * WINDOW_MONTHS
    ncf = sum((i - o for i, o in zip(inflows, outflows, strict=True)), Decimal("0")) / months
    existing_payments = sum((report.monthly_payments for report in inp.bki), Decimal("0"))
    declared = inp.fns.declared_revenue_12m
    if declared is None:
        fns_mismatch = None
    elif declared.is_zero():
        fns_mismatch = Decimal("1") if inflows_12m > 0 else Decimal("0")
    else:
        fns_mismatch = abs(declared - inflows_12m) / declared
    return Metrics(
        history_months=history_months,
        mean_inflow=mean_inflow,
        inflows_12m=inflows_12m,
        cv=None if mean_inflow == 0 else pstdev(inflows) / mean_inflow,
        ncf=ncf,
        existing_payments=existing_payments,
        debt_burden=None if ncf <= 0 else existing_payments / ncf,
        worst_overdue_24m=max((report.max_overdue_days_24m for report in inp.bki), default=0),
        worst_overdue_12m=max((report.max_overdue_days_12m for report in inp.bki), default=0),
        current_overdue=max((report.current_overdue_days for report in inp.bki), default=0),
        inquiries_30d=max((report.inquiries_30d for report in inp.bki), default=0),
        fns_mismatch=fns_mismatch,
        business_age_months=months_between(inp.company.registered_at, inp.as_of),
    )
