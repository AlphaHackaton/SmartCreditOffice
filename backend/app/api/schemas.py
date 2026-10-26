"""Stable HTTP DTOs shared by stub and real services."""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, WithJsonSchema

from app.domain.enums import ApplicationStatus, Grade, Outcome, Route

Money = Annotated[
    Decimal,
    PlainSerializer(str, return_type=str),
    WithJsonSchema({"type": "string", "format": "decimal"}),
]


class UserRole(StrEnum):
    CLIENT = "CLIENT"
    BANK = "BANK"


class ErrorDTO(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class HealthOut(BaseModel):
    status: str = "ok"
    mode: str


class PersonaOut(BaseModel):
    id: str
    login: str
    company_name: str
    inn: str
    legal_form: str
    expected_outcome: Outcome


class LoginIn(BaseModel):
    login: str = Field(min_length=1)
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    login: str
    role: UserRole
    company_id: UUID | None = None


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SigningChallenge(BaseModel):
    application_id: UUID
    code: str
    expires_at: datetime


class CompanyOut(BaseModel):
    id: UUID
    inn: str
    legal_form: str
    name: str
    registered_at: date
    pre_approved_limit: Money | None = None


class ApplicationIn(BaseModel):
    product_code: str = Field(min_length=1)
    amount: Money = Field(gt=0)
    term_months: int = Field(ge=1, le=60)
    purpose: str = "WORKING_CAPITAL"


class SignIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class ResetOut(BaseModel):
    reset: bool = True


class FactorOut(BaseModel):
    code: str
    source: str
    value: str
    points: int
    max_points: int
    impact: str
    rule_id: str
    client_text: str = ""
    hint: str | None = None


class OfferOut(BaseModel):
    id: UUID
    kind: str
    amount: Money
    term_months: int
    rate_pct: Money
    monthly_payment: Money
    overpayment: Money
    expires_at: datetime | None = None


class SimulationIn(BaseModel):
    amount: Money = Field(gt=0)
    term_months: int = Field(ge=1, le=60)


class ConstraintOut(BaseModel):
    name: str
    limit: Money
    binding: bool


class SimulationOut(BaseModel):
    predicted_outcome: Outcome
    requires_review: bool
    offers: list[OfferOut] = Field(default_factory=list)
    constraints: list[ConstraintOut] = Field(default_factory=list)
    binding_constraint: str | None = None
    max_amount_for_term: Money
    headroom: Money


class ProductOut(BaseModel):
    code: str
    name: str
    min_amount: Money
    max_amount: Money
    min_term_months: int
    max_term_months: int


class ProductsOut(BaseModel):
    items: list[ProductOut]


class ScoringRunOut(BaseModel):
    id: UUID
    application_id: UUID
    inputs_snapshot: dict[str, Any]
    factors: list[dict[str, Any]]
    result: dict[str, Any]
    policy_version: str
    created_at: datetime


class DecisionOut(BaseModel):
    outcome: Outcome
    route: Route
    score: int | None = None
    grade: Grade | None = None
    factors: list[FactorOut] = Field(default_factory=list)
    offers: list[OfferOut] = Field(default_factory=list)
    binding_constraint: str | None = None
    top_reasons: list[str] = Field(default_factory=list)


class StatusEventOut(BaseModel):
    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    actor: str
    at: datetime
    reason: str | None = None


class ApplicationOut(BaseModel):
    id: UUID
    company_id: UUID
    product_code: str
    amount: Money
    term_months: int
    status: ApplicationStatus
    version: int
    history: list[StatusEventOut] = Field(default_factory=list)
    decision: DecisionOut | None = None
    selected_offer: OfferOut | None = None


class ApplicationListOut(BaseModel):
    items: list[ApplicationOut]


class BankApplicationSummary(BaseModel):
    id: UUID
    company_id: UUID
    status: ApplicationStatus
    product_code: str
    amount: Money
    term_months: int
    version: int


class BankQueueOut(BaseModel):
    items: list[BankApplicationSummary]


class BankDossierOut(BaseModel):
    application: ApplicationOut
    inputs_snapshot: dict[str, Any] = Field(default_factory=dict)
    audit: list[dict[str, Any]] = Field(default_factory=list)


class UnderwriterDecisionIn(BaseModel):
    outcome: Outcome
    comment: str = Field(min_length=1, max_length=2000)


class MetricsOut(BaseModel):
    total_applications: int
    automated_decisions: int
    underwriting_decisions: int
    approved: int
    counter_offer: int
    rejected: int
