"""Background scoring entrypoint with an independent database session."""

from uuid import UUID

from sqlalchemy.orm import Session, sessionmaker

from app.services.application_service import ApplicationService
from app.services.evaluator import Evaluator
from app.services.signing import OtpSigner


def run_scoring(
    application_id: UUID,
    version: int,
    session_factory: sessionmaker[Session],
    evaluator: Evaluator | None = None,
    signer: OtpSigner | None = None,
) -> None:
    """Run scoring outside the request session and close resources deterministically."""
    with session_factory() as session:
        ApplicationService(session, evaluator=evaluator, signer=signer).run_scoring(
            application_id, version
        )
