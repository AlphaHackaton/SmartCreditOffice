"""Deterministic in-memory service used before PostgreSQL is available.

Decisions are produced by the real domain engine over persona fixtures, so the
stub exposes the same contract and the same numbers as the database-backed
service — only persistence and OTP storage are in-memory.
"""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from app.api.mappers import decision_from_result
from app.api.schemas import (
    ApplicationIn,
    ApplicationListOut,
    ApplicationOut,
    CompanyOut,
    ConstraintOut,
    DecisionOut,
    LoginOut,
    OfferOut,
    PersonaOut,
    ProductOut,
    SignIn,
    SigningChallenge,
    SimulationIn,
    SimulationOut,
    StatusEventOut,
    UserOut,
    UserRole,
)
from app.api.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.domain import application_status
from app.domain.enums import Actor, ApplicationStatus, Outcome, Route
from app.domain.scoring.engine import evaluate as engine_evaluate
from app.domain.scoring.engine import pre_approve as engine_pre_approve
from app.domain.scoring.engine import simulate as engine_simulate
from app.domain.scoring.inputs import LoanRequest
from app.domain.scoring.policy import validate_request
from app.seed.personas import load_inputs, load_raw
from app.services.application_service import runtime_policy
from app.services.signing import OtpSigner, SigningError


class StubError(ValueError):
    """Stable-code stub error mapped to 4xx like the real service."""


@dataclass(slots=True)
class _StubUser:
    id: UUID
    login: str
    role: UserRole
    company_id: UUID | None
    persona_id: str | None
    password_hash: str


@dataclass(slots=True)
class _StubApplication:
    id: UUID
    user_id: UUID
    company_id: UUID
    product_code: str
    amount: str
    term_months: int
    status: ApplicationStatus = ApplicationStatus.DRAFT
    version: int = 1
    history: list[StatusEventOut] = field(default_factory=list)
    decision: DecisionOut | None = None


class StubApplicationService:
    def __init__(self, jwt_secret: str = "dev-only-secret-change-me-please-32-bytes") -> None:
        self._jwt_secret = jwt_secret
        self._users: dict[UUID, _StubUser] = {}
        self._by_login: dict[str, _StubUser] = {}
        self._applications: dict[UUID, _StubApplication] = {}
        self._personas = {str(item["id"]): item for item in load_raw()["personas"]}
        self._signer: OtpSigner | None = None
        self.policy = runtime_policy()
        self._seed_users()

    def _seed_users(self) -> None:
        for item in self._personas.values():
            user = _StubUser(
                uuid4(),
                str(item["login"]),
                UserRole.CLIENT,
                uuid4(),
                str(item["id"]),
                hash_password("demo"),
            )
            self._users[user.id] = user
            self._by_login[user.login] = user
        bank = _StubUser(uuid4(), "underwriter", UserRole.BANK, None, None, hash_password("demo"))
        self._users[bank.id] = bank
        self._by_login[bank.login] = bank

    def _user(self, user_id: UUID) -> _StubUser:
        try:
            return self._users[user_id]
        except KeyError as exc:
            raise StubError("USER_NOT_FOUND") from exc

    @staticmethod
    def _public(user: _StubUser) -> UserOut:
        return UserOut(id=user.id, login=user.login, role=user.role, company_id=user.company_id)

    def login(self, login: str, password: str) -> LoginOut:
        user = self._by_login.get(login)
        if user is None or not verify_password(password, user.password_hash):
            raise StubError("INVALID_CREDENTIALS")
        token = create_access_token(user.id, user.role, self._jwt_secret)
        return LoginOut(access_token=token, user=self._public(user))

    def user_id_from_token(self, token: str) -> tuple[UUID, UserRole]:
        return decode_access_token(token, self._jwt_secret)

    def user(self, user_id: UUID) -> UserOut:
        return self._public(self._user(user_id))

    def company(self, user_id: UUID) -> CompanyOut:
        user = self._user(user_id)
        if user.persona_id is None or user.company_id is None:
            raise StubError("COMPANY_NOT_FOUND")
        company = self._personas[user.persona_id]["company"]
        approval = engine_pre_approve(load_inputs(user.persona_id), "WC_FLEX", self.policy)
        return CompanyOut(
            id=user.company_id,
            inn=str(company["inn"]),
            legal_form=str(company["legal_form"]),
            name=str(company.get("name", user.persona_id)),
            registered_at=date.fromisoformat(str(company["registered_at"])),
            pre_approved_limit=approval.amount if approval else None,
        )

    def _out(self, item: _StubApplication) -> ApplicationOut:
        return ApplicationOut(
            id=item.id,
            company_id=item.company_id,
            product_code=item.product_code,
            amount=Decimal(item.amount),
            term_months=item.term_months,
            status=item.status,
            version=item.version,
            history=list(item.history),
            decision=item.decision,
        )

    def list_applications(self, user_id: UUID) -> ApplicationListOut:
        owned = [self._out(item) for item in self._applications.values() if item.user_id == user_id]
        return ApplicationListOut(items=owned)

    def _owned(self, user_id: UUID, application_id: UUID) -> _StubApplication:
        item = self._applications.get(application_id)
        if item is None or item.user_id != user_id:
            raise StubError("APPLICATION_NOT_FOUND")
        return item

    def create_application(self, user_id: UUID, data: ApplicationIn) -> ApplicationOut:
        user = self._user(user_id)
        if user.company_id is None:
            raise StubError("CLIENT_REQUIRED")
        self._validate(data)
        app = _StubApplication(
            id=uuid4(),
            user_id=user_id,
            company_id=user.company_id,
            product_code=data.product_code,
            amount=str(data.amount),
            term_months=data.term_months,
        )
        app.history.append(
            StatusEventOut(
                from_status=None,
                to_status=app.status,
                actor=Actor.CLIENT.value,
                at=datetime.now(UTC),
            )
        )
        self._applications[app.id] = app
        return self._out(app)

    def update_application(
        self, user_id: UUID, application_id: UUID, data: ApplicationIn, version: int
    ) -> ApplicationOut:
        item = self._owned(user_id, application_id)
        if item.status != ApplicationStatus.DRAFT:
            raise StubError("INVALID_STATUS")
        if item.version != version:
            raise StubError("VERSION_CONFLICT")
        self._validate(data)
        item.product_code = data.product_code
        item.amount = str(data.amount)
        item.term_months = data.term_months
        return self._out(item)

    def submit_application(
        self, user_id: UUID, application_id: UUID, version: int = 1
    ) -> ApplicationOut:
        item = self._owned(user_id, application_id)
        self._transition(item, ApplicationStatus.SUBMITTED, Actor.CLIENT, expected_version=version)
        self._transition(item, ApplicationStatus.SCORING, Actor.SYSTEM)
        user = self._user(user_id)
        assert user.persona_id is not None
        request = LoanRequest(
            product_code=item.product_code,
            amount=Decimal(item.amount),
            term_months=item.term_months,
        )
        result = engine_evaluate(load_inputs(user.persona_id), request, self.policy)
        target = (
            ApplicationStatus.UNDERWRITING
            if result.route is Route.UNDERWRITING
            else ApplicationStatus(result.recommendation.value)
        )
        self._transition(item, target, Actor.SYSTEM)
        item.decision = decision_from_result(result, item.id)
        return self._out(item)

    def simulate(self, user_id: UUID, application_id: UUID, data: SimulationIn) -> SimulationOut:
        item = self._owned(user_id, application_id)
        self._validate(
            ApplicationIn(
                product_code=item.product_code,
                amount=data.amount,
                term_months=data.term_months,
            )
        )
        user = self._user(user_id)
        assert user.persona_id is not None
        request = LoanRequest(
            product_code=item.product_code,
            amount=Decimal(data.amount),
            term_months=data.term_months,
        )
        simulation = engine_simulate(load_inputs(user.persona_id), request, self.policy)
        return SimulationOut(
            predicted_outcome=simulation.predicted_outcome,
            requires_review=simulation.requires_review,
            offers=[
                OfferOut(
                    id=uuid4(),
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
        self, user_id: UUID, application_id: UUID, version: int = 1, offer_id: UUID | None = None
    ) -> SigningChallenge:
        item = self._owned(user_id, application_id)
        if item.status not in (ApplicationStatus.APPROVED, ApplicationStatus.COUNTER_OFFER):
            raise StubError("INVALID_STATUS")
        self._transition(item, ApplicationStatus.SIGNING, Actor.CLIENT, expected_version=version)
        if self._signer is None:
            self._signer = OtpSigner()
        assert self._signer is not None
        code, expires_at = self._signer.create_challenge(application_id)
        return SigningChallenge(application_id=application_id, code=code, expires_at=expires_at)

    def sign_application(
        self, user_id: UUID, application_id: UUID, version: int, data: SignIn | str
    ) -> ApplicationOut:
        code = data.code if isinstance(data, SignIn) else data
        item = self._owned(user_id, application_id)
        if item.status != ApplicationStatus.SIGNING:
            raise StubError("INVALID_STATUS")
        signer = self._signer
        if signer is None:
            raise SigningError("SIGNING_CHALLENGE_NOT_FOUND")
        signer.verify(application_id, code)
        self._transition(item, ApplicationStatus.SIGNED, Actor.CLIENT, expected_version=version)
        self._transition(item, ApplicationStatus.DISBURSED, Actor.SYSTEM)
        return self._out(item)

    def cancel_application(
        self, user_id: UUID, application_id: UUID, version: int = 1
    ) -> ApplicationOut:
        item = self._owned(user_id, application_id)
        self._transition(item, ApplicationStatus.CANCELLED, Actor.CLIENT, expected_version=version)
        return self._out(item)

    def personas(self) -> list[PersonaOut]:
        return [
            PersonaOut(
                id=str(item["id"]),
                login=str(item["login"]),
                company_name=str(item["company"].get("name", item["id"])),
                inn=str(item["company"]["inn"]),
                legal_form=str(item["company"]["legal_form"]),
                expected_outcome=Outcome(str(item["expected"]["outcome"])),
            )
            for item in self._personas.values()
        ]

    def reset_demo(self) -> None:
        self._applications.clear()

    def products(self) -> list[ProductOut]:
        return [
            ProductOut(
                code=product.code,
                name=product.name,
                min_amount=product.min_amount,
                max_amount=product.max_amount,
                min_term_months=product.min_term,
                max_term_months=product.max_term,
            )
            for product in self.policy.products
        ]

    # ---------- internals ----------

    def _validate(self, data: ApplicationIn) -> None:
        validate_request(
            LoanRequest(
                product_code=data.product_code,
                amount=Decimal(data.amount),
                term_months=data.term_months,
            ),
            self.policy,
        )

    def _transition(
        self,
        item: _StubApplication,
        target: ApplicationStatus,
        actor: Actor,
        expected_version: int | None = None,
    ) -> None:
        if expected_version is not None and item.version != expected_version:
            raise StubError("VERSION_CONFLICT")
        event = application_status.transition(item.status, target, actor, at=datetime.now(UTC))
        item.history.append(
            StatusEventOut(
                from_status=event.from_status,
                to_status=event.to_status,
                actor=event.actor.value,
                at=event.at,
                reason=event.reason,
            )
        )
        item.status = target
        item.version += 1
