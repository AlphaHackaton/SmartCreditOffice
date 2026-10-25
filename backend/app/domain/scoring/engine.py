"""Движок кредитного решения: `evaluate` — К5, `simulate`/`pre_approve` — К6.

`evaluate` идёт по шагам design.md §2: валидация запроса, метрики, стоп-факторы,
достаточность данных, скоринговая карта, контроффер, флаги ручной проверки,
объяснения. Ветки возвращают один и тот же `ScoringResult`; `top_reasons`
строятся из уже отрендеренных факторов. `simulate` и `pre_approve` (К6) будут
использовать общее приватное ядро — дублирование логики запрещено.
"""

from dataclasses import dataclass
from decimal import Decimal

from ..enums import ConstraintName, Grade, Impact, Outcome, ReasonCode, ReviewFlag, Route, Source
from ..money import round_down
from .affordability import amount_limit
from .counter_offer import build_offers, reject_reason
from .explain import render, top_reasons
from .inputs import LoanRequest, ScoringInputs
from .knockout import check_data_sufficiency, check_knockouts
from .metrics import compute_metrics
from .policy import Policy, Product, validate_request
from .pricing import price
from .result import (
    Constraint,
    Factor,
    OfferDraft,
    PreApproval,
    ScoringResult,
    SimulationResult,
)
from .scorecard import score


@dataclass(frozen=True, slots=True)
class _CoreResult:
    """Ядро решения по заявке/симуляции без рендеринга текста."""

    recommendation: Outcome
    route: Route
    score_value: int | None
    grade: Grade | None
    factors: tuple[Factor, ...]
    constraints: tuple[Constraint, ...]
    binding: ConstraintName | None
    offers: tuple[OfferDraft, ...]
    flags: tuple[ReviewFlag, ...]
    max_amount_for_term: Decimal
    product: Product


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


def _core(inp: ScoringInputs, req: LoanRequest, policy: Policy) -> _CoreResult:
    """Общее ядро решения для `evaluate` и `simulate` (инвариант согласованности)."""
    product = validate_request(req, policy)
    metrics = compute_metrics(inp)
    knockouts = check_knockouts(inp, metrics, policy)
    data_gap = check_data_sufficiency(metrics, inp, policy)

    if knockouts:
        factors = list(knockouts)
        if data_gap is not None:
            factors.append(data_gap)
        return _CoreResult(
            recommendation=Outcome.REJECTED,
            route=Route.AUTO,
            score_value=None,
            grade=None,
            factors=tuple(factors),
            constraints=(),
            binding=None,
            offers=(),
            flags=(),
            max_amount_for_term=Decimal("0.00"),
            product=product,
        )

    if data_gap is not None:
        declared = inp.fns.declared_revenue_12m is not None
        return _CoreResult(
            recommendation=Outcome.REJECTED,
            route=Route.UNDERWRITING if declared else Route.AUTO,
            score_value=None,
            grade=None,
            factors=(data_gap,),
            constraints=(),
            binding=None,
            offers=(),
            flags=(ReviewFlag.INSUFFICIENT_DATA,) if declared else (),
            max_amount_for_term=Decimal("0.00"),
            product=product,
        )

    total, grade, card = score(metrics, policy)
    factors = list(card)

    if grade is Grade.D:
        factors.append(_decision_factor(ReasonCode.SCORE_TOO_LOW, str(total), "DECISION_SCORE"))
        return _CoreResult(
            recommendation=Outcome.REJECTED,
            route=Route.AUTO,
            score_value=total,
            grade=grade,
            factors=tuple(factors),
            constraints=(),
            binding=None,
            offers=(),
            flags=(),
            max_amount_for_term=Decimal("0.00"),
            product=product,
        )

    outcome, offers, binding, constraints = build_offers(metrics, req, product, grade, policy)
    requested_limit = next(
        (item.limit for item in constraints if item.binding),
        Decimal("0.00"),
    )
    max_amount_for_term = round_down(requested_limit, policy.amount_step)

    if outcome is Outcome.REJECTED:
        limit = next((item.limit for item in constraints if item.binding), Decimal("0"))
        factors.append(
            _decision_factor(
                reject_reason(limit),
                f"лимит {limit:.0f} ₽",
                "DECISION_AMOUNT",
            )
        )
        return _CoreResult(
            recommendation=Outcome.REJECTED,
            route=Route.AUTO,
            score_value=total,
            grade=grade,
            factors=tuple(factors),
            constraints=constraints,
            binding=binding,
            offers=(),
            flags=(),
            max_amount_for_term=max_amount_for_term,
            product=product,
        )

    flags: list[ReviewFlag] = []
    if grade is Grade.C:
        flags.append(ReviewFlag.GRADE_C)
    if any(factor.code is ReasonCode.FNS_MISMATCH for factor in card):
        flags.append(ReviewFlag.FNS_MISMATCH)
    if req.amount > policy.auto_limit:
        flags.append(ReviewFlag.AMOUNT_ABOVE_AUTO_LIMIT)

    return _CoreResult(
        recommendation=outcome,
        route=Route.UNDERWRITING if flags else Route.AUTO,
        score_value=total,
        grade=grade,
        factors=tuple(factors),
        constraints=constraints,
        binding=binding,
        offers=offers,
        flags=tuple(flags),
        max_amount_for_term=max_amount_for_term,
        product=product,
    )


def evaluate(inp: ScoringInputs, req: LoanRequest, policy: Policy) -> ScoringResult:
    """Решение по заявке: исход, маршрут, факторы, офферы, объяснения."""
    core = _core(inp, req, policy)
    return _result(
        recommendation=core.recommendation,
        route=core.route,
        score_value=core.score_value,
        grade=core.grade,
        factors=core.factors,
        constraints=core.constraints,
        binding=core.binding,
        offers=core.offers,
        flags=core.flags,
        policy=policy,
    )


def simulate(inp: ScoringInputs, req: LoanRequest, policy: Policy) -> SimulationResult:
    """«Что если» без создания заявки; согласовано с evaluate (инвариант оракула)."""
    core = _core(inp, req, policy)
    return SimulationResult(
        predicted_outcome=core.recommendation,
        requires_review=core.route is Route.UNDERWRITING,
        offers=core.offers,
        constraints=core.constraints,
        binding_constraint=core.binding,
        max_amount_for_term=core.max_amount_for_term,
        headroom=core.max_amount_for_term - req.amount,
    )


def pre_approve(inp: ScoringInputs, product_code: str, policy: Policy) -> PreApproval | None:
    """Максимальный доступный оффер по продукту без запроса (design.md §4)."""
    product = policy.product(product_code)
    metrics = compute_metrics(inp)
    if check_knockouts(inp, metrics, policy):
        return None
    if check_data_sufficiency(metrics, inp, policy) is not None:
        return None
    _, grade, _ = score(metrics, policy)
    if grade is Grade.D:
        return None
    term_months = product.max_term
    limit, _, binding = amount_limit(metrics, product, grade, term_months, policy)
    amount = round_down(limit, policy.amount_step)
    if amount < product.min_amount:
        return None
    rate_pct = price(product, grade, term_months, policy)
    return PreApproval(
        product_code=product.code,
        amount=amount,
        term_months=term_months,
        rate_pct=rate_pct,
        binding=binding,
    )


__all__ = [
    "evaluate",
    "pre_approve",
    "simulate",
]
