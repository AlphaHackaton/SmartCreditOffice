"""Background scoring entrypoint with an independent database session."""

from uuid import UUID

from sqlalchemy.orm import Session, sessionmaker

from app.services.application_service import ApplicationService


def run_scoring(
    application_id: UUID,
    version: int,
    session_factory: sessionmaker[Session],
    jwt_secret: str = "dev-only-secret-change-me-please-32-bytes",
) -> None:
    """Run scoring outside the request session and close resources deterministically.

    Safe to re-run: transitions are guarded by the FSM and optimistic versions,
    so a duplicate invocation is a no-op or a clean VERSION_CONFLICT.
    """
    with session_factory() as session:
        service = ApplicationService(session, jwt_secret=jwt_secret)
        service.run_scoring(application_id, version)
