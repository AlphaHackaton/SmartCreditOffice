"""Тесты FSM К2 (application_status): таблица переходов, guard'ы, replay.

Таблица ожиданий переписана здесь по tasks.md (раздел 3) и НЕ импортируется
из модуля — модуль и тест проверяют друг друга независимо.
"""

from collections import deque
from datetime import UTC, datetime, timedelta, tzinfo
from itertools import product
from typing import Final

import pytest

from app.domain.application_status import (
    IN_PROGRESS,
    REASON_REQUIRED,
    TERMINAL,
    TRANSITIONS,
    StatusEvent,
    allowed_targets,
    can_transition,
    initial_event,
    replay,
    transition,
)
from app.domain.enums import Actor, ApplicationStatus
from app.domain.errors import TransitionError

#: Фиксированное время событий: домен детерминирован, «сейчас» не используется.
_T0: Final = datetime(2026, 10, 24, 10, 0, tzinfo=UTC)
_NAIVE: Final = datetime(2026, 10, 24, 10, 0)

_ALL_STATUSES: Final[tuple[ApplicationStatus, ...]] = tuple(ApplicationStatus)
_ALL_ACTORS: Final[tuple[Actor, ...]] = tuple(Actor)

#: 20 рёбер из tasks.md К2: (из, в, актор).
_EXPECTED_EDGES: Final[frozenset[tuple[ApplicationStatus, ApplicationStatus, Actor]]] = frozenset(
    {
        (ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, Actor.CLIENT),
        (ApplicationStatus.DRAFT, ApplicationStatus.CANCELLED, Actor.CLIENT),
        (ApplicationStatus.SUBMITTED, ApplicationStatus.SCORING, Actor.SYSTEM),
        (ApplicationStatus.SCORING, ApplicationStatus.APPROVED, Actor.SYSTEM),
        (ApplicationStatus.SCORING, ApplicationStatus.COUNTER_OFFER, Actor.SYSTEM),
        (ApplicationStatus.SCORING, ApplicationStatus.REJECTED, Actor.SYSTEM),
        (ApplicationStatus.SCORING, ApplicationStatus.UNDERWRITING, Actor.SYSTEM),
        (ApplicationStatus.UNDERWRITING, ApplicationStatus.APPROVED, Actor.BANK),
        (ApplicationStatus.UNDERWRITING, ApplicationStatus.COUNTER_OFFER, Actor.BANK),
        (ApplicationStatus.UNDERWRITING, ApplicationStatus.REJECTED, Actor.BANK),
        (ApplicationStatus.APPROVED, ApplicationStatus.SIGNING, Actor.CLIENT),
        (ApplicationStatus.APPROVED, ApplicationStatus.CANCELLED, Actor.CLIENT),
        (ApplicationStatus.APPROVED, ApplicationStatus.EXPIRED, Actor.SYSTEM),
        (ApplicationStatus.COUNTER_OFFER, ApplicationStatus.SIGNING, Actor.CLIENT),
        (ApplicationStatus.COUNTER_OFFER, ApplicationStatus.CANCELLED, Actor.CLIENT),
        (ApplicationStatus.COUNTER_OFFER, ApplicationStatus.EXPIRED, Actor.SYSTEM),
        (ApplicationStatus.SIGNING, ApplicationStatus.SIGNED, Actor.CLIENT),
        (ApplicationStatus.SIGNING, ApplicationStatus.CANCELLED, Actor.CLIENT),
        (ApplicationStatus.SIGNING, ApplicationStatus.EXPIRED, Actor.SYSTEM),
        (ApplicationStatus.SIGNED, ApplicationStatus.DISBURSED, Actor.SYSTEM),
    }
)

#: Терминальные статусы из tasks.md К2.
_EXPECTED_TERMINAL: Final[frozenset[ApplicationStatus]] = frozenset(
    {
        ApplicationStatus.REJECTED,
        ApplicationStatus.CANCELLED,
        ApplicationStatus.EXPIRED,
        ApplicationStatus.DISBURSED,
    }
)

#: Статусы «в работе» — для поллинга фронта.
_EXPECTED_IN_PROGRESS: Final[frozenset[ApplicationStatus]] = frozenset(
    {ApplicationStatus.SUBMITTED, ApplicationStatus.SCORING}
)

# --- полный перебор 12 × 12 × 3 = 432 комбинаций --------------------------------------


@pytest.mark.parametrize(
    ("src", "dst", "actor"), tuple(product(_ALL_STATUSES, _ALL_STATUSES, _ALL_ACTORS))
)
def test_can_transition_matches_expected_table(
    src: ApplicationStatus, dst: ApplicationStatus, actor: Actor
) -> None:
    expected = (src, dst, actor) in _EXPECTED_EDGES
    assert can_transition(src, dst, actor) is expected
    if expected:
        assert dst in allowed_targets(src, actor)


def test_graph_edges_and_actor_sets_match_expected_table() -> None:
    assert len(_EXPECTED_EDGES) == 20
    assert len(TRANSITIONS) == 20
    by_edge: dict[tuple[ApplicationStatus, ApplicationStatus], set[Actor]] = {}
    for src, dst, actor in _EXPECTED_EDGES:
        by_edge.setdefault((src, dst), set()).add(actor)
    assert set(TRANSITIONS) == set(by_edge)
    for edge, actors in by_edge.items():
        assert TRANSITIONS[edge] == frozenset(actors), edge


# --- структура графа ------------------------------------------------------------------


def test_terminal_set_matches_expected() -> None:
    assert TERMINAL == _EXPECTED_TERMINAL


def test_in_progress_set_is_submitted_and_scoring() -> None:
    assert IN_PROGRESS == _EXPECTED_IN_PROGRESS


def test_reason_required_is_all_underwriting_exits() -> None:
    underwriting_exits = {
        (src, dst) for (src, dst) in TRANSITIONS if src == ApplicationStatus.UNDERWRITING
    }
    assert underwriting_exits == set(REASON_REQUIRED)


def test_no_outgoing_edges_from_terminal_statuses() -> None:
    for terminal in _EXPECTED_TERMINAL:
        assert all(src != terminal for (src, _dst) in TRANSITIONS)
        for actor in _ALL_ACTORS:
            assert allowed_targets(terminal, actor) == frozenset(), terminal


def test_nothing_enters_draft() -> None:
    assert all(dst != ApplicationStatus.DRAFT for (_src, dst) in TRANSITIONS)


def test_no_self_loops() -> None:
    assert all(src != dst for (src, dst) in TRANSITIONS)


# --- достижимость (BFS от DRAFT) ------------------------------------------------------


def _adjacency() -> dict[ApplicationStatus, frozenset[ApplicationStatus]]:
    adjacency: dict[ApplicationStatus, set[ApplicationStatus]] = {}
    for src, dst in TRANSITIONS:
        adjacency.setdefault(src, set()).add(dst)
    return {src: frozenset(targets) for src, targets in adjacency.items()}


def _reachable(start: ApplicationStatus) -> frozenset[ApplicationStatus]:
    adjacency = _adjacency()
    seen = {start}
    queue: deque[ApplicationStatus] = deque([start])
    while queue:
        current = queue.popleft()
        for target in adjacency.get(current, frozenset()):
            if target not in seen:
                seen.add(target)
                queue.append(target)
    return frozenset(seen)


def test_bfs_from_draft_reaches_all_12_statuses() -> None:
    assert _reachable(ApplicationStatus.DRAFT) == frozenset(_ALL_STATUSES)


def test_every_non_terminal_reaches_a_terminal_no_dead_ends() -> None:
    non_terminal = set(_ALL_STATUSES) - set(_EXPECTED_TERMINAL)
    assert non_terminal, "нетерминальных статусов нет — тест сломан"
    for status in non_terminal:
        assert _reachable(status) & _EXPECTED_TERMINAL, f"тупиковый статус: {status}"


def _simple_paths(
    start: ApplicationStatus, finish: ApplicationStatus
) -> list[tuple[ApplicationStatus, ...]]:
    """Все простые пути (без повторов статусов) start → finish по рёбрам графа."""
    adjacency = _adjacency()
    paths: list[tuple[ApplicationStatus, ...]] = []
    stack: list[tuple[ApplicationStatus, tuple[ApplicationStatus, ...]]] = [(start, (start,))]
    while stack:
        current, path = stack.pop()
        if current == finish:
            paths.append(path)
            continue
        for target in adjacency.get(current, frozenset()):
            if target not in path:
                stack.append((target, (*path, target)))
    return paths


_P1_PATH: Final[tuple[ApplicationStatus, ...]] = (
    ApplicationStatus.DRAFT,
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.SCORING,
    ApplicationStatus.APPROVED,
    ApplicationStatus.SIGNING,
    ApplicationStatus.SIGNED,
    ApplicationStatus.DISBURSED,
)
_P6_PATH: Final[tuple[ApplicationStatus, ...]] = (
    ApplicationStatus.DRAFT,
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.SCORING,
    ApplicationStatus.UNDERWRITING,
    ApplicationStatus.COUNTER_OFFER,
    ApplicationStatus.SIGNING,
    ApplicationStatus.SIGNED,
    ApplicationStatus.DISBURSED,
)


def test_disbursed_reachable_by_two_paths() -> None:
    """DISBURSED достижим и через APPROVED, и через UNDERWRITING → COUNTER_OFFER."""
    paths = _simple_paths(ApplicationStatus.DRAFT, ApplicationStatus.DISBURSED)
    assert len(paths) >= 2
    assert _P1_PATH in paths
    assert _P6_PATH in paths


# --- guard: причина для выходов из UNDERWRITING ---------------------------------------


@pytest.mark.parametrize(
    "dst",
    (
        ApplicationStatus.APPROVED,
        ApplicationStatus.COUNTER_OFFER,
        ApplicationStatus.REJECTED,
    ),
)
@pytest.mark.parametrize("reason", (None, "", "  "), ids=("none", "empty", "whitespace"))
def test_underwriting_exit_requires_reason(dst: ApplicationStatus, reason: str | None) -> None:
    with pytest.raises(TransitionError) as excinfo:
        transition(ApplicationStatus.UNDERWRITING, dst, Actor.BANK, at=_T0, reason=reason)
    assert excinfo.value.code == "REASON_REQUIRED"
    assert excinfo.value.details["from"] == "UNDERWRITING"
    assert excinfo.value.details["to"] == dst.value


def test_underwriting_exit_with_reason_returns_event() -> None:
    event = transition(
        ApplicationStatus.UNDERWRITING,
        ApplicationStatus.REJECTED,
        Actor.BANK,
        at=_T0,
        reason="стоп-фактор BKI_CURRENT_OVERDUE",
    )
    assert event.to_status is ApplicationStatus.REJECTED
    assert event.reason == "стоп-фактор BKI_CURRENT_OVERDUE"


# --- guard: `at` только с таймзоной ----------------------------------------------------


def test_transition_rejects_naive_datetime() -> None:
    with pytest.raises(ValueError, match="таймзон"):
        transition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, Actor.CLIENT, at=_NAIVE)


def test_initial_event_rejects_naive_datetime() -> None:
    with pytest.raises(ValueError, match="таймзон"):
        initial_event(Actor.CLIENT, _NAIVE)


def test_status_event_rejects_naive_datetime() -> None:
    with pytest.raises(ValueError, match="таймзон"):
        StatusEvent(None, ApplicationStatus.DRAFT, Actor.CLIENT, _NAIVE, None)


class _NoneUtcoffsetTz(tzinfo):
    def utcoffset(self, dt: datetime | None) -> timedelta | None:
        return None

    def tzname(self, dt: datetime | None) -> str | None:
        return "NoneTz"

    def dst(self, dt: datetime | None) -> timedelta | None:
        return None


def test_transition_rejects_none_utcoffset_tzinfo() -> None:
    dt_with_none_offset = datetime(2026, 10, 24, 10, 0, tzinfo=_NoneUtcoffsetTz())
    with pytest.raises(ValueError, match="таймзон"):
        transition(
            ApplicationStatus.DRAFT,
            ApplicationStatus.SUBMITTED,
            Actor.CLIENT,
            at=dt_with_none_offset,
        )
    with pytest.raises(ValueError, match="таймзон"):
        initial_event(Actor.CLIENT, dt_with_none_offset)
    with pytest.raises(ValueError, match="таймзон"):
        StatusEvent(None, ApplicationStatus.DRAFT, Actor.CLIENT, dt_with_none_offset, None)


# --- недопустимые переходы ------------------------------------------------------------


def test_unknown_edge_raises_invalid_transition_with_details() -> None:
    with pytest.raises(TransitionError) as excinfo:
        transition(ApplicationStatus.DRAFT, ApplicationStatus.SIGNED, Actor.CLIENT, at=_T0)
    assert excinfo.value.code == "INVALID_TRANSITION"
    assert excinfo.value.details == {"from": "DRAFT", "to": "SIGNED", "actor": "CLIENT"}


def test_wrong_actor_raises_invalid_transition() -> None:
    # ребро DRAFT → SUBMITTED существует, но актор SYSTEM не имеет права
    with pytest.raises(TransitionError) as excinfo:
        transition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, Actor.SYSTEM, at=_T0)
    assert excinfo.value.code == "INVALID_TRANSITION"


def test_terminal_status_is_sink() -> None:
    with pytest.raises(TransitionError) as excinfo:
        transition(ApplicationStatus.REJECTED, ApplicationStatus.SCORING, Actor.SYSTEM, at=_T0)
    assert excinfo.value.code == "INVALID_TRANSITION"


# --- события --------------------------------------------------------------------------


def test_transition_returns_event() -> None:
    event = transition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, Actor.CLIENT, at=_T0)
    assert event == StatusEvent(
        from_status=ApplicationStatus.DRAFT,
        to_status=ApplicationStatus.SUBMITTED,
        actor=Actor.CLIENT,
        at=_T0,
        reason=None,
    )


def test_initial_event_is_none_to_draft() -> None:
    event = initial_event(Actor.CLIENT, _T0)
    assert event.from_status is None
    assert event.to_status is ApplicationStatus.DRAFT
    assert event.actor is Actor.CLIENT
    assert event.reason is None


# --- replay ---------------------------------------------------------------------------

_Step = tuple[ApplicationStatus, ApplicationStatus, Actor, str | None]


def _history(steps: tuple[_Step, ...]) -> list[StatusEvent]:
    """История: initial_event (None → DRAFT) плюс корректные переходы, время растёт."""
    events = [initial_event(Actor.CLIENT, _T0)]
    for number, (src, dst, actor, reason) in enumerate(steps, start=1):
        events.append(
            transition(src, dst, actor, at=_T0 + timedelta(minutes=number), reason=reason)
        )
    return events


def test_replay_p1_scenario_reaches_disbursed() -> None:
    history = _history(
        (
            (ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, Actor.CLIENT, None),
            (ApplicationStatus.SUBMITTED, ApplicationStatus.SCORING, Actor.SYSTEM, None),
            (ApplicationStatus.SCORING, ApplicationStatus.APPROVED, Actor.SYSTEM, None),
            (ApplicationStatus.APPROVED, ApplicationStatus.SIGNING, Actor.CLIENT, None),
            (ApplicationStatus.SIGNING, ApplicationStatus.SIGNED, Actor.CLIENT, None),
            (ApplicationStatus.SIGNED, ApplicationStatus.DISBURSED, Actor.SYSTEM, None),
        )
    )
    assert replay(history) is ApplicationStatus.DISBURSED


def test_replay_p6_scenario_via_underwriting() -> None:
    history = _history(
        (
            (ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, Actor.CLIENT, None),
            (ApplicationStatus.SUBMITTED, ApplicationStatus.SCORING, Actor.SYSTEM, None),
            (ApplicationStatus.SCORING, ApplicationStatus.UNDERWRITING, Actor.SYSTEM, None),
            (
                ApplicationStatus.UNDERWRITING,
                ApplicationStatus.COUNTER_OFFER,
                Actor.BANK,
                "банк подтверждает контроффер после ручной проверки",
            ),
            (ApplicationStatus.COUNTER_OFFER, ApplicationStatus.SIGNING, Actor.CLIENT, None),
            (ApplicationStatus.SIGNING, ApplicationStatus.SIGNED, Actor.CLIENT, None),
            (ApplicationStatus.SIGNED, ApplicationStatus.DISBURSED, Actor.SYSTEM, None),
        )
    )
    assert replay(history) is ApplicationStatus.DISBURSED


def test_replay_rejected_scenario() -> None:
    history = _history(
        (
            (ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, Actor.CLIENT, None),
            (ApplicationStatus.SUBMITTED, ApplicationStatus.SCORING, Actor.SYSTEM, None),
            (ApplicationStatus.SCORING, ApplicationStatus.REJECTED, Actor.SYSTEM, None),
        )
    )
    assert replay(history) is ApplicationStatus.REJECTED


def test_replay_empty_history_raises() -> None:
    with pytest.raises(ValueError):
        replay(())


@pytest.mark.parametrize(
    ("from_status", "to_status"),
    (
        (ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED),
        (None, ApplicationStatus.SUBMITTED),
        (ApplicationStatus.SUBMITTED, ApplicationStatus.DRAFT),
    ),
    ids=("from-not-none", "to-not-draft", "from-not-none-to-draft"),
)
def test_replay_first_event_must_be_none_to_draft(
    from_status: ApplicationStatus | None, to_status: ApplicationStatus
) -> None:
    first = StatusEvent(from_status, to_status, Actor.CLIENT, _T0, None)
    with pytest.raises(TransitionError) as excinfo:
        replay([first])
    assert excinfo.value.code == "NOT_INITIAL"


def test_replay_detects_chain_break() -> None:
    events = [
        initial_event(Actor.CLIENT, _T0),
        StatusEvent(
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.SCORING,
            Actor.SYSTEM,
            _T0 + timedelta(minutes=1),
            None,
        ),
    ]
    with pytest.raises(TransitionError) as excinfo:
        replay(events)
    assert excinfo.value.code == "CHAIN_BREAK"


def test_replay_detects_decreasing_timestamps() -> None:
    events = [
        initial_event(Actor.CLIENT, _T0 + timedelta(minutes=5)),
        StatusEvent(
            ApplicationStatus.DRAFT,
            ApplicationStatus.SUBMITTED,
            Actor.CLIENT,
            _T0,
            None,
        ),
    ]
    with pytest.raises(TransitionError) as excinfo:
        replay(events)
    assert excinfo.value.code == "AT_OUT_OF_ORDER"


def test_replay_detects_illegal_edge() -> None:
    events = [
        initial_event(Actor.CLIENT, _T0),
        StatusEvent(
            ApplicationStatus.DRAFT,
            ApplicationStatus.SIGNED,
            Actor.CLIENT,
            _T0 + timedelta(minutes=1),
            None,
        ),
    ]
    with pytest.raises(TransitionError) as excinfo:
        replay(events)
    assert excinfo.value.code == "INVALID_TRANSITION"


def test_replay_detects_missing_reason() -> None:
    events = [
        initial_event(Actor.CLIENT, _T0),
        StatusEvent(
            ApplicationStatus.DRAFT,
            ApplicationStatus.SUBMITTED,
            Actor.CLIENT,
            _T0 + timedelta(minutes=1),
            None,
        ),
        StatusEvent(
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.SCORING,
            Actor.SYSTEM,
            _T0 + timedelta(minutes=2),
            None,
        ),
        StatusEvent(
            ApplicationStatus.SCORING,
            ApplicationStatus.UNDERWRITING,
            Actor.SYSTEM,
            _T0 + timedelta(minutes=3),
            None,
        ),
        StatusEvent(
            ApplicationStatus.UNDERWRITING,
            ApplicationStatus.REJECTED,
            Actor.BANK,
            _T0 + timedelta(minutes=4),
            None,
        ),
    ]
    with pytest.raises(TransitionError) as excinfo:
        replay(events)
    assert excinfo.value.code == "REASON_REQUIRED"
