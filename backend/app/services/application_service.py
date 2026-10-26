"""Application orchestration over repositories, mocks and the domain evaluator."""

import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.mappers import (
    application_to_out,
    decision_from_result,
    offers_from_rows,
    outcome_route_for,
)
from app.api.schemas import (
    ApplicationIn,
    ApplicationListOut,
    ApplicationOut,
    CompanyOut,
    ConstraintOut,
    LoginOut,
    OfferOut,
    PersonaOut,
    SigningChallenge,
    SimulationIn,
    SimulationOut,
    UserOut,
    UserRole,
)
from app.api.security import create_access_token, decode_access_token, verify_password
from app.db.models import (
    Application,
    AuditLog,
    Offer,
    Product,
    ScoringRun,
    Signature,
    StatusHistory,
    User,
)
from app.db.repositories import ApplicationNotFound, ApplicationRepository, VersionConflict
from app.domain.enums import Actor, ApplicationStatus
from app.domain.scoring.inputs import LoanRequest
from app.domain.serialization import inputs_to_json, result_to_json
from app.mocks.core_banking import MockCoreBanking
from app.mocks.registry import PersonaRegistry
from app.services.evaluator import DomainEvaluator
from app.services.signing import SigningError

OFFER_TTL = timedelta(days=14)
OTP_TTL = timedelta(minutes=5)
OTP_MAX_ATTEMPTS = 3


class ApplicationError(ValueError):
    """Stable-code application error; routers map it to 4xx with `ErrorDTO`."""


class ApplicationService:
    """Real service backed by PostgreSQL; one instance per request session."""

    def __init__(
        self,
        session: Session,
        registry: PersonaRegistry | None = None,
        core_banking: MockCoreBanking | None = None,
        jwt_secret: str = "dev-only-secret-change-me-please-32-bytes",
        evaluator: DomainEvaluator | None = None,
    ) -> None:
        self.session = session
        self.repository = ApplicationRepository(session)
        self.registry = registry or PersonaRegistry()
        self.evaluator = evaluator or DomainEvaluator(session, self.registry)
        self.core_banking = core_banking or MockCoreBanking()
        self.jwt_secret = jwt_secret

    # ---------- auth ----------

    def login(self, login: str, password: str) -> LoginOut:
        user = self.session.scalar(select(User).where(User.login == login))
        if user is None or not verify_password(password, user.password_hash):
            raise ApplicationError("INVALID_CREDENTIALS")
        token = create_access_token(user.id, UserRole(user.role), self.jwt_secret)
        return LoginOut(access_token=token, user=self._user_out(user))

    def user_id_from_token(self, token: str) -> tuple[UUID, UserRole]:
        return decode_access_token(token, self.jwt_secret)

    def user(self, user_id: UUID) -> UserOut:
        return self._user_out(self._get_user(user_id))

    def company(self, user_id: UUID) -> CompanyOut:
        user = self._get_user(user_id)
        if user.company is None:
            raise ApplicationError("COMPANY_NOT_FOUND")
        approval = self.evaluator.pre_approve(user.company, "WC_FLEX")
        return CompanyOut(
            id=user.company.id,
            inn=user.company.inn,
            legal_form=user.company.legal_form,
            name=user.company.name,
            registered_at=user.company.registered_at,
            pre_approved_limit=approval.amount if approval else None,
        )

    def personas(self) -> list[PersonaOut]:
        return [
            PersonaOut(
                id=persona_id,
                login=str(raw["login"]),
                company_name=str(raw["company"].get("name", persona_id)),
                inn=str(raw["company"]["inn"]),
                legal_form=str(raw["company"]["legal_form"]),
                expected_outcome=__import__("app.domain.enums", fromlist=["Outcome"]).Outcome(
                    str(raw["expected"]["outcome"])
                ),
            )
            for persona_id, raw in self.registry._personas.items()
        ]

    def products(self) -> list[Product]:
        return list(self.session.scalars(select(Product).where(Product.active)).all())

    def reset_demo(self) -> None:
        """Delete all pipeline data; seeded users/companies/products stay intact."""
        for model in (ScoringRun, Signature, Offer, StatusHistory, AuditLog, Application):
            self.session.execute(delete(model))
        self.session.commit()

    # ---------- client applications ----------

    def list_applications(self, user_id: UUID) -> ApplicationListOut:
        user = self._get_user(user_id)
        rows = list(
            self.session.scalars(
                select(Application)
                .where(Application.company_id == user.company_id)
                .order_by(Application.created_at)
            ).all()
        )
        return ApplicationListOut(items=[self._application_out(row) for row in rows])

    def create_application(self, user_id: UUID, data: ApplicationIn) -> ApplicationOut:
        user = self._get_user(user_id)
        if user.company_id is None:
            raise ApplicationError("CLIENT_REQUIRED")
        self._validate_request(data)
        application = Application(
            company_id=user.company_id,
            product_code=data.product_code,
            amount=data.amount,
            term_months=data.term_months,
            purpose=data.purpose,
            status=ApplicationStatus.DRAFT.value,
            version=1,
        )
        self.session.add(application)
        self.session.flush()
        self.session.add(
            StatusHistory(
                application_id=application.id,
                from_status=None,
                to_status=ApplicationStatus.DRAFT.value,
                actor=Actor.CLIENT.value,
                at=datetime.now(UTC),
            )
        )
        self.session.commit()
        return self._application_out(application)

    def update_application(
        self, user_id: UUID, application_id: UUID, data: ApplicationIn, version: int
    ) -> ApplicationOut:
        application = self._owned_application(user_id, application_id)
        if application.status != ApplicationStatus.DRAFT.value:
            raise ApplicationError("INVALID_STATUS")
        if application.version != version:
            raise VersionConflict(application_id, version, application.version)
        self._validate_request(data)
        application.product_code = data.product_code
        application.amount = data.amount
        application.term_months = data.term_months
        application.purpose = data.purpose
        self.session.commit()
        return self._application_out(application)

    def submit_application(
        self, user_id: UUID, application_id: UUID, version: int
    ) -> ApplicationOut:
        self._owned_application(user_id, application_id)
        application = self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.SUBMITTED,
            Actor.CLIENT,
            at=datetime.now(UTC),
        )
        self.session.commit()
        return self._application_out(application)

    def simulate(self, user_id: UUID, application_id: UUID, data: SimulationIn) -> SimulationOut:
        application = self._owned_application(user_id, application_id)
        if application.status not in _SIMULATABLE:
            raise ApplicationError("INVALID_STATUS")
        LoanRequest(
            product_code=application.product_code,
            amount=Decimal(data.amount),
            term_months=data.term_months,
        )
        self._validate_request(
            ApplicationIn(
                product_code=application.product_code,
                amount=data.amount,
                term_months=data.term_months,
            )
        )
        simulation = self.evaluator.simulate(application, Decimal(data.amount), data.term_months)
        return SimulationOut(
            predicted_outcome=simulation.predicted_outcome,
            requires_review=simulation.requires_review,
            offers=[
                OfferOut(
                    id=application.id,  # synthetic id: simulations have no persisted offers
                    kind=offer.kind.value,
                    amount=offer.amount,
                    term_months=offer.term_months,
                    rate_pct=offer.rate_pct,
                    monthly_payment=offer.monthly_payment,
                    overpayment=offer.overpayment,
                )
                for offer in simulation.offers
            ],
            constraints=[
                ConstraintOut(
                    name=constraint.name.value,
                    limit=constraint.limit,
                    binding=constraint.binding,
                )
                for constraint in simulation.constraints
            ],
            binding_constraint=(
                simulation.binding_constraint.value if simulation.binding_constraint else None
            ),
            max_amount_for_term=simulation.max_amount_for_term,
            headroom=simulation.headroom,
        )

    def accept_offer(
        self, user_id: UUID, application_id: UUID, version: int, offer_id: UUID | None = None
    ) -> SigningChallenge:
        application = self._owned_application(user_id, application_id)
        if application.status not in (ApplicationStatus.APPROVED.value,):
            raise ApplicationError("INVALID_STATUS")
        if offer_id is not None:
            offer = self.session.get(Offer, offer_id)
            if offer is None or offer.application_id != application_id:
                raise ApplicationError("OFFER_NOT_FOUND")
        self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.SIGNING,
            Actor.CLIENT,
            at=datetime.now(UTC),
        )
        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = datetime.now(UTC) + OTP_TTL
        self.session.add(
            Signature(
                application_id=application_id,
                otp_hash=Signature.hash_code(code),
                attempts=0,
                expires_at=expires_at,
            )
        )
        self.session.commit()
        return SigningChallenge(application_id=application_id, code=code, expires_at=expires_at)

    def sign_application(
        self, user_id: UUID, application_id: UUID, version: int, code: str
    ) -> ApplicationOut:
        application = self._owned_application(user_id, application_id)
        if application.status != ApplicationStatus.SIGNING.value:
            raise ApplicationError("INVALID_STATUS")
        signature = self._latest_signature(application_id)
        if signature is None:
            raise SigningError("SIGNING_CHALLENGE_NOT_FOUND")
        if datetime.now(UTC) >= signature.expires_at:
            raise SigningError("SIGNING_CHALLENGE_EXPIRED")
        if signature.attempts >= OTP_MAX_ATTEMPTS:
            raise SigningError("SIGNING_ATTEMPTS_EXCEEDED")
        if not signature.matches(code):
            signature.attempts += 1
            self.session.commit()
            raise SigningError("INVALID_OTP")
        signature.signed_at = datetime.now(UTC)
        application = self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.SIGNED,
            Actor.CLIENT,
            at=datetime.now(UTC),
        )
        self._audit(None, application_id, "SIGNED", {"otp": "verified"})
        self.session.commit()
        return self._application_out(application)

    def cancel_application(
        self, user_id: UUID, application_id: UUID, version: int
    ) -> ApplicationOut:
        self._owned_application(user_id, application_id)
        application = self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.CANCELLED,
            Actor.CLIENT,
            at=datetime.now(UTC),
        )
        self.session.commit()
        return self._application_out(application)

    # ---------- scoring (invoked by the background runner) ----------

    def run_scoring(self, application_id: UUID, version: int) -> ApplicationStatus:
        application = self.repository.apply_transition(
            application_id,
            version,
            ApplicationStatus.SCORING,
            Actor.SYSTEM,
            at=datetime.now(UTC),
        )
        evaluation = self.evaluator.evaluate(application)
        result = evaluation.result
        result_json = result_to_json(result)
        factors_raw = result_json["factors"]
        assert isinstance(factors_raw, list)
        self.session.add(
            ScoringRun(
                application_id=application_id,
                inputs_snapshot=inputs_to_json(evaluation.inputs),
                factors=factors_raw,
                result=result_json,
                policy_version=result.policy_version,
            )
        )
        self.session.execute(delete(Offer).where(Offer.application_id == application_id))
        expires_at = datetime.now(UTC) + OFFER_TTL
        for draft in result.offers:
            self.session.add(
                Offer(
                    application_id=application_id,
                    kind=draft.kind.value,
                    amount=draft.amount,
                    term_months=draft.term_months,
                    rate_pct=draft.rate_pct,
                    monthly_payment=draft.monthly_payment,
                    overpayment=draft.overpayment,
                    expires_at=expires_at,
                )
            )
        target = outcome_route_for(result.recommendation, result.route)
        application = self.repository.apply_transition(
            application_id,
            application.version,
            target,
            Actor.SYSTEM,
            at=datetime.now(UTC),
        )
        self.session.commit()
        return target

    def disburse(self, application_id: UUID) -> str:
        """SIGNED → DISBURSED through the core-banking mock; returns the account id."""
        application = self.repository.get(application_id)
        account = self.core_banking.open_loan_account(application_id, Decimal(application.amount))
        self.repository.apply_transition(
            application_id,
            application.version,
            ApplicationStatus.DISBURSED,
            Actor.SYSTEM,
            at=datetime.now(UTC),
        )
        self._audit(None, application_id, "DISBURSED", {"loan_account": account})
        self.session.commit()
        return account

    # ---------- decision projection ----------

    def decision_for(self, application: Application) -> ApplicationOut:
        return self._application_out(application)

    # ---------- internal helpers ----------

    def _application_out(self, application: Application) -> ApplicationOut:
        history = list(
            self.session.scalars(
                select(StatusHistory)
                .where(StatusHistory.application_id == application.id)
                .order_by(StatusHistory.at, StatusHistory.id)
            ).all()
        )
        offers = list(
            self.session.scalars(select(Offer).where(Offer.application_id == application.id)).all()
        )
        decision = None
        latest_run = self.session.scalar(
            select(ScoringRun)
            .where(ScoringRun.application_id == application.id)
            .order_by(ScoringRun.created_at.desc(), ScoringRun.id.desc())
        )
        if latest_run is not None:
            from app.domain.serialization import result_from_json

            domain_result = result_from_json(latest_run.result)
            decision = decision_from_result(domain_result, application.id)
        if application.status in (ApplicationStatus.APPROVED.value,):
            if decision is not None:
                decision.offers = offers_from_rows(offers)
        elif application.status == ApplicationStatus.COUNTER_OFFER.value and decision is not None:
            decision.offers = offers_from_rows(offers)
        return application_to_out(application, history, decision)

    def _get_user(self, user_id: UUID) -> User:
        user = self.session.get(User, user_id)
        if user is None:
            raise ApplicationError("USER_NOT_FOUND")
        return user

    @staticmethod
    def _user_out(user: User) -> UserOut:
        return UserOut(
            id=user.id,
            login=user.login,
            role=UserRole(user.role),
            company_id=user.company_id,
        )

    def _owned_application(self, user_id: UUID, application_id: UUID) -> Application:
        user = self._get_user(user_id)
        try:
            application = self.repository.get(application_id)
        except ApplicationNotFound:
            raise ApplicationError("APPLICATION_NOT_FOUND") from None
        if user.role != UserRole.BANK.value and application.company_id != user.company_id:
            raise ApplicationError("APPLICATION_NOT_FOUND")
        return application

    def _validate_request(self, data: ApplicationIn) -> None:
        request = LoanRequest(
            product_code=data.product_code,
            amount=Decimal(data.amount),
            term_months=data.term_months,
        )
        from app.domain.scoring.policy import validate_request

        validate_request(request, self.evaluator.policy)

    def _latest_signature(self, application_id: UUID) -> Signature | None:
        return self.session.scalar(
            select(Signature)
            .where(Signature.application_id == application_id)
            .order_by(Signature.expires_at.desc(), Signature.id.desc())
            .limit(1)
        )

    def _audit(
        self,
        actor_user_id: UUID | None,
        application_id: UUID | None,
        action: str,
        payload: dict[str, str],
    ) -> None:
        self.session.add(
            AuditLog(
                actor_user_id=actor_user_id,
                application_id=application_id,
                action=action,
                payload=payload,
            )
        )


_SIMULATABLE = frozenset(
    {
        ApplicationStatus.DRAFT.value,
        ApplicationStatus.SUBMITTED.value,
        ApplicationStatus.APPROVED.value,
        ApplicationStatus.COUNTER_OFFER.value,
        ApplicationStatus.UNDERWRITING.value,
    }
)
