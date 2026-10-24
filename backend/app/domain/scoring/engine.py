"""Движок кредитного решения: сигнатуры фиксируются в К0.

`evaluate` — К5, `simulate`/`pre_approve` — К6. Dev 2 строит на этих
сигнатурах FakeEvaluator и DI; дублирование логики между симуляцией
и оценкой запрещено (общее приватное ядро).
"""

from .inputs import LoanRequest, ScoringInputs
from .policy import Policy
from .result import PreApproval, ScoringResult, SimulationResult


def evaluate(inp: ScoringInputs, req: LoanRequest, policy: Policy) -> ScoringResult:
    """Решение по заявке: исход, маршрут, факторы, офферы, объяснения — К5."""
    raise NotImplementedError("evaluate — К5")


def simulate(inp: ScoringInputs, req: LoanRequest, policy: Policy) -> SimulationResult:
    """«Что если» без создания заявки; согласовано с evaluate — К6."""
    raise NotImplementedError("simulate — К6")


def pre_approve(inp: ScoringInputs, product_code: str, policy: Policy) -> PreApproval | None:
    """Максимальный доступный оффер по продукту без запроса — К6."""
    raise NotImplementedError("pre_approve — К6")
