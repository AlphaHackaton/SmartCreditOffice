"""Scoring evaluator boundary used by the application service."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal, Protocol
from uuid import UUID

from app.api.schemas import DecisionOut, FactorOut
from app.db.models import Application
from app.domain.enums import Grade, Outcome, Route
from app.domain.scoring.engine import evaluate
from app.domain.scoring.inputs import (
    LoanRequest,
    ScoringInputs,
)
from app.domain.scoring.policy import POLICY_V1, Policy
from app.domain.serialization import result_to_json
from app.mocks.account import MockAccountGateway
from app.mocks.bki import MockBkiGateway
from app.mocks.fns import MockFnsGateway
from app.mocks.registry import PersonaRegistry


@dataclass(frozen=True, slots=True)
class Evaluation:
    outcome: Outcome
    route: Route
    decision: DecisionOut


class Evaluator(Protocol):
    def evaluate(self, application_id: UUID) -> Evaluation: ...


class DemoEvaluator:
    """Temporary deterministic evaluator until Dev 1's engine is available."""

    def evaluate(self, application_id: UUID) -> Evaluation:
        decision = DecisionOut(outcome=Outcome.APPROVED, route=Route.AUTO, score=100, grade=Grade.A)
        return Evaluation(outcome=Outcome.APPROVED, route=Route.AUTO, decision=decision)


class DomainEvaluator:
    """Adapter from persistence/mocks to Dev 1's pure scoring engine."""

    def __init__(
        self,
        applications: dict[UUID, Application],
        registry: PersonaRegistry | None = None,
        policy: Policy = POLICY_V1,
    ) -> None:
        self.applications = applications
        self.registry = registry or PersonaRegistry()
        self.fns = MockFnsGateway(self.registry)
        self.bki = MockBkiGateway(self.registry)
        self.accounts = MockAccountGateway(self.registry)
        self.policy = policy
        self.last_result: dict[UUID, dict[str, object]] = {}

    def evaluate(self, application_id: UUID) -> Evaluation:
        application = self.applications[application_id]
        company = application.company
        self.registry.bind_company(company.id, company.inn)
        company_data = self.fns.get_company(company.inn)
        fns_data = self.fns.get_declaration(company.inn)
        subject: Literal["COMPANY", "PERSON"] = (
            "PERSON" if company.legal_form == "IP" else "COMPANY"
        )
        bki_report = self.bki.get_report(company.inn, subject)
        account_data = self.accounts.get_turnover(company.id)
        inputs = ScoringInputs(
            as_of=date.today(),
            company=company_data,
            fns=fns_data,
            bki=(bki_report,),
            account=account_data,
        )
        request = LoanRequest(
            product_code=application.product_code,
            amount=Decimal(application.amount),
            term_months=application.term_months,
        )
        result = evaluate(inputs, request, self.policy)
        self.last_result[application_id] = result_to_json(result)
        decision = DecisionOut(
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
            top_reasons=[reason.value for reason in result.top_reasons],
        )
        return Evaluation(
            outcome=result.recommendation,
            route=result.route,
            decision=decision,
        )
