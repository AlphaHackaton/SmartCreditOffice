"""Тесты движка К5: персоны-оракулы, флаги ручной проверки и golden-файлы."""

import json
from dataclasses import replace
from decimal import Decimal

import pytest

from app.domain.enums import ConstraintName, Grade, Outcome, ReasonCode, ReviewFlag, Route
from app.domain.scoring.engine import evaluate
from app.domain.scoring.inputs import LoanRequest
from app.domain.scoring.policy import POLICY_V1
from app.domain.scoring.result import ScoringResult
from app.seed.personas import RawPersona, load_inputs, load_raw, load_request

from .regen_golden import (
    diff_payload,
    golden_path,
    load_golden,
    result_to_payload,
    update_requested,
    write_golden,
)

_PERSONAS: list[RawPersona] = load_raw()["personas"]
_PERSONA_IDS = tuple(persona["id"] for persona in _PERSONAS)


def _evaluate(persona_id: str, request: LoanRequest | None = None) -> ScoringResult:
    return evaluate(load_inputs(persona_id), request or load_request(persona_id), POLICY_V1)


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_persona_matches_oracle(raw: RawPersona) -> None:
    result = _evaluate(raw["id"])
    expected = raw["expected"]

    assert result.recommendation is Outcome(expected["outcome"])
    assert result.route is Route(expected["route"])
    assert result.score == (None if expected["score"] is None else int(expected["score"]))
    assert result.grade == (None if expected["grade"] is None else Grade(expected["grade"]))
    assert tuple(offer.kind.value for offer in result.offers) == tuple(expected["offer_kinds"])
    assert result.binding_constraint == (
        None if expected["binding"] is None else ConstraintName(expected["binding"])
    )
    assert tuple(code.value for code in result.top_reasons) == tuple(expected["top_reasons"])
    assert tuple(flag.value for flag in result.review_flags) == tuple(expected["review_flags"])
    assert result.policy_version == POLICY_V1.version


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_persona_factors_have_client_text(raw: RawPersona) -> None:
    result = _evaluate(raw["id"])

    assert result.factors
    for factor in result.factors:
        assert factor.client_text
        assert "{" not in factor.client_text
        assert "}" not in factor.client_text


def test_p1_offer_rate_and_payment() -> None:
    result = _evaluate("p1_ideal")

    offer = result.offers[0]
    assert offer.amount == Decimal("2000000.00")
    assert offer.term_months == 24
    assert offer.rate_pct == Decimal("21.00")
    assert abs(offer.monthly_payment - Decimal("102770")) <= Decimal("10")


def test_p6_is_approved_but_needs_underwriting() -> None:
    result = _evaluate("p6_mismatch")

    assert result.recommendation is Outcome.APPROVED
    assert result.route is Route.UNDERWRITING
    assert result.review_flags == (ReviewFlag.FNS_MISMATCH,)
    assert ReasonCode.FNS_MISMATCH in result.top_reasons


def test_amount_above_auto_limit_requires_underwriting() -> None:
    request = replace(load_request("p1_ideal"), amount=Decimal("6000000.00"))

    result = _evaluate("p1_ideal", request)

    assert result.recommendation is Outcome.APPROVED
    assert result.route is Route.UNDERWRITING
    assert result.review_flags == (ReviewFlag.AMOUNT_ABOVE_AUTO_LIMIT,)


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_evaluate_is_deterministic(raw: RawPersona) -> None:
    assert _evaluate(raw["id"]) == _evaluate(raw["id"])


def _has_float(value: object) -> bool:
    if isinstance(value, float):
        return True
    if isinstance(value, dict):
        return any(_has_float(item) for item in value.values())
    if isinstance(value, list):
        return any(_has_float(item) for item in value)
    return False


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_golden_payload_is_strict_json(raw: RawPersona) -> None:
    payload = result_to_payload(_evaluate(raw["id"]))

    assert not _has_float(payload)
    assert json.loads(json.dumps(payload, ensure_ascii=False)) == payload


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_result_matches_golden(raw: RawPersona) -> None:
    result = _evaluate(raw["id"])
    if update_requested():
        write_golden(raw["id"], result)

    assert golden_path(raw["id"]).exists(), (
        f"нет golden-файла {raw['id']}; генерация: UPDATE_GOLDEN=1 pytest"
    )
    diff = diff_payload(load_golden(raw["id"]), result_to_payload(result))
    assert not diff, "\n".join(diff)
