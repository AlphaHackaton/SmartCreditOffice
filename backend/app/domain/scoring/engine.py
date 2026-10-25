"""Движок кредитного решения: `evaluate` — К5, `simulate`/`pre_approve` — К6.

`evaluate` идёт по шагам design.md §2: валидация запроса, метрики, стоп-факторы,
достаточность данных, скоринговая карта, контроффер, флаги ручной проверки,
объяснения. Ветки возвращают один и тот же `ScoringResult`; `top_reasons`
строятся из уже отрендеренных факторов. `simulate` и `pre_approve` (К6) будут
использовать общее приватное ядро — дублирование логики запрещено.
"""

from decimal import Decimal

from ..enums import ConstraintName, Grade, Impact, Outcome, ReasonCode, ReviewFlag, Route, Source
from .counter_offer import build_offers, reject_reason
from .explain import render, top_reasons
from .inputs import LoanRequest, ScoringInputs
from .knockout import check_data_sufficiency, check_knockouts
from .metrics import compute_metrics
from .policy import Policy, validate_request
from .result import (
    Constraint,
    Factor,
    OfferDraft,
    PreApproval,
    ScoringResult,
    SimulationResult,
)
from .scorecard import score


def _decision_factor(code: ReasonCode, value: str, rule_id: str) -> Factor:
    """Фактор решения (без баллов): стоп-причина отказа или низкий балл."""
    return Factor(
        code=code,
        source=Source.POLICY,
        value=value,
        points=0,
        max_points=0,
        impact=Impact.KNOCKOUT,
        rule_id=rule_id,
    )


def _result(
    *,
    recommendation: Outcome,
    route: Route,
    score_value: int | None,
    grade: Grade | None,
    factors: tuple[Factor, ...],
    constraints: tuple[Constraint, ...],
    binding: ConstraintName | None,
    offers: tuple[OfferDraft, ...],
    flags: tuple[ReviewFlag, ...],
    policy: Policy,
) -> ScoringResult:
    """Собрать результат: заполнить `client_text` и `top_reasons`."""
    rendered = tuple(render(factor) for factor in factors)
    return ScoringResult(
        recommendation=recommendation,
        route=route,
        score=score_value,
        grade=grade,
        factors=rendered,
        constraints=constraints,
        binding_constraint=binding,
        offers=offers,
        top_reasons=top_reasons(rendered, binding, recommendation),
        review_flags=flags,
        policy_version=policy.version,
    )


def evaluate(inp: ScoringInputs, req: LoanRequest, policy: Policy) -> ScoringResult:
    """Решение по заявке: исход, маршрут, факторы, офферы, объяснения."""
    product = validate_request(req, policy)
    metrics = compute_metrics(inp)
    knockouts = check_knockouts(inp, metrics, policy)
    data_gap = check_data_sufficiency(metrics, inp, policy)

    if knockouts:
        factors = list(knockouts)
        if data_gap is not None:
            factors.append(data_gap)
        return _result(
            recommendation=Outcome.REJECTED,
            route=Route.AUTO,
            score_value=None,
            grade=None,
            factors=tuple(factors),
            constraints=(),
            binding=None,
            offers=(),
            flags=(),
            policy=policy,
        )

    if data_gap is not None:
        declared = inp.fns.declared_revenue_12m is not None
        return _result(
            recommendation=Outcome.REJECTED,
            route=Route.UNDERWRITING if declared else Route.AUTO,
            score_value=None,
            grade=None,
            factors=(data_gap,),
            constraints=(),
            binding=None,
            offers=(),
            flags=(ReviewFlag.INSUFFICIENT_DATA,) if declared else (),
            policy=policy,
        )

    total, grade, card = score(metrics, policy)
    factors = list(card)

    if grade is Grade.D:
        factors.append(_decision_factor(ReasonCode.SCORE_TOO_LOW, str(total), "DECISION_SCORE"))
        return _result(
            recommendation=Outcome.REJECTED,
            route=Route.AUTO,
            score_value=total,
            grade=grade,
            factors=tuple(factors),
            constraints=(),
            binding=None,
            offers=(),
            flags=(),
            policy=policy,
        )

    outcome, offers, binding, constraints = build_offers(metrics, req, product, grade, policy)

    if outcome is Outcome.REJECTED:
        limit = next((item.limit for item in constraints if item.binding), Decimal("0"))
        factors.append(
            _decision_factor(
                reject_reason(limit),
                f"лимит {limit:.0f} ₽",
                "DECISION_AMOUNT",
            )
        )
        return _result(
            recommendation=Outcome.REJECTED,
            route=Route.AUTO,
            score_value=total,
            grade=grade,
            factors=tuple(factors),
            constraints=constraints,
            binding=binding,
            offers=(),
            flags=(),
            policy=policy,
        )

    flags: list[ReviewFlag] = []
    if grade is Grade.C:
        flags.append(ReviewFlag.GRADE_C)
    if any(factor.code is ReasonCode.FNS_MISMATCH for factor in card):
        flags.append(ReviewFlag.FNS_MISMATCH)
    if req.amount > policy.auto_limit:
        flags.append(ReviewFlag.AMOUNT_ABOVE_AUTO_LIMIT)

    return _result(
        recommendation=outcome,
        route=Route.UNDERWRITING if flags else Route.AUTO,
        score_value=total,
        grade=grade,
        factors=tuple(factors),
        constraints=constraints,
        binding=binding,
        offers=offers,
        flags=tuple(flags),
        policy=policy,
    )


def simulate(inp: ScoringInputs, req: LoanRequest, policy: Policy) -> SimulationResult:
    """«Что если» без создания заявки; согласовано с evaluate — К6."""
    raise NotImplementedError("simulate — К6")


def pre_approve(inp: ScoringInputs, product_code: str, policy: Policy) -> PreApproval | None:
    """Максимальный доступный оффер по продукту без запроса — К6."""
    raise NotImplementedError("pre_approve — К6")
