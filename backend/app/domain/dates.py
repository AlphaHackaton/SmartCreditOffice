"""Календарная арифметика по месяцам (без «сегодня»: дата приходит параметром)."""

from calendar import monthrange
from datetime import date


def add_months(d: date, months: int) -> date:
    """Прибавить полные месячи; день зажимается в конец месяца.

    31.01 + 1 мес → 28/29.02.
    """
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def months_between(start: date, end: date) -> int:
    """Максимальное m: add_months(start, m) <= end (полные месячи).

    start > end → ValueError.
    """
    if start > end:
        raise ValueError(f"start {start} позже end {end}")
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if add_months(start, months) > end:
        months -= 1
    return months
