"""Scoring evaluator boundary used by the application service."""

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from app.api.schemas import DecisionOut
from app.domain.enums import Grade, Outcome, Route


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
