"""Deterministic in-memory service used before PostgreSQL is available."""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from uuid import UUID, uuid4

from app.api.schemas import (
    ApplicationIn,
    ApplicationListOut,
    ApplicationOut,
    CompanyOut,
    DecisionOut,
    LoginOut,
    PersonaOut,
    StatusEventOut,
    UserOut,
    UserRole,
)
from app.domain.enums import ApplicationStatus, Grade, Outcome, Route
from app.seed.personas import load_raw


@dataclass(slots=True)
class _StubUser:
    id: UUID
    login: str
    role: UserRole
    company_id: UUID | None
    persona_id: str | None


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
    def __init__(self) -> None:
        self._users: dict[UUID, _StubUser] = {}
        self._by_login: dict[str, _StubUser] = {}
        self._applications: dict[UUID, _StubApplication] = {}
        self._personas = {str(item["id"]): item for item in load_raw()["personas"]}
        self._seed_users()

    def _seed_users(self) -> None:
        for item in self._personas.values():
            user = _StubUser(uuid4(), str(item["login"]), UserRole.CLIENT, uuid4(), str(item["id"]))
            self._users[user.id] = user
            self._by_login[user.login] = user
        bank = _StubUser(uuid4(), "underwriter", UserRole.BANK, None, None)
        self._users[bank.id] = bank
        self._by_login[bank.login] = bank

    def _user(self, user_id: UUID) -> _StubUser:
        try:
            return self._users[user_id]
        except KeyError as exc:
            raise ValueError("USER_NOT_FOUND") from exc

    @staticmethod
    def _public(user: _StubUser) -> UserOut:
        return UserOut(id=user.id, login=user.login, role=user.role, company_id=user.company_id)

    def login(self, login: str, password: str) -> LoginOut:
        user = self._by_login.get(login)
        if user is None or password != "demo":
            raise ValueError("INVALID_CREDENTIALS")
        token = sha256(f"{user.id}:demo".encode()).hexdigest()
        return LoginOut(access_token=token, user=self._public(user))

    def user_id_from_token(self, token: str) -> UUID | None:
        for user in self._users.values():
            if token == sha256(f"{user.id}:demo".encode()).hexdigest():
                return user.id
        return None

    def user(self, user_id: UUID) -> UserOut:
        return self._public(self._user(user_id))

    def company(self, user_id: UUID) -> CompanyOut:
        user = self._user(user_id)
        if user.persona_id is None or user.company_id is None:
            raise ValueError("COMPANY_NOT_FOUND")
        company = self._personas[user.persona_id]["company"]
        return CompanyOut(
            id=user.company_id,
            inn=str(company["inn"]),
            legal_form=str(company["legal_form"]),
            name=str(company.get("name", user.persona_id)),
            registered_at=date.fromisoformat(str(company["registered_at"])),
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
            history=item.history,
            decision=item.decision,
        )

    def list_applications(self, user_id: UUID) -> ApplicationListOut:
        return ApplicationListOut(
            items=[
                self._out(item) for item in self._applications.values() if item.user_id == user_id
            ]
        )

    def create_application(self, user_id: UUID, data: ApplicationIn) -> ApplicationOut:
        user = self._user(user_id)
        if user.company_id is None:
            raise ValueError("CLIENT_REQUIRED")
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
                actor="CLIENT",
                at=datetime.now(UTC),
            )
        )
        self._applications[app.id] = app
        return self._out(app)

    def submit_application(self, user_id: UUID, application_id: UUID) -> ApplicationOut:
        item = self._applications.get(application_id)
        if item is None or item.user_id != user_id:
            raise ValueError("APPLICATION_NOT_FOUND")
        if item.status != ApplicationStatus.DRAFT:
            raise ValueError("INVALID_STATUS")
        now = datetime.now(UTC)
        item.status = ApplicationStatus.APPROVED
        item.version += 1
        item.history.extend(
            [
                StatusEventOut(
                    from_status=ApplicationStatus.DRAFT,
                    to_status=ApplicationStatus.SUBMITTED,
                    actor="CLIENT",
                    at=now,
                ),
                StatusEventOut(
                    from_status=ApplicationStatus.SUBMITTED,
                    to_status=ApplicationStatus.APPROVED,
                    actor="SYSTEM",
                    at=now,
                ),
            ]
        )
        item.decision = DecisionOut(
            outcome=Outcome.APPROVED,
            route=Route.AUTO,
            score=100,
            grade=Grade.A,
        )
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
