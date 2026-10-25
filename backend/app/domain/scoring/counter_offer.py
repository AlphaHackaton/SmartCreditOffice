"""Контроффер (design.md §3): офферы по конечной сетке сроков, без `while`.

Лимит пересчитывается для каждого срока сетки: из-за премии за срок он
немонотонен, поэтому бинарный поиск запрещён — только линейный проход.
`MAX` добавляется лишь когда `LONGER_TERM` не найден, и не повторяет уже
предложенную пару (сумма, срок). Округление лимита до шага — здесь, ровно
один раз: `amount_limit` возвращает неокруглённое значение.
"""

from decimal import Decimal

from ..enums import ConstraintName, Grade, OfferKind, Outcome, ReasonCode
from ..errors import PolicyViolation
from ..money import annuity_payment, overpayment, round_down
from .affordability import amount_limit, term_grid
from .inputs import LoanRequest
from .metrics import Metrics
from .policy import Policy, Product
from .pricing import price
from .result import Constraint, OfferDraft


def make_offer(
    kind: OfferKind,
    amount: Decimal,
    term: int,
    product: Product,
    grade: Grade,
    p: Policy,
) -> OfferDraft:
    """Оффер с проверкой границ продукта, шага суммы и сетки сроков."""
    if amount < product.min_amount or amount > product.max_amount:
        raise PolicyViolation(
            "AMOUNT_OUT_OF_RANGE",
            f"сумма оффера {amount} вне диапазона {product.min_amount}…{product.max_amount}",
            {
                "amount": str(amount),
                "min": str(product.min_amount),
                "max": str(product.max_amount),
            },
        )
    if amount % p.amount_step != 0:
        raise PolicyViolation(
            "AMOUNT_OUT_OF_RANGE",
            f"сумма оффера {amount} не кратна шагу {p.amount_step}",
            {"amount": str(amount), "step": str(p.amount_step)},
        )
    if term not in term_grid(product, p):
        raise PolicyViolation(
            "TERM_OUT_OF_RANGE",
            f"срок {term} вне сетки продукта {product.code}",
            {"term_months": str(term), "product": product.code},
        )
    rate = price(product, grade, term, p)
    payment = annuity_payment(amount, rate, term)
    return OfferDraft(
        kind=kind,
        amount=amount,
        term_months=term,
        rate_pct=rate,
        monthly_payment=payment,
        overpayment=overpayment(payment, term, amount),
    )


def reject_reason(limit: Decimal) -> ReasonCode:
    """Причина отказа без офферов: нет ёмкости (лимит 0) или сумма ниже минимума."""
    return ReasonCode.NO_DEBT_CAPACITY if limit <= 0 else ReasonCode.AMOUNT_BELOW_MIN


def build_offers(
    m: Metrics,
    req: LoanRequest,
    product: Product,
    grade: Grade,
    p: Policy,
) -> tuple[Outcome, tuple[OfferDraft, ...], ConstraintName | None, tuple[Constraint, ...]]:
    """Исход по запросу, офферы, связывающее ограничение и все ограничения.

    Завершаемость: лимит считается не более одного раза на срок сетки
    (кэш), плюс максимум два обращения — итого `len(term_grid) + 2`.
    """
    grid = term_grid(product, p)
    limits: dict[int, tuple[Decimal, tuple[Constraint, ...], ConstraintName]] = {}

    def limit_for(term_months: int) -> Decimal:
        cached = limits.get(term_months)
        if cached is None:
            cached = amount_limit(m, product, grade, term_months, p)
            limits[term_months] = cached
        return cached[0]

    requested_limit, constraints, binding = amount_limit(m, product, grade, req.term_months, p)
    limits[req.term_months] = (requested_limit, constraints, binding)

    if requested_limit >= req.amount:
        requested = make_offer(OfferKind.REQUESTED, req.amount, req.term_months, product, grade, p)
        return Outcome.APPROVED, (requested,), binding, constraints

    offers: list[OfferDraft] = []
    longer_term: int | None = None
    for term_months in grid:
        if term_months <= req.term_months:
            continue
        if limit_for(term_months) >= req.amount:
            longer_term = term_months
            break
    if longer_term is not None:
        offers.append(make_offer(OfferKind.LONGER_TERM, req.amount, longer_term, product, grade, p))

    reduced_amount = round_down(requested_limit, p.amount_step)
    if reduced_amount >= product.min_amount:
        offers.append(
            make_offer(OfferKind.REDUCED_AMOUNT, reduced_amount, req.term_months, product, grade, p)
        )

    if longer_term is None:
        max_amount = round_down(limit_for(product.max_term), p.amount_step)
        offered = {(offer.amount, offer.term_months) for offer in offers}
        reduced = next((offer for offer in offers if offer.kind is OfferKind.REDUCED_AMOUNT), None)
        if (
            max_amount >= product.min_amount
            and (reduced is None or max_amount > reduced.amount)
            and (max_amount, product.max_term) not in offered
        ):
            offers.append(
                make_offer(OfferKind.MAX, max_amount, product.max_term, product, grade, p)
            )

    if offers:
        return Outcome.COUNTER_OFFER, tuple(offers), binding, constraints
    return Outcome.REJECTED, (), binding, constraints
