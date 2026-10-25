"""Application orchestration over repositories, mocks and evaluator."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.repositories import ApplicationRepository
from app.domain.enums import Actor, ApplicationStatus, Outcome
from app.services.evaluator import DemoEvaluator, Evaluator
from app.services.signing import OtpSigner, SigningError


class ApplicationService:
    def __init__(
        self,
        session: Session,
        evaluator: Evaluator | None = None,
        signer: OtpSigner | None = None,
    ) -> None:
        self.session = session
        self.repository = ApplicationRepository(session)
        self.evaluator = evaluator or DemoEvaluator()
        self.signer = signer or OtpSigner()

    def run_scoring(self, application_id: UUID, version: int) -> ApplicationStatus:
        application = self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.SCORING,
            Actor.SYSTEM,
            at=datetime.now(UTC),
        )
        evaluation = self.evaluator.evaluate(application_id)
        self.repository.apply_transition(
            application_id,
            application.version,
            _status_for_outcome(evaluation.outcome),
            Actor.SYSTEM,
            at=datetime.now(UTC),
        )
        self.session.commit()
        return _status_for_outcome(evaluation.outcome)

    def accept_offer(self, application_id: UUID, version: int) -> tuple[str, datetime]:
        self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.SIGNING,
            Actor.CLIENT,
            at=datetime.now(UTC),
        )
        code, expires_at = self.signer.create_challenge(application_id)
        self.session.commit()
        return code, expires_at

    def sign(self, application_id: UUID, version: int, code: str) -> ApplicationStatus:
        try:
            self.signer.verify(application_id, code)
        except SigningError:
            self.session.rollback()
            raise
        self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.SIGNED,
            Actor.CLIENT,
            at=datetime.now(UTC),
        )
        self.session.commit()
        return ApplicationStatus.SIGNED


def _status_for_outcome(outcome: Outcome) -> ApplicationStatus:
    return ApplicationStatus(outcome.value)
