"""Scoring evaluator boundary between persistence/mocks and the pure domain engine."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.models import Application, Company
from app.domain.scoring.engine import evaluate, pre_approve, simulate
from app.domain.scoring.inputs import LoanRequest, ScoringInputs
from app.domain.scoring.policy import POLICY_V1, Policy
from app.domain.scoring.result import PreApproval, ScoringResult, SimulationResult
from app.mocks.account import MockAccountGateway
from app.mocks.bki import MockBkiGateway
from app.mocks.fns import MockFnsGateway
from app.mocks.registry import PersonaRegistry


@dataclass(frozen=True, slots=True)
class Evaluation:
    """Everything the service needs to persist after one scoring pass."""

    result: ScoringResult
    inputs: ScoringInputs


class DomainEvaluator:
    """Adapter: ORM company → mock gateways → pure domain engine."""

    def __init__(
        self,
        session: Session | None = None,
        registry: PersonaRegistry | None = None,
        policy: Policy = POLICY_V1,
    ) -> None:
        self.session = session
        self.registry = registry or PersonaRegistry()
        self.fns = MockFnsGateway(self.registry)
        self.bki = MockBkiGateway(self.registry)
        self.accounts = MockAccountGateway(self.registry)
        self.policy = policy

    def inputs_for(self, company: Company) -> ScoringInputs:
        self.registry.bind_company(company.id, company.inn)
        return ScoringInputs(
            as_of=date.today(),
            company=self.fns.get_company(company.inn),
            fns=self.fns.get_declaration(company.inn),
            bki=(self.bki.get_report(company.inn, "COMPANY"),),
            account=self.accounts.get_turnover(company.id),
        )

    def evaluate(self, application: Application) -> Evaluation:
        inputs = self.inputs_for(application.company)
        request = LoanRequest(
            product_code=application.product_code,
            amount=Decimal(application.amount),
            term_months=application.term_months,
        )
        result = evaluate(inputs, request, self.policy)
        return Evaluation(result=result, inputs=inputs)

    def simulate(
        self, application: Application, amount: Decimal, term_months: int
    ) -> SimulationResult:
        inputs = self.inputs_for(application.company)
        request = LoanRequest(
            product_code=application.product_code,
            amount=amount,
            term_months=term_months,
        )
        return simulate(inputs, request, self.policy)

    def pre_approve(self, company: Company, product_code: str) -> PreApproval | None:
        inputs = self.inputs_for(company)
        return pre_approve(inputs, product_code, self.policy)
