"""Тесты сериализации доменных снимков (credit-simulation spec).

Проверки:
- обратимость для всех персон: from_json(to_json(x)) == x (входы и результаты);
- JSON сериализуется через стандартный json.dumps без default=;
- в JSON нет float ни на каком уровне вложенности;
- Decimal("2500000.00") сохраняет масштаб после round-trip.
"""

import json
from decimal import Decimal

import pytest

from app.domain.scoring.engine import evaluate
from app.domain.scoring.policy import POLICY_V1
from app.domain.serialization import (
    canonical,
    inputs_from_json,
    inputs_to_json,
    result_from_json,
    result_to_json,
)
from app.seed.personas import RawPersona, load_inputs, load_raw, load_request

_PERSONAS: list[RawPersona] = load_raw()["personas"]
_PERSONA_IDS = tuple(persona["id"] for persona in _PERSONAS)


def _assert_no_float(obj: object) -> None:
    """Рекурсивная проверка отсутствия float в структурах данных."""
    if isinstance(obj, float):
        msg = f"найден float в сериализованных данных: {obj}"
        raise AssertionError(msg)
    if isinstance(obj, dict):
        for k, v in obj.items():
            _assert_no_float(k)
            _assert_no_float(v)
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            _assert_no_float(item)


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_inputs_round_trip(raw: RawPersona) -> None:
    persona_id = raw["id"]
    inp = load_inputs(persona_id)

    payload = inputs_to_json(inp)
    _assert_no_float(payload)

    # Проходит через json.dumps без default=
    dumped = json.dumps(payload, ensure_ascii=False)
    loaded = json.loads(dumped)

    restored = inputs_from_json(loaded)
    assert restored == inp


@pytest.mark.parametrize("raw", _PERSONAS, ids=_PERSONA_IDS)
def test_result_round_trip(raw: RawPersona) -> None:
    persona_id = raw["id"]
    inp = load_inputs(persona_id)
    req = load_request(persona_id)
    eval_res = evaluate(inp, req, POLICY_V1)

    payload = result_to_json(eval_res)
    _assert_no_float(payload)

    # Проходит через json.dumps без default=
    dumped = json.dumps(payload, ensure_ascii=False)
    loaded = json.loads(dumped)

    restored = result_from_json(loaded)
    assert restored == eval_res


def test_decimal_scale_preserved() -> None:
    val = Decimal("2500000.00")
    base = load_inputs("p1_ideal")
    inp = base.__class__(
        as_of=base.as_of,
        company=base.company,
        fns=base.fns.__class__(
            status=base.fns.status,
            accounts_blocked=base.fns.accounts_blocked,
            declared_revenue_12m=val,
            tax_debt=base.fns.tax_debt,
        ),
        bki=base.bki,
        account=base.account,
    )

    payload = inputs_to_json(inp)
    assert payload["fns"]["declared_revenue_12m"] == "2500000.00"  # type: ignore[index]

    restored = inputs_from_json(payload)
    restored_val = restored.fns.declared_revenue_12m
    assert restored_val == val
    assert str(restored_val) == "2500000.00"


def test_canonical_produces_stable_json() -> None:
    c = canonical(POLICY_V1)
    _assert_no_float(c)
    dumped = json.dumps(c, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert dumped
