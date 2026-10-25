"""Сериализация снимков домена (входы и результаты) в JSONB/JSON.

Dev 2 использует эти функции для сохранения снимков в БД и передачи по API.
Все типы сериализуются в стандартные JSON-структуры без `float`:
- `Decimal` → `str` (сохраняет масштаб, например "2500000.00");
- `date` → `str` (ISO-8601, "YYYY-MM-DD");
- `Enum` → `str` (его строковое значение `value`);
- `tuple` → `list`.
Обратное преобразование восстанавливает точные типы и значения.
"""

from collections.abc import Mapping
from dataclasses import fields, is_dataclass
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Final

from .enums import (
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
from .scoring.inputs import (
    AccountData,
    BkiReport,
    CompanyData,
    FnsData,
    ScoringInputs,
)
from .scoring.result import (
    Constraint,
    Factor,
    OfferDraft,
    ScoringResult,
)

#: Разрешённые базовые типы канонического JSON.
CanonicalScalar = str | int | bool | None


def _json_scalar(value: object) -> object:
    """Enum → его значение, остальные скаляры — без изменений."""
    if isinstance(value, Enum):
        return value.value
    return value


def canonical(value: object) -> object:
    """Каноническое представление для стабильного хеша политики (без Any).

    `Decimal` → строка, `Enum` → значение, `Mapping` → отсортированные пары,
    dataclass → словарь полей, tuple/list → список.
    """
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Mapping):
        items = sorted(value.items(), key=lambda item: str(_json_scalar(item[0])))
        return [[str(_json_scalar(key)), canonical(item)] for key, item in items]
    if is_dataclass(value) and not isinstance(value, type):
        return {field.name: canonical(getattr(value, field.name)) for field in fields(value)}
    if isinstance(value, (tuple, list)):
        return [canonical(item) for item in value]
    if value is None or isinstance(value, (str, int, bool)):
        return value
    msg = f"не удалось канонизировать значение типа {type(value).__name__}"
    raise TypeError(msg)


def inputs_to_json(inp: ScoringInputs) -> dict[str, object]:
    """Сериализовать `ScoringInputs` в JSON-совместимый словарь (без float)."""
    return {
        "as_of": inp.as_of.isoformat(),
        "company": {
            "inn": inp.company.inn,
            "legal_form": inp.company.legal_form.value,
            "registered_at": inp.company.registered_at.isoformat(),
            "okved": inp.company.okved,
        },
        "fns": {
            "status": inp.fns.status.value,
            "accounts_blocked": inp.fns.accounts_blocked,
            "declared_revenue_12m": (
                str(inp.fns.declared_revenue_12m)
                if inp.fns.declared_revenue_12m is not None
                else None
            ),
            "tax_debt": str(inp.fns.tax_debt),
        },
        "bki": [
            {
                "subject": report.subject.value,
                "current_overdue_days": report.current_overdue_days,
                "max_overdue_days_12m": report.max_overdue_days_12m,
                "max_overdue_days_24m": report.max_overdue_days_24m,
                "inquiries_30d": report.inquiries_30d,
                "monthly_payments": str(report.monthly_payments),
                "active_loans": report.active_loans,
            }
            for report in inp.bki
        ],
        "account": {
            "inflows": [str(val) for val in inp.account.inflows],
            "outflows": [str(val) for val in inp.account.outflows],
        },
    }


def inputs_from_json(data: Mapping[str, object]) -> ScoringInputs:
    """Восстановить `ScoringInputs` из словаря (Decimal, date, enums)."""
    company_data = data["company"]
    if not isinstance(company_data, Mapping):
        msg = f"company: ожидается Mapping, получено {type(company_data).__name__}"
        raise TypeError(msg)
    company = CompanyData(
        inn=str(company_data["inn"]),
        legal_form=LegalForm(str(company_data["legal_form"])),
        registered_at=date.fromisoformat(str(company_data["registered_at"])),
        okved=str(company_data["okved"]),
    )

    fns_data = data["fns"]
    if not isinstance(fns_data, Mapping):
        msg = f"fns: ожидается Mapping, получено {type(fns_data).__name__}"
        raise TypeError(msg)
    declared_raw = fns_data.get("declared_revenue_12m")
    fns = FnsData(
        status=FnsStatus(str(fns_data["status"])),
        accounts_blocked=bool(fns_data["accounts_blocked"]),
        declared_revenue_12m=Decimal(str(declared_raw)) if declared_raw is not None else None,
        tax_debt=Decimal(str(fns_data["tax_debt"])),
    )

    bki_list = data["bki"]
    if not isinstance(bki_list, list):
        msg = f"bki: ожидается list, получено {type(bki_list).__name__}"
        raise TypeError(msg)
    bki_reports: list[BkiReport] = []
    for item in bki_list:
        if not isinstance(item, Mapping):
            msg = f"bki item: ожидается Mapping, получено {type(item).__name__}"
            raise TypeError(msg)
        bki_reports.append(
            BkiReport(
                subject=BkiSubject(str(item["subject"])),
                current_overdue_days=int(str(item["current_overdue_days"])),
                max_overdue_days_12m=int(str(item["max_overdue_days_12m"])),
                max_overdue_days_24m=int(str(item["max_overdue_days_24m"])),
                inquiries_30d=int(str(item["inquiries_30d"])),
                monthly_payments=Decimal(str(item["monthly_payments"])),
                active_loans=int(str(item["active_loans"])),
            )
        )

    account_data = data["account"]
    if not isinstance(account_data, Mapping):
        msg = f"account: ожидается Mapping, получено {type(account_data).__name__}"
        raise TypeError(msg)
    inflows_raw = account_data["inflows"]
    outflows_raw = account_data["outflows"]
    if not isinstance(inflows_raw, (list, tuple)) or not isinstance(outflows_raw, (list, tuple)):
        msg = "account inflows/outflows: ожидаются list или tuple"
        raise TypeError(msg)

    account = AccountData(
        inflows=tuple(Decimal(str(val)) for val in inflows_raw),
        outflows=tuple(Decimal(str(val)) for val in outflows_raw),
    )

    return ScoringInputs(
        as_of=date.fromisoformat(str(data["as_of"])),
        company=company,
        fns=fns,
        bki=tuple(bki_reports),
        account=account,
    )


def result_to_json(r: ScoringResult) -> dict[str, object]:
    """Сериализовать `ScoringResult` в JSON-совместимый словарь (без float)."""
    return {
        "recommendation": r.recommendation.value,
        "route": r.route.value,
        "score": r.score,
        "grade": r.grade.value if r.grade is not None else None,
        "factors": [
            {
                "code": f.code.value,
                "source": f.source.value,
                "value": f.value,
                "points": f.points,
                "max_points": f.max_points,
                "impact": f.impact.value,
                "rule_id": f.rule_id,
                "client_text": f.client_text,
                "hint": f.hint,
            }
            for f in r.factors
        ],
        "constraints": [
            {
                "name": c.name.value,
                "limit": str(c.limit),
                "binding": c.binding,
            }
            for c in r.constraints
        ],
        "binding_constraint": (
            r.binding_constraint.value if r.binding_constraint is not None else None
        ),
        "offers": [
            {
                "kind": o.kind.value,
                "amount": str(o.amount),
                "term_months": o.term_months,
                "rate_pct": str(o.rate_pct),
                "monthly_payment": str(o.monthly_payment),
                "overpayment": str(o.overpayment),
            }
            for o in r.offers
        ],
        "top_reasons": [tr.value for tr in r.top_reasons],
        "review_flags": [rf.value for rf in r.review_flags],
        "policy_version": r.policy_version,
    }


def result_from_json(data: Mapping[str, object]) -> ScoringResult:
    """Восстановить `ScoringResult` из словаря."""
    score_raw = data.get("score")
    grade_raw = data.get("grade")
    binding_raw = data.get("binding_constraint")

    factors_raw = data.get("factors", [])
    if not isinstance(factors_raw, list):
        msg = f"factors: ожидается list, получено {type(factors_raw).__name__}"
        raise TypeError(msg)
    factors: list[Factor] = []
    for f in factors_raw:
        if not isinstance(f, Mapping):
            msg = f"factor: ожидается Mapping, получено {type(f).__name__}"
            raise TypeError(msg)
        hint_raw = f.get("hint")
        factors.append(
            Factor(
                code=ReasonCode(str(f["code"])),
                source=Source(str(f["source"])),
                value=str(f["value"]),
                points=int(str(f["points"])),
                max_points=int(str(f["max_points"])),
                impact=Impact(str(f["impact"])),
                rule_id=str(f["rule_id"]),
                client_text=str(f.get("client_text", "")),
                hint=str(hint_raw) if hint_raw is not None else None,
            )
        )

    constraints_raw = data.get("constraints", [])
    if not isinstance(constraints_raw, list):
        msg = f"constraints: ожидается list, получено {type(constraints_raw).__name__}"
        raise TypeError(msg)
    constraints: list[Constraint] = []
    for c in constraints_raw:
        if not isinstance(c, Mapping):
            msg = f"constraint: ожидается Mapping, получено {type(c).__name__}"
            raise TypeError(msg)
        constraints.append(
            Constraint(
                name=ConstraintName(str(c["name"])),
                limit=Decimal(str(c["limit"])),
                binding=bool(c["binding"]),
            )
        )

    offers_raw = data.get("offers", [])
    if not isinstance(offers_raw, list):
        msg = f"offers: ожидается list, получено {type(offers_raw).__name__}"
        raise TypeError(msg)
    offers: list[OfferDraft] = []
    for o in offers_raw:
        if not isinstance(o, Mapping):
            msg = f"offer: ожидается Mapping, получено {type(o).__name__}"
            raise TypeError(msg)
        offers.append(
            OfferDraft(
                kind=OfferKind(str(o["kind"])),
                amount=Decimal(str(o["amount"])),
                term_months=int(str(o["term_months"])),
                rate_pct=Decimal(str(o["rate_pct"])),
                monthly_payment=Decimal(str(o["monthly_payment"])),
                overpayment=Decimal(str(o["overpayment"])),
            )
        )

    top_reasons_raw = data.get("top_reasons", [])
    if not isinstance(top_reasons_raw, list):
        msg = f"top_reasons: ожидается list, получено {type(top_reasons_raw).__name__}"
        raise TypeError(msg)

    review_flags_raw = data.get("review_flags", [])
    if not isinstance(review_flags_raw, list):
        msg = f"review_flags: ожидается list, получено {type(review_flags_raw).__name__}"
        raise TypeError(msg)

    return ScoringResult(
        recommendation=Outcome(str(data["recommendation"])),
        route=Route(str(data["route"])),
        score=int(str(score_raw)) if score_raw is not None else None,
        grade=Grade(str(grade_raw)) if grade_raw is not None else None,
        factors=tuple(factors),
        constraints=tuple(constraints),
        binding_constraint=ConstraintName(str(binding_raw)) if binding_raw is not None else None,
        offers=tuple(offers),
        top_reasons=tuple(ReasonCode(str(code)) for code in top_reasons_raw),
        review_flags=tuple(ReviewFlag(str(flag)) for flag in review_flags_raw),
        policy_version=str(data["policy_version"]),
    )


__all__: Final = [
    "canonical",
    "inputs_from_json",
    "inputs_to_json",
    "result_from_json",
    "result_to_json",
]
