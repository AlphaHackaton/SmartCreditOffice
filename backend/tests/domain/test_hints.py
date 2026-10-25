"""Тесты контрфактических подсказок (design.md §4, credit-simulation spec).

Проверки:
- P5: дата add_months(registered_at, 3) в формате ДД.ММ.ГГГГ;
- P2: DSCR_BELOW_MIN с упоминанием срока 30 мес;
- P3: максимальная доступная сумма;
- честность: каждая подсказка, проигранная через simulate, даёт обещанный исход.
"""

from decimal import Decimal

from app.domain.dates import add_months
from app.domain.enums import Outcome, ReasonCode
from app.domain.scoring.engine import evaluate, simulate
from app.domain.scoring.explain import hints
from app.domain.scoring.inputs import LoanRequest
from app.domain.scoring.metrics import compute_metrics
from app.domain.scoring.policy import POLICY_V1
from app.seed.personas import load_inputs, load_request


def test_p5_young_business_hint_contains_eligibility_date() -> None:
    inp = load_inputs("p5_young")
    req = load_request("p5_young")
    metrics = compute_metrics(inp)
    eval_res = evaluate(inp, req, POLICY_V1)

    h = hints(metrics, eval_res, inp, POLICY_V1)

    assert ReasonCode.BUSINESS_TOO_YOUNG in h
    expected_date = add_months(inp.company.registered_at, 3).strftime("%d.%m.%Y")
    assert expected_date in h[ReasonCode.BUSINESS_TOO_YOUNG]


def test_p2_dscr_hint_mentions_30_months_and_replays_successfully() -> None:
    inp = load_inputs("p2_longer_term")
    req = load_request("p2_longer_term")
    metrics = compute_metrics(inp)
    eval_res = evaluate(inp, req, POLICY_V1)

    h = hints(metrics, eval_res, inp, POLICY_V1)

    assert ReasonCode.DSCR_BELOW_MIN in h
    assert "30 мес" in h[ReasonCode.DSCR_BELOW_MIN]

    # Проигрывание подсказки через simulate даёт APPROVED
    replay_req = LoanRequest(req.product_code, req.amount, 30)
    sim_res = simulate(inp, replay_req, POLICY_V1)
    assert sim_res.predicted_outcome is Outcome.APPROVED


def test_p3_reduced_hint_mentions_max_amount_and_replays_successfully() -> None:
    inp = load_inputs("p3_reduced")
    req = load_request("p3_reduced")
    metrics = compute_metrics(inp)
    eval_res = evaluate(inp, req, POLICY_V1)

    h = hints(metrics, eval_res, inp, POLICY_V1)

    assert ReasonCode.DSCR_BELOW_MIN in h
    assert "3 450 000" in h[ReasonCode.DSCR_BELOW_MIN]

    # Проигрывание подсказки через simulate даёт APPROVED
    replay_req = LoanRequest(req.product_code, Decimal("3450000.00"), req.term_months)
    sim_res = simulate(inp, replay_req, POLICY_V1)
    assert sim_res.predicted_outcome is Outcome.APPROVED
