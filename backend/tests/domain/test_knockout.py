"""Тесты стоп-факторов К3: полнота, отсутствие раннего выхода, достаточность данных."""

from collections.abc import Callable
from dataclasses import replace
from datetime import date
from decimal import Decimal

from app.domain.enums import BkiSubject, FnsStatus, Impact, ReasonCode, Source
from app.domain.scoring.inputs import AccountData, BkiReport, ScoringInputs
from app.domain.scoring.knockout import check_data_sufficiency, check_knockouts
from app.domain.scoring.metrics import compute_metrics
from app.domain.scoring.policy import POLICY_V1


def _codes(inputs: ScoringInputs) -> list[ReasonCode]:
    return [factor.code for factor in check_knockouts(inputs, compute_metrics(inputs), POLICY_V1)]


def test_persona_p1_has_no_knockouts(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    assert _codes(persona_inputs("p1_ideal")) == []


def test_persona_p4_is_current_overdue(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    assert _codes(persona_inputs("p4_overdue")) == [ReasonCode.BKI_CURRENT_OVERDUE]


def test_overdue_of_person_is_a_knockout(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    # текущая просрочка у руководителя (subject=PERSON) — тоже стоп-фактор
    base = persona_inputs("p1_ideal")
    person = BkiReport(
        subject=BkiSubject.PERSON,
        current_overdue_days=10,
        max_overdue_days_12m=10,
        max_overdue_days_24m=10,
        inquiries_30d=0,
        monthly_payments=Decimal("0.00"),
        active_loans=1,
    )
    assert _codes(replace(base, bki=(*base.bki, person))) == [ReasonCode.BKI_CURRENT_OVERDUE]


def test_overdue_90_days_in_12_months(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    base = persona_inputs("p1_ideal")
    report = replace(base.bki[0], max_overdue_days_12m=90)
    assert _codes(replace(base, bki=(report,))) == [ReasonCode.BKI_OVERDUE_90_12M]


def test_all_violations_collected_without_early_exit(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    # три нарушения сразу: текущая просрочка, статус ФНС, приостановленные счета
    base = persona_inputs("p1_ideal")
    inputs = replace(
        base,
        fns=replace(base.fns, status=FnsStatus.LIQUIDATING, accounts_blocked=True),
        bki=(replace(base.bki[0], current_overdue_days=5),),
    )
    factors = check_knockouts(inputs, compute_metrics(inputs), POLICY_V1)
    assert [factor.code for factor in factors] == [
        ReasonCode.BKI_CURRENT_OVERDUE,
        ReasonCode.FNS_INACTIVE,
        ReasonCode.FNS_ACCOUNTS_BLOCKED,
    ]
    by_code = {factor.code: factor for factor in factors}
    assert by_code[ReasonCode.BKI_CURRENT_OVERDUE].source is Source.BKI
    assert by_code[ReasonCode.FNS_INACTIVE].source is Source.FNS
    for factor in factors:
        assert factor.impact is Impact.KNOCKOUT
        assert factor.points == 0
        assert factor.max_points == 0
        assert factor.value


def test_persona_p5_knockout_is_business_too_young(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    assert _codes(persona_inputs("p5_young")) == [ReasonCode.BUSINESS_TOO_YOUNG]


def test_business_age_boundary_is_three_months(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    # ровно 3 месяца — уже не «слишком молодой»
    base = persona_inputs("p5_young")
    inputs = replace(base, company=replace(base.company, registered_at=date(2026, 7, 24)))
    assert compute_metrics(inputs).business_age_months == 3
    assert _codes(inputs) == []


def test_p1_data_is_sufficient(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    inputs = persona_inputs("p1_ideal")
    assert check_data_sufficiency(compute_metrics(inputs), inputs, POLICY_V1) is None


def test_p5_data_is_insufficient(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    # P5: история счёта 2 месяца — мало данных
    inputs = persona_inputs("p5_young")
    factor = check_data_sufficiency(compute_metrics(inputs), inputs, POLICY_V1)
    assert factor is not None
    assert factor.code is ReasonCode.INSUFFICIENT_DATA
    assert factor.impact is Impact.KNOCKOUT
    assert factor.source is Source.ACCOUNT
    assert factor.points == 0
    assert factor.max_points == 0
    assert factor.value == "2 мес."


def test_three_months_of_history_is_enough(
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    base = persona_inputs("p5_young")
    account = AccountData(
        inflows=(Decimal("300000.00"), Decimal("450000.00"), Decimal("400000.00")),
        outflows=(Decimal("150000.00"), Decimal("300000.00"), Decimal("250000.00")),
    )
    inputs = replace(base, account=account)
    m = compute_metrics(inputs)
    assert m.history_months == 3
    assert check_data_sufficiency(m, inputs, POLICY_V1) is None
