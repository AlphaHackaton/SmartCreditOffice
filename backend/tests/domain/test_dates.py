"""Тесты календарной арифметики К0."""

from datetime import date

import pytest

from app.domain.dates import add_months, months_between


def test_add_months_clamps_end_of_month() -> None:
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2028, 1, 31), 1) == date(2028, 2, 29)


def test_months_between_full_months() -> None:
    assert months_between(date(2026, 8, 24), date(2026, 10, 24)) == 2
    assert months_between(date(2026, 8, 25), date(2026, 10, 24)) == 1


def test_months_between_rejects_start_after_end() -> None:
    with pytest.raises(ValueError):
        months_between(date(2026, 10, 25), date(2026, 10, 24))
