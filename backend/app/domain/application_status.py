"""Конечный автомат заявки: 12 статусов, 20 рёбер, акторы CLIENT/BANK/SYSTEM.

Граф хранится как данные (`TRANSITIONS`) — без цепочек if/elif; переходы
выполняются только через функции модуля. Guard-условия, требующие бизнес-данных
(срок оффера, OTP, версия решения), остаются в сервисах интеграции — автомат
знает только граф, акторов и обязательность причины.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Final

from .enums import Actor, ApplicationStatus
from .errors import TransitionError

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


def _status_name(status: ApplicationStatus | None) -> str:
    """Имя статуса для деталей ошибки; `None` — старт истории."""
    return status.value if status is not None else "None"


def _require_aware_at(at: datetime) -> None:
    """`at` — только с таймзоной: наивные datetime несравнимы внутри истории."""
    if at.tzinfo is None or at.tzinfo.utcoffset(at) is None:
        msg = "at: ожидается datetime с таймзоной, получен наивный"
        raise ValueError(msg)


def _validate_transition(
    src: ApplicationStatus,
    dst: ApplicationStatus,
    actor: Actor,
    reason: str | None,
) -> None:
    """Ребро (src → dst) с актором должно быть в графе; причина — где она требуется."""
    actors = TRANSITIONS.get((src, dst))
    if actors is None or actor not in actors:
        raise TransitionError(
            "INVALID_TRANSITION",
            f"переход {src.value} → {dst.value} не разрешён актору {actor.value}",
            {"from": src.value, "to": dst.value, "actor": actor.value},
        )
    if (src, dst) in REASON_REQUIRED and (reason is None or not reason.strip()):
        raise TransitionError(
            "REASON_REQUIRED",
            f"переход {src.value} → {dst.value} требует непустую причину",
            {"from": src.value, "to": dst.value, "actor": actor.value},
        )


@dataclass(frozen=True, slots=True)
class StatusEvent:
    """Событие перехода статуса. `at` — только с таймзоной, иначе ValueError."""

    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    actor: Actor
    at: datetime
    reason: str | None

    def __post_init__(self) -> None:
        _require_aware_at(self.at)


def allowed_targets(src: ApplicationStatus, actor: Actor) -> frozenset[ApplicationStatus]:
    """Статусы, достижимые из `src` действием `actor`."""
    return frozenset(
        dst for (source, dst), actors in TRANSITIONS.items() if source == src and actor in actors
    )


def can_transition(src: ApplicationStatus, dst: ApplicationStatus, actor: Actor) -> bool:
    """Разрешён ли переход (src → dst) актором `actor`."""
    actors = TRANSITIONS.get((src, dst))
    return actors is not None and actor in actors


def transition(
    src: ApplicationStatus,
    dst: ApplicationStatus,
    actor: Actor,
    *,
    at: datetime,
    reason: str | None = None,
) -> StatusEvent:
    """Выполнить переход: проверить ребро, актора, причину и таймзону `at`."""
    _require_aware_at(at)
    _validate_transition(src, dst, actor, reason)
    return StatusEvent(from_status=src, to_status=dst, actor=actor, at=at, reason=reason)


def initial_event(actor: Actor, at: datetime) -> StatusEvent:
    """Первое событие заявки: None → DRAFT."""
    _require_aware_at(at)
    return StatusEvent(
        from_status=None,
        to_status=ApplicationStatus.DRAFT,
        actor=actor,
        at=at,
        reason=None,
    )


def replay(history: Sequence[StatusEvent]) -> ApplicationStatus:
    """Валидировать всю цепочку событий и вернуть итоговый статус.

    Проверяется: первое событие — None → DRAFT; события сцеплены
    (`from[k] == to[k−1]`); `at` не убывает; каждый переход разрешён графом.
    """
    events = tuple(history)
    if not events:
        msg = "история заявок пуста"
        raise ValueError(msg)
    first = events[0]
    if first.from_status is not None or first.to_status is not ApplicationStatus.DRAFT:
        raise TransitionError(
            "NOT_INITIAL",
            "первое событие истории должно быть None → DRAFT",
            {
                "from": _status_name(first.from_status),
                "to": _status_name(first.to_status),
                "actor": first.actor.value,
            },
        )
    current = first
    for event in events[1:]:
        src = event.from_status
        if src is None or src != current.to_status:
            raise TransitionError(
                "CHAIN_BREAK",
                "разрыв цепочки: from_status не равен to_status предыдущего события",
                {
                    "from": _status_name(src),
                    "to": _status_name(event.to_status),
                    "actor": event.actor.value,
                    "expected": current.to_status.value,
                },
            )
        if event.at < current.at:
            raise TransitionError(
                "AT_OUT_OF_ORDER",
                "метка времени события раньше предыдущего",
                {
                    "from": _status_name(src),
                    "to": _status_name(event.to_status),
                    "actor": event.actor.value,
                },
            )
        _validate_transition(src, event.to_status, event.actor, event.reason)
        current = event
    return current.to_status
