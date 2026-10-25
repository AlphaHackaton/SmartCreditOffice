"""Свойства безопасности ядра кредитования (hypothesis, tasks.md К6, credit-simulation spec).

Проверяемые свойства:
- снижение outflows (рост NCF) не ухудшает ранг исхода (REJECTED < COUNTER_OFFER < APPROVED)
  и не уменьшает max_amount_for_term;
- рост key_rate не увеличивает лимит;
- у каждого оффера dscr_min × (existing + payment) ≤ ncf;
- все офферы проходят validate_request;
- evaluate детерминирован и укладывается в 50 мс (deadline);
- evaluate не бросает исключений, кроме PolicyViolation;
- стоп-факторы и грейд D всегда приводят к REJECTED с пустыми офферами.
"""

import contextlib
from dataclasses import replace
from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.dates import add_months
from app.domain.enums import (
    BkiSubject,
    FnsStatus,
    Grade,
    Outcome,
)
from app.domain.errors import PolicyViolation
from app.domain.scoring.engine import evaluate, simulate
from app.domain.scoring.inputs import (
    AccountData,
    BkiReport,
    LoanRequest,
    ScoringInputs,
)
from app.domain.scoring.knockout import check_data_sufficiency, check_knockouts
from app.domain.scoring.metrics import compute_metrics
from app.domain.scoring.policy import POLICY_V1, validate_request
from app.domain.scoring.scorecard import score
from app.seed.personas import load_inputs

# Базовый снимок клиента P1 для генерации корректных данных
_BASE_INP = load_inputs("p1_ideal")


def _outcome_rank(outcome: Outcome) -> int:
    """Ранг исхода для проверки ненарушения монотонности."""
    if outcome is Outcome.REJECTED:
        return 0
    if outcome is Outcome.COUNTER_OFFER:
        return 1
    if outcome is Outcome.APPROVED:
        return 2
    return -1


# Стратегия для сумм Decimal с двумя знаками после запятой
decimal_amounts = st.decimals(
    min_value=Decimal("100000.00"),
    max_value=Decimal("5000000.00"),
    allow_nan=False,
    allow_infinity=False,
    places=2,
)


# Генератор 12 месяцев поступлений и расходов
@st.composite
def account_strategy(draw: st.DrawFn) -> AccountData:
    inflows = tuple(draw(st.lists(decimal_amounts, min_size=12, max_size=12)))
    # Расходы неотрицательные и в разумных границах
    outflows = tuple(
        draw(
            st.lists(
                st.decimals(
                    min_value=Decimal("10000.00"),
                    max_value=Decimal("4000000.00"),
                    allow_nan=False,
                    allow_infinity=False,
                    places=2,
                ),
                min_size=12,
                max_size=12,
            )
        )
    )
    return AccountData(inflows=inflows, outflows=outflows)


# Генератор снимков ScoringInputs в границах домена (включая стоп-факторы и грейд D)
@st.composite
def inputs_strategy(draw: st.DrawFn) -> ScoringInputs:
    account = draw(account_strategy())
    monthly_debt = draw(
        st.decimals(
            min_value=Decimal("0.00"),
            max_value=Decimal("1500000.00"),
            allow_nan=False,
            allow_infinity=False,
            places=2,
        )
    )
    current_overdue = draw(st.one_of(st.just(0), st.integers(min_value=0, max_value=60)))
    overdue_days_12m = draw(st.one_of(st.just(0), st.integers(min_value=0, max_value=120)))
    overdue_days_12m = max(current_overdue, overdue_days_12m)
    overdue_days_24m = draw(st.integers(min_value=overdue_days_12m, max_value=180))
    inquiries = draw(st.integers(min_value=0, max_value=10))

    bki = (
        BkiReport(
            subject=BkiSubject.COMPANY,
            current_overdue_days=current_overdue,
            max_overdue_days_12m=overdue_days_12m,
            max_overdue_days_24m=overdue_days_24m,
            inquiries_30d=inquiries,
            monthly_payments=monthly_debt,
            active_loans=1 if monthly_debt > 0 else 0,
        ),
    )

    declared = draw(
        st.one_of(
            st.none(),
            st.just(Decimal("0.00")),
            st.decimals(
                min_value=Decimal("100000.00"),
                max_value=Decimal("60000000.00"),
                allow_nan=False,
                allow_infinity=False,
                places=2,
            ),
        )
    )

    tax_debt = draw(
        st.one_of(
            st.just(Decimal("0.00")),
            st.decimals(
                min_value=Decimal("0.00"),
                max_value=Decimal("200000.00"),
                allow_nan=False,
                allow_infinity=False,
                places=2,
            ),
        )
    )

    fns_status = draw(
        st.sampled_from(
            [
                FnsStatus.ACTIVE,
                FnsStatus.ACTIVE,
                FnsStatus.ACTIVE,
                FnsStatus.LIQUIDATING,
                FnsStatus.LIQUIDATED,
            ]
        )
    )
    accounts_blocked = draw(st.sampled_from([False, False, False, True]))

    fns = replace(
        _BASE_INP.fns,
        status=fns_status,
        accounts_blocked=accounts_blocked,
        declared_revenue_12m=declared,
        tax_debt=tax_debt,
    )

    months_old = draw(st.sampled_from([3, 8, 18, 30, 48]))
    company_registered = add_months(_BASE_INP.as_of, -months_old)
    company = replace(_BASE_INP.company, registered_at=company_registered)

    return replace(
        _BASE_INP,
        company=company,
        account=account,
        bki=bki,
        fns=fns,
    )


# Генератор запросов клиента (кратных шагу 10 000, в сетке сроков)
@st.composite
def request_strategy(draw: st.DrawFn) -> LoanRequest:
    product_code = draw(st.sampled_from(["WC_FLEX", "CAPEX"]))
    product = POLICY_V1.product(product_code)
    # Суммы, кратные шагу 10 000 в границах продукта
    steps = int((product.max_amount - product.min_amount) / POLICY_V1.amount_step)
    step_idx = draw(st.integers(min_value=0, max_value=steps))
    amount = product.min_amount + Decimal(str(step_idx)) * POLICY_V1.amount_step
    # Сроки из сетки продукта
    if product_code == "WC_FLEX":
        terms = [6, 12, 18, 24, 30, 36]
    else:
        terms = [12, 18, 24, 30, 36, 42, 48, 54, 60]
    term_months = draw(st.sampled_from(terms))
    return LoanRequest(product_code=product_code, amount=amount, term_months=term_months)


@settings(max_examples=50, deadline=50)
@given(inp=inputs_strategy(), req=request_strategy())
def test_evaluate_is_deterministic_and_within_deadline(
    inp: ScoringInputs, req: LoanRequest
) -> None:
    res1 = evaluate(inp, req, POLICY_V1)
    res2 = evaluate(inp, req, POLICY_V1)
    assert res1 == res2


@settings(max_examples=50, deadline=100)
@given(inp=inputs_strategy(), req=request_strategy())
def test_outflows_reduction_does_not_degrade_outcome_or_limit(
    inp: ScoringInputs, req: LoanRequest
) -> None:
    res1 = evaluate(inp, req, POLICY_V1)
    sim1 = simulate(inp, req, POLICY_V1)

    # Снижаем расходы на 20% (рост NCF)
    reduced_outflows = tuple(
        (val * Decimal("0.80")).quantize(Decimal("0.01")) for val in inp.account.outflows
    )
    inp2 = replace(inp, account=AccountData(inflows=inp.account.inflows, outflows=reduced_outflows))

    res2 = evaluate(inp2, req, POLICY_V1)
    sim2 = simulate(inp2, req, POLICY_V1)

    # Ранг исхода не ухудшается
    assert _outcome_rank(res2.recommendation) >= _outcome_rank(res1.recommendation)
    # max_amount_for_term не уменьшается
    assert sim2.max_amount_for_term >= sim1.max_amount_for_term


@settings(max_examples=50, deadline=100)
@given(
    inp=inputs_strategy(),
    req=request_strategy(),
    key_rate_bump=st.sampled_from([Decimal("1.00"), Decimal("2.50"), Decimal("5.00")]),
)
def test_key_rate_increase_does_not_increase_limit(
    inp: ScoringInputs, req: LoanRequest, key_rate_bump: Decimal
) -> None:
    p1 = POLICY_V1
    p2 = POLICY_V1.with_key_rate(POLICY_V1.key_rate_pct + key_rate_bump)

    sim1 = simulate(inp, req, p1)
    sim2 = simulate(inp, req, p2)

    assert sim2.max_amount_for_term <= sim1.max_amount_for_term


@settings(max_examples=50, deadline=100)
@given(inp=inputs_strategy(), req=request_strategy())
def test_every_offer_respects_dscr_and_validates(inp: ScoringInputs, req: LoanRequest) -> None:
    res = evaluate(inp, req, POLICY_V1)
    metrics = compute_metrics(inp)

    for offer in res.offers:
        # Каждый оффер проходит validate_request
        offer_req = LoanRequest(req.product_code, offer.amount, offer.term_months)
        validate_request(offer_req, POLICY_V1)

        # dscr_min × (existing + payment) ≤ ncf
        dscr_check = POLICY_V1.dscr_min * (metrics.existing_payments + offer.monthly_payment)
        assert dscr_check <= metrics.ncf


@settings(max_examples=50, deadline=100)
@given(inp=inputs_strategy(), req=request_strategy())
def test_evaluate_no_exceptions_except_policy_violation(
    inp: ScoringInputs, req: LoanRequest
) -> None:
    with contextlib.suppress(PolicyViolation):
        evaluate(inp, req, POLICY_V1)


@settings(max_examples=50, deadline=100)
@given(inp=inputs_strategy(), req=request_strategy())
def test_knockouts_and_grade_d_always_yield_rejection(inp: ScoringInputs, req: LoanRequest) -> None:
    res = evaluate(inp, req, POLICY_V1)
    metrics = compute_metrics(inp)
    knockouts = check_knockouts(inp, metrics, POLICY_V1)
    data_gap = check_data_sufficiency(metrics, inp, POLICY_V1)
    if knockouts or data_gap is not None:
        assert res.recommendation is Outcome.REJECTED
        assert res.offers == ()
        assert res.grade is None
        return

    _, grade, _ = score(metrics, POLICY_V1)
    if grade is Grade.D:
        assert res.recommendation is Outcome.REJECTED
        assert res.offers == ()
        assert res.grade is Grade.D
