"""Тесты политики К4: версия, переопределение ключевой ставки, валидация запроса."""

import subprocess
import sys
from dataclasses import FrozenInstanceError, replace
from decimal import Decimal
from pathlib import Path

import pytest

from app.domain.enums import Grade, ReasonCode
from app.domain.errors import PolicyViolation
from app.domain.scoring.inputs import LoanRequest
from app.domain.scoring.policy import POLICY_V1, Bin, validate_request
from app.domain.scoring.pricing import price

#: Оракул версии: канонический JSON политики + sha256, первые 8 hex.
_EXPECTED_VERSION = "v1-02f2028a"

_VALID_REQUEST = LoanRequest(
    product_code="WC_FLEX",
    amount=Decimal("2000000.00"),
    term_months=24,
)


def test_policy_version_matches_literal() -> None:
    assert POLICY_V1.version == _EXPECTED_VERSION
    assert POLICY_V1.version == POLICY_V1.version


def test_policy_version_is_stable_across_processes() -> None:
    backend_root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.domain.scoring.policy import POLICY_V1; print(POLICY_V1.version)",
        ],
        cwd=backend_root,
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == _EXPECTED_VERSION


def test_with_key_rate_returns_new_policy() -> None:
    updated = POLICY_V1.with_key_rate(Decimal("18.00"))

    assert updated is not POLICY_V1
    assert updated.key_rate_pct == Decimal("18.00")
    assert updated.version != POLICY_V1.version
    assert POLICY_V1.key_rate_pct == Decimal("16.50")
    assert POLICY_V1.version == _EXPECTED_VERSION
    assert price(updated.product("WC_FLEX"), Grade.A, 24, updated) == Decimal("22.50")


def test_policy_is_frozen() -> None:
    with pytest.raises(FrozenInstanceError):
        POLICY_V1.key_rate_pct = Decimal("18.00")


def test_bin_change_changes_version() -> None:
    changed = replace(
        POLICY_V1,
        bins_turnover_cv=(Bin(upper=None, points=99, code=ReasonCode.TURNOVER_STABLE),),
    )

    assert changed.version != POLICY_V1.version
    assert POLICY_V1.version == _EXPECTED_VERSION


def test_validate_request_returns_product() -> None:
    product = validate_request(_VALID_REQUEST, POLICY_V1)

    assert product.code == "WC_FLEX"


def test_validate_request_accepts_product_boundaries() -> None:
    assert validate_request(
        replace(_VALID_REQUEST, amount=Decimal("300000.00"), term_months=6),
        POLICY_V1,
    )
    assert validate_request(
        replace(_VALID_REQUEST, amount=Decimal("10000000.00"), term_months=36),
        POLICY_V1,
    )


def test_validate_request_unknown_product() -> None:
    with pytest.raises(PolicyViolation) as exc:
        validate_request(replace(_VALID_REQUEST, product_code="UNKNOWN"), POLICY_V1)

    assert exc.value.code == "UNKNOWN_PRODUCT"


@pytest.mark.parametrize("amount", [Decimal("299999.99"), Decimal("10000000.01")])
def test_validate_request_amount_out_of_range(amount: Decimal) -> None:
    with pytest.raises(PolicyViolation) as exc:
        validate_request(replace(_VALID_REQUEST, amount=amount), POLICY_V1)

    assert exc.value.code == "AMOUNT_OUT_OF_RANGE"


def test_validate_request_amount_not_multiple_of_step() -> None:
    with pytest.raises(PolicyViolation) as exc:
        validate_request(replace(_VALID_REQUEST, amount=Decimal("1234567.00")), POLICY_V1)

    assert exc.value.code == "AMOUNT_OUT_OF_RANGE"


@pytest.mark.parametrize("term_months", [5, 37])
def test_validate_request_term_out_of_range(term_months: int) -> None:
    with pytest.raises(PolicyViolation) as exc:
        validate_request(replace(_VALID_REQUEST, term_months=term_months), POLICY_V1)

    assert exc.value.code == "TERM_OUT_OF_RANGE"
