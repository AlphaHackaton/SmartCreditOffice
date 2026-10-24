"""Конечный автомат заявки: 12 статусов, 20 рёбер, акторы CLIENT/BANK/SYSTEM.

Граф хранится как данные (`TRANSITIONS`); функции-переходы реализуются в К2.
Guard-условия, требующие бизнес-данных (срок оффера, OTP, версия решения),
остаются в сервисах интеграции — автомат знает только граф и акторов.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Final

from .enums import Actor, ApplicationStatus

#: Рёбра графа: (из, в) → множество акторов, которым переход разрешён. 20 рёбер.
TRANSITIONS: Final[Mapping[tuple[ApplicationStatus, ApplicationStatus], frozenset[Actor]]] = (
    MappingProxyType(
        {
            (ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED): frozenset({Actor.CLIENT}),
            (ApplicationStatus.DRAFT, ApplicationStatus.CANCELLED): frozenset({Actor.CLIENT}),
            (ApplicationStatus.SUBMITTED, ApplicationStatus.SCORING): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.SCORING, ApplicationStatus.APPROVED): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.SCORING, ApplicationStatus.COUNTER_OFFER): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.SCORING, ApplicationStatus.REJECTED): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.SCORING, ApplicationStatus.UNDERWRITING): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.UNDERWRITING, ApplicationStatus.APPROVED): frozenset({Actor.BANK}),
            (ApplicationStatus.UNDERWRITING, ApplicationStatus.COUNTER_OFFER): frozenset(
                {Actor.BANK}
            ),
            (ApplicationStatus.UNDERWRITING, ApplicationStatus.REJECTED): frozenset({Actor.BANK}),
            (ApplicationStatus.APPROVED, ApplicationStatus.SIGNING): frozenset({Actor.CLIENT}),
            (ApplicationStatus.APPROVED, ApplicationStatus.CANCELLED): frozenset({Actor.CLIENT}),
            (ApplicationStatus.APPROVED, ApplicationStatus.EXPIRED): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.COUNTER_OFFER, ApplicationStatus.SIGNING): frozenset({Actor.CLIENT}),
            (ApplicationStatus.COUNTER_OFFER, ApplicationStatus.CANCELLED): frozenset(
                {Actor.CLIENT}
            ),
            (ApplicationStatus.COUNTER_OFFER, ApplicationStatus.EXPIRED): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.SIGNING, ApplicationStatus.SIGNED): frozenset({Actor.CLIENT}),
            (ApplicationStatus.SIGNING, ApplicationStatus.CANCELLED): frozenset({Actor.CLIENT}),
            (ApplicationStatus.SIGNING, ApplicationStatus.EXPIRED): frozenset({Actor.SYSTEM}),
            (ApplicationStatus.SIGNED, ApplicationStatus.DISBURSED): frozenset({Actor.SYSTEM}),
        }
    )
)

#: Терминальные статусы: исходящих рёбер нет.
TERMINAL: Final[frozenset[ApplicationStatus]] = frozenset(
    {
        ApplicationStatus.REJECTED,
        ApplicationStatus.CANCELLED,
        ApplicationStatus.EXPIRED,
        ApplicationStatus.DISBURSED,
    }
)

#: Статусы «в работе» — для поллинга фронта.
IN_PROGRESS: Final[frozenset[ApplicationStatus]] = frozenset(
    {
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.SCORING,
    }
)

#: Переходы из UNDERWRITING — требуют непустую причину.
REASON_REQUIRED: Final[frozenset[tuple[ApplicationStatus, ApplicationStatus]]] = frozenset(
    {
        (ApplicationStatus.UNDERWRITING, ApplicationStatus.APPROVED),
        (ApplicationStatus.UNDERWRITING, ApplicationStatus.COUNTER_OFFER),
        (ApplicationStatus.UNDERWRITING, ApplicationStatus.REJECTED),
    }
)


@dataclass(frozen=True, slots=True)
class StatusEvent:
    """Событие перехода статуса. `at` — только с таймзоной (наивная → ValueError в К2)."""

    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    actor: Actor
    at: datetime
    reason: str | None


def allowed_targets(src: ApplicationStatus, actor: Actor) -> frozenset[ApplicationStatus]:
    """Статусы, достижимые из `src` действием `actor` (реализация в К2)."""
    raise NotImplementedError("allowed_targets — К2")


def can_transition(src: ApplicationStatus, dst: ApplicationStatus, actor: Actor) -> bool:
    """Разрешён ли переход (src → dst) актором `actor` (реализация в К2)."""
    raise NotImplementedError("can_transition — К2")


def transition(
    src: ApplicationStatus,
    dst: ApplicationStatus,
    actor: Actor,
    *,
    at: datetime,
    reason: str | None = None,
) -> StatusEvent:
    """Выполнить переход: валидация ребра и причины, событие (реализация в К2)."""
    raise NotImplementedError("transition — К2")


def initial_event(actor: Actor, at: datetime) -> StatusEvent:
    """Первое событие заявки: None → DRAFT (реализация в К2)."""
    raise NotImplementedError("initial_event — К2")


def replay(history: Sequence[StatusEvent]) -> ApplicationStatus:
    """Валидировать цепочку событий и вернуть итоговый статус (реализация в К2)."""
    raise NotImplementedError("replay — К2")
