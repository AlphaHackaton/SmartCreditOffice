"""Relational persistence models for the credit pipeline."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

UUIDType = PG_UUID(as_uuid=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    login: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16))
    company_id: Mapped[UUID | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped[Company | None] = relationship(back_populates="users")


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    inn: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    ogrn: Mapped[str | None] = mapped_column(String(15), nullable=True)
    legal_form: Mapped[str] = mapped_column(String(8))
    name: Mapped[str] = mapped_column(String(255))
    okved: Mapped[str] = mapped_column(String(16))
    registered_at: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list[User]] = relationship(back_populates="company")
    applications: Mapped[list[Application]] = relationship(back_populates="company")


class Product(Base):
    __tablename__ = "products"

    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    min_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    max_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    min_term_months: Mapped[int] = mapped_column(Integer)
    max_term_months: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(default=True)


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    product_code: Mapped[str] = mapped_column(ForeignKey("products.code"))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    term_months: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(24), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company: Mapped[Company] = relationship(back_populates="applications")
    history: Mapped[list[StatusHistory]] = relationship(
        back_populates="application", cascade="all, delete-orphan", order_by="StatusHistory.at"
    )
    scoring_runs: Mapped[list[ScoringRun]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    offers: Mapped[list[Offer]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    signatures: Mapped[list[Signature]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    application_id: Mapped[UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    from_status: Mapped[str | None] = mapped_column(String(24), nullable=True)
    to_status: Mapped[str] = mapped_column(String(24))
    actor: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped[Application] = relationship(back_populates="history")


class ScoringRun(Base):
    __tablename__ = "scoring_runs"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    application_id: Mapped[UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    inputs_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    factors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB)
    policy_version: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped[Application] = relationship(back_populates="scoring_runs")


class Offer(Base):
    __tablename__ = "offers"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    application_id: Mapped[UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(24))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    term_months: Mapped[int] = mapped_column(Integer)
    rate_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    monthly_payment: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    overpayment: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    application: Mapped[Application] = relationship(back_populates="offers")


class Signature(Base):
    __tablename__ = "signatures"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    application_id: Mapped[UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    offer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("offers.id", ondelete="SET NULL"), nullable=True
    )
    otp_hash: Mapped[str] = mapped_column(String(128))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    contract_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped[Application] = relationship(back_populates="signatures")
    offer: Mapped[Offer | None] = relationship()

    @staticmethod
    def hash_code(code: str) -> str:
        import hashlib

        return hashlib.sha256(code.encode()).hexdigest()

    def matches(self, code: str) -> bool:
        import secrets

        return secrets.compare_digest(self.otp_hash, self.hash_code(code))

    def contract_terms(self, application: Application) -> dict[str, str]:
        """Canonical contract terms being signed; from the accepted offer if any."""
        offer = self.offer
        if offer is not None:
            return {
                "application_id": str(application.id),
                "offer_id": str(offer.id),
                "offer_kind": offer.kind,
                "amount": str(offer.amount),
                "term_months": str(offer.term_months),
                "rate_pct": str(offer.rate_pct),
                "monthly_payment": str(offer.monthly_payment),
                "overpayment": str(offer.overpayment),
            }
        return {
            "application_id": str(application.id),
            "product_code": application.product_code,
            "amount": str(application.amount),
            "term_months": str(application.term_months),
        }


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[UUID] = mapped_column(UUIDType, primary_key=True, default=uuid4)
    actor_user_id: Mapped[UUID | None] = mapped_column(UUIDType, nullable=True)
    application_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("applications.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
