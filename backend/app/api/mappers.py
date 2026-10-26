"""Domain ↔ DTO ↔ ORM conversions; the only module allowed to map between layers."""

from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.api.schemas import (
    ApplicationOut,
    DecisionOut,
    FactorOut,
    OfferOut,
    StatusEventOut,
)
from app.db.models import Application, Offer, StatusHistory
from app.domain.enums import ApplicationStatus, Outcome, Route
from app.domain.scoring.result import ScoringResult


def history_to_out(events: list[StatusHistory]) -> list[StatusEventOut]:
    return [
        StatusEventOut(
            from_status=(ApplicationStatus(item.from_status) if item.from_status else None),
            to_status=ApplicationStatus(item.to_status),
            actor=item.actor,
            at=item.at,
            reason=item.reason,
        )
        for item in events
    ]


def _offers_from_result(result: ScoringResult, application_id: Any) -> list[OfferOut]:
    return [
        OfferOut(
            id=uuid5(NAMESPACE_URL, f"{application_id}:{offer.kind.value}"),
            kind=offer.kind.value,
            amount=offer.amount,
            term_months=offer.term_months,
            rate_pct=offer.rate_pct,
            monthly_payment=offer.monthly_payment,
            overpayment=offer.overpayment,
        )
        for offer in result.offers
    ]


def decision_from_result(result: ScoringResult, application_id: Any) -> DecisionOut:
    return DecisionOut(
        outcome=result.recommendation,
        route=result.route,
        score=result.score,
        grade=result.grade,
        factors=[
            FactorOut(
                code=factor.code.value,
                source=factor.source.value,
                value=factor.value,
                points=factor.points,
                max_points=factor.max_points,
                impact=factor.impact.value,
                rule_id=factor.rule_id,
                client_text=factor.client_text,
                hint=factor.hint,
            )
            for factor in result.factors
        ],
        offers=_offers_from_result(result, application_id),
        binding_constraint=(result.binding_constraint.value if result.binding_constraint else None),
        top_reasons=[reason.value for reason in result.top_reasons],
    )


def application_to_out(
    application: Application,
    history: list[StatusHistory],
    decision: DecisionOut | None = None,
    offers: list[Offer] | None = None,
    selected_offer: Offer | None = None,
) -> ApplicationOut:
    return ApplicationOut(
        id=application.id,
        company_id=application.company_id,
        product_code=application.product_code,
        amount=application.amount,
        term_months=application.term_months,
        status=ApplicationStatus(application.status),
        version=application.version,
        history=history_to_out(history),
        decision=decision,
        selected_offer=offers_from_rows([selected_offer])[0]
        if selected_offer is not None
        else None,
    )


def offers_from_rows(rows: list[Offer]) -> list[OfferOut]:
    return [
        OfferOut(
            id=row.id,
            kind=row.kind,
            amount=row.amount,
            term_months=row.term_months,
            rate_pct=row.rate_pct,
            monthly_payment=row.monthly_payment,
            overpayment=row.overpayment,
            expires_at=row.expires_at,
        )
        for row in rows
    ]


def outcome_route_for(outcome: Outcome, route: Route) -> ApplicationStatus:
    """Status after scoring: manual review route wins over the outcome."""
    if route is Route.UNDERWRITING:
        return ApplicationStatus.UNDERWRITING
    return ApplicationStatus(outcome.value)
