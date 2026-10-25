from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.db.models import Application
from app.db.repositories import ApplicationNotFound, ApplicationRepository, VersionConflict
from app.domain import application_status
from app.domain.application_status import StatusEvent
from app.domain.enums import Actor, ApplicationStatus


def _application(version: int = 1) -> Application:
    return Application(
        id=uuid4(),
        company_id=uuid4(),
        product_code="WC_FLEX",
        amount="1000000.00",
        term_months=12,
        purpose="WORKING_CAPITAL",
        status=ApplicationStatus.DRAFT.value,
        version=version,
    )


def test_get_missing_application_raises_not_found() -> None:
    session = MagicMock()
    session.get.return_value = None
    repository = ApplicationRepository(session)

    with pytest.raises(ApplicationNotFound):
        repository.get(uuid4())


def test_transition_rejects_stale_version_without_writing() -> None:
    application = _application(version=2)
    session = MagicMock()
    session.get.return_value = application
    repository = ApplicationRepository(session)

    with pytest.raises(VersionConflict) as error:
        repository.apply_transition(
            application.id,
            expected_version=1,
            target=ApplicationStatus.SUBMITTED,
            actor=Actor.CLIENT,
            at=datetime.now(UTC),
        )

    assert error.value.actual == 2
    session.execute.assert_not_called()
    session.add.assert_not_called()


def test_transition_updates_version_and_adds_history(monkeypatch: pytest.MonkeyPatch) -> None:
    application = _application()
    session = MagicMock()
    session.get.return_value = application
    session.execute.return_value.rowcount = 1
    monkeypatch.setattr(
        application_status,
        "transition",
        lambda *args, **kwargs: StatusEvent(
            from_status=ApplicationStatus.DRAFT,
            to_status=ApplicationStatus.SUBMITTED,
            actor=Actor.CLIENT,
            at=kwargs["at"],
            reason=kwargs.get("reason"),
        ),
    )
    repository = ApplicationRepository(session)

    result = repository.apply_transition(
        application.id,
        expected_version=1,
        target=ApplicationStatus.SUBMITTED,
        actor=Actor.CLIENT,
        at=datetime.now(UTC),
    )

    assert result.status == ApplicationStatus.SUBMITTED.value
    assert result.version == 2
    session.execute.assert_called_once()
    session.add.assert_called_once()
