"""Контракт К0: enums, frozen dataclass'ы, POLICY_V1, персоны-оракулы."""

from collections.abc import Callable
from dataclasses import FrozenInstanceError, fields, is_dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum
from inspect import isclass
from statistics import pstdev
from typing import Any, cast

import pytest

import app.domain.enums as enums_module
from app.domain.enums import (
    BkiSubject,
    ConstraintName,
    FnsStatus,
    Grade,
    Impact,
    LegalForm,
    OfferKind,
    Outcome,
    ReasonCode,
    ReviewFlag,
    Route,
    Source,
)
from app.domain.scoring.inputs import (
    AccountData,
    BkiReport,
    CompanyData,
    FnsData,
    LoanRequest,
    ScoringInputs,
)
from app.domain.scoring.policy import POLICY_V1, Bin
from app.domain.scoring.result import (
    Constraint,
    Factor,
    OfferDraft,
    PreApproval,
    ScoringResult,
    SimulationResult,
)
from app.seed.personas import RawExpected, RawPersona, load_raw, persona_ids

from .conftest import FIXED_AS_OF

# --- enums ---------------------------------------------------------------------------


def test_enum_values_equal_names() -> None:
    enum_classes = [
        obj
        for obj in vars(enums_module).values()
        if isclass(obj)
        and issubclass(obj, StrEnum)
        and obj is not StrEnum
        and obj.__module__ == enums_module.__name__
    ]
    assert enum_classes, "в app.domain.enums не нашлось ни одного enum"
    for cls in enum_classes:
        for member in cls:
            assert member.value == member.name, f"{cls.__name__}.{member.name} = {member.value!r}"


# --- frozen dataclass'ы --------------------------------------------------------------


def _sample_inputs() -> ScoringInputs:
    return ScoringInputs(
        as_of=FIXED_AS_OF,
        company=CompanyData(
            inn="770123456703",
            legal_form=LegalForm.IP,
            registered_at=date(2020, 8, 24),
            okved="47.19",
        ),
        fns=FnsData(
            status=FnsStatus.ACTIVE,
            accounts_blocked=False,
            declared_revenue_12m=Decimal("21000000.00"),
            tax_debt=Decimal("0.00"),
        ),
        bki=(
            BkiReport(
                subject=BkiSubject.COMPANY,
                current_overdue_days=0,
                max_overdue_days_12m=0,
                max_overdue_days_24m=0,
                inquiries_30d=1,
                monthly_payments=Decimal("0.00"),
                active_loans=0,
            ),
        ),
        account=AccountData(
            inflows=(Decimal("1620000.00"),),
            outflows=(Decimal("1170000.00"),),
        ),
    )


def _samples() -> list[tuple[str, object]]:
    inputs = _sample_inputs()
    factor = Factor(
        code=ReasonCode.TURNOVER_STABLE,
        source=Source.ACCOUNT,
        value="0.10",
        points=20,
        max_points=20,
        impact=Impact.POSITIVE,
        rule_id="M1",
    )
    constraint = Constraint(name=ConstraintName.DSCR, limit=Decimal("6736000.00"), binding=True)
    offer = OfferDraft(
        kind=OfferKind.REQUESTED,
        amount=Decimal("2000000.00"),
        term_months=24,
        rate_pct=Decimal("21.00"),
        monthly_payment=Decimal("102770.00"),
        overpayment=Decimal("466480.00"),
    )
    result = ScoringResult(
        recommendation=Outcome.APPROVED,
        route=Route.AUTO,
        score=100,
        grade=Grade.A,
        factors=(factor,),
        constraints=(constraint,),
        binding_constraint=ConstraintName.DSCR,
        offers=(offer,),
        top_reasons=(),
        review_flags=(),
        policy_version="v1-test",
    )
    simulation = SimulationResult(
        predicted_outcome=Outcome.APPROVED,
        requires_review=False,
        offers=(offer,),
        constraints=(constraint,),
        binding_constraint=ConstraintName.DSCR,
        max_amount_for_term=Decimal("6736000.00"),
        headroom=Decimal("4736000.00"),
    )
    pre_approval = PreApproval(
        product_code="WC_FLEX",
        amount=Decimal("8640000.00"),
        term_months=36,
        rate_pct=Decimal("21.50"),
        binding=ConstraintName.REVENUE,
    )
    return [
        ("CompanyData", inputs.company),
        ("FnsData", inputs.fns),
        ("BkiReport", inputs.bki[0]),
        ("AccountData", inputs.account),
        ("ScoringInputs", inputs),
        ("LoanRequest", LoanRequest("WC_FLEX", Decimal("2000000.00"), 24)),
        ("Factor", factor),
        ("Constraint", constraint),
        ("OfferDraft", offer),
        ("ScoringResult", result),
        ("SimulationResult", simulation),
        ("PreApproval", pre_approval),
    ]


@pytest.mark.parametrize(("name", "instance"), _samples(), ids=[name for name, _ in _samples()])
def test_dataclasses_are_frozen_with_slots(name: str, instance: object) -> None:
    assert is_dataclass(instance), f"{name} — не dataclass"
    slot_names = getattr(instance, "__slots__", None)
    assert slot_names is not None, f"{name} — без slots=True"
    assert {f.name for f in fields(instance)} == set(slot_names), f"{name} — slots != полям"
    first_field = fields(instance)[0].name
    with pytest.raises(FrozenInstanceError):
        setattr(instance, first_field, "mutation must fail")


# --- AccountData: валидация рядов ----------------------------------------------------


def test_account_data_rows_must_have_equal_length() -> None:
    with pytest.raises(ValueError, match="одной длины"):
        AccountData(inflows=(Decimal("100.00"),), outflows=(Decimal("50.00"), Decimal("50.00")))


def test_account_data_rejects_empty_rows() -> None:
    with pytest.raises(ValueError, match="ряды счёта не могут быть пустыми"):
        AccountData(inflows=(), outflows=())


def test_account_data_rejects_negative_amounts() -> None:
    with pytest.raises(ValueError, match="отрицательн"):
        AccountData(inflows=(Decimal("-1.00"),), outflows=(Decimal("0.00"),))


def test_account_data_rejects_float() -> None:
    # float вместо Decimal — TypeError (в тест передаётся именно float)
    with pytest.raises(TypeError, match="Decimal"):
        AccountData(inflows=cast(Any, (1.5,)), outflows=cast(Any, (1.5,)))


# --- FnsData & BkiReport: runtime валидация типов и диапазонов ------------------------


def test_fns_data_rejects_float() -> None:
    with pytest.raises(TypeError, match="Decimal"):
        FnsData(
            status=FnsStatus.ACTIVE,
            accounts_blocked=False,
            declared_revenue_12m=Decimal("1000.00"),
            tax_debt=cast(Any, 100.0),
        )
    with pytest.raises(TypeError, match="Decimal"):
        FnsData(
            status=FnsStatus.ACTIVE,
            accounts_blocked=False,
            declared_revenue_12m=cast(Any, 1000.0),
            tax_debt=Decimal("0.00"),
        )


def test_fns_data_rejects_negative_amounts() -> None:
    with pytest.raises(ValueError, match="отрицательн"):
        FnsData(
            status=FnsStatus.ACTIVE,
            accounts_blocked=False,
            declared_revenue_12m=Decimal("1000.00"),
            tax_debt=Decimal("-1.00"),
        )
    with pytest.raises(ValueError, match="отрицательн"):
        FnsData(
            status=FnsStatus.ACTIVE,
            accounts_blocked=False,
            declared_revenue_12m=Decimal("-1.00"),
            tax_debt=Decimal("0.00"),
        )


def test_bki_report_rejects_float_monthly_payments() -> None:
    with pytest.raises(TypeError, match="Decimal"):
        BkiReport(
            subject=BkiSubject.COMPANY,
            current_overdue_days=0,
            max_overdue_days_12m=0,
            max_overdue_days_24m=0,
            inquiries_30d=0,
            monthly_payments=cast(Any, 50000.0),
            active_loans=1,
        )


def test_bki_report_rejects_negative_monthly_payments() -> None:
    with pytest.raises(ValueError, match="отрицательн"):
        BkiReport(
            subject=BkiSubject.COMPANY,
            current_overdue_days=0,
            max_overdue_days_12m=0,
            max_overdue_days_24m=0,
            inquiries_30d=0,
            monthly_payments=Decimal("-1.00"),
            active_loans=1,
        )


# --- POLICY_V1 -----------------------------------------------------------------------

_BIN_GROUPS = (
    POLICY_V1.bins_turnover_cv,
    POLICY_V1.bins_debt_burden,
    POLICY_V1.bins_overdue_24m,
    POLICY_V1.bins_fns_mismatch,
    POLICY_V1.bins_business_age,
)


def test_bins_sorted_with_open_last() -> None:
    for group in _BIN_GROUPS:
        assert len(group) >= 2
        uppers = [b.upper for b in group]
        assert uppers[-1] is None, "последний бин должен быть open (upper=None)"
        finite = [u for u in uppers[:-1] if u is not None]
        assert all(a < b for a, b in zip(finite, finite[1:], strict=False)), "бины не отсортированы"
        for b in group:
            assert isinstance(b, Bin)


def test_scorecard_max_points_sum_is_100() -> None:
    assert sum(max(b.points for b in group) for group in _BIN_GROUPS) == 100


def test_grade_thresholds_descending() -> None:
    thresholds = [threshold for _, threshold in POLICY_V1.grade_thresholds]
    assert all(a > b for a, b in zip(thresholds, thresholds[1:], strict=False))


def test_products_min_less_than_max() -> None:
    assert len(POLICY_V1.products) >= 1
    for product in POLICY_V1.products:
        assert product.min_amount < product.max_amount, product.code
        assert product.min_term < product.max_term, product.code


# --- персоны -------------------------------------------------------------------------


def _personas() -> list[RawPersona]:
    return list(load_raw()["personas"])


def test_exactly_six_personas() -> None:
    assert len(_personas()) == 6
    assert len(persona_ids()) == 6


def test_unique_ids_logins_inns() -> None:
    ids = [str(p["id"]) for p in _personas()]
    logins = [str(p["login"]) for p in _personas()]
    inns = [str(p["company"]["inn"]) for p in _personas()]
    assert len(set(ids)) == 6
    assert len(set(logins)) == 6
    assert len(set(inns)) == 6


_INN10_WEIGHTS = (2, 4, 10, 3, 5, 9, 4, 6, 8)
_INN11_WEIGHTS = (7, 2, 4, 10, 3, 5, 9, 4, 6, 8)
_INN12_WEIGHTS = (3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8)


@pytest.mark.parametrize("persona", _personas(), ids=lambda p: str(p["id"]))
def test_inn_length_and_checksum(persona: RawPersona) -> None:
    inn = str(persona["company"]["inn"])
    digits = [int(ch) for ch in inn]
    if persona["company"]["legal_form"] == "IP":
        assert len(digits) == 12, "у ИП ИНН из 12 цифр"
        expected_11 = sum(w * d for w, d in zip(_INN11_WEIGHTS, digits[:10], strict=True)) % 11 % 10
        expected_12 = sum(w * d for w, d in zip(_INN12_WEIGHTS, digits[:11], strict=True)) % 11 % 10
        assert digits[10] == expected_11
        assert digits[11] == expected_12
    else:
        assert persona["company"]["legal_form"] == "OOO"
        assert len(digits) == 10, "у ООО ИНН из 10 цифр"
        expected_10 = sum(w * d for w, d in zip(_INN10_WEIGHTS, digits[:9], strict=True)) % 11 % 10
        assert digits[9] == expected_10


#: Цели статистики рядов из design.md §4 (допуск 0,1 %).
_ROW_TARGETS = {
    "p1_ideal": (Decimal("1800000.00"), Decimal("0.10"), Decimal("450000.00")),
    "p2_longer_term": (Decimal("1200000.00"), Decimal("0.35"), Decimal("200000.00")),
    "p3_reduced": (Decimal("2500000.00"), Decimal("0.35"), Decimal("500000.00")),
    "p6_mismatch": (Decimal("1500000.00"), Decimal("0.38"), Decimal("350000.00")),
}
_TOLERANCE = Decimal("0.001")


@pytest.mark.parametrize(("persona_id", "targets"), sorted(_ROW_TARGETS.items()))
def test_persona_row_statistics(
    persona_id: str,
    targets: tuple[Decimal, Decimal, Decimal],
    persona_inputs: Callable[[str], ScoringInputs],
) -> None:
    inputs = persona_inputs(persona_id)
    inflows = inputs.account.inflows
    outflows = inputs.account.outflows
    assert len(inflows) == len(outflows) >= 12
    mean_inflow = sum(inflows, Decimal("0")) / len(inflows)
    cv = pstdev(inflows) / mean_inflow
    ncf = sum((i - o for i, o in zip(inflows, outflows, strict=True)), Decimal("0")) / len(inflows)
    mean_target, cv_target, ncf_target = targets
    assert abs(mean_inflow - mean_target) <= mean_target * _TOLERANCE
    assert abs(cv - cv_target) <= cv_target * _TOLERANCE
    assert abs(ncf - ncf_target) <= ncf_target * _TOLERANCE


@pytest.mark.parametrize("persona_id", persona_ids())
def test_persona_as_of_is_fixed(
    persona_id: str, persona_inputs: Callable[[str], ScoringInputs]
) -> None:
    assert persona_inputs(persona_id).as_of == FIXED_AS_OF


@pytest.mark.parametrize("persona", _personas(), ids=lambda p: str(p["id"]))
def test_expected_values_are_valid_enums(persona: RawPersona) -> None:
    expected: RawExpected = persona["expected"]
    Outcome(str(expected["outcome"]))
    Route(str(expected["route"]))
    if expected["grade"] is not None:
        Grade(str(expected["grade"]))
    if expected["binding"] is not None:
        ConstraintName(str(expected["binding"]))
    for kind in expected["offer_kinds"]:
        OfferKind(str(kind))
    for code in expected["top_reasons"]:
        ReasonCode(str(code))
    for flag in expected["review_flags"]:
        ReviewFlag(str(flag))
    if expected["score"] is not None:
        int(str(expected["score"]))
