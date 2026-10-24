"""Общие фикстуры тестов домена."""

from collections.abc import Callable
from datetime import date

import pytest

from app.domain.scoring.inputs import ScoringInputs
from app.seed.personas import load_inputs

FIXED_AS_OF = date(2026, 10, 24)


@pytest.fixture
def persona_inputs() -> Callable[[str], ScoringInputs]:
    """Снимок персоны по id: `persona_inputs("p1_ideal")`."""
    return load_inputs
