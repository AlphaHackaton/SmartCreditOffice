"""Ports consumed by API routers."""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Protocol
from uuid import UUID

from app.api.schemas import (
    ApplicationIn,
    ApplicationListOut,
    ApplicationOut,
    CompanyOut,
    LoginOut,
    UserOut,
)
from app.domain.scoring.inputs import AccountData, BkiReport, CompanyData, FnsData


class FnsGateway(Protocol):
    def get_company(self, inn: str) -> CompanyData: ...

    def get_declaration(self, inn: str) -> FnsData: ...


class BkiGateway(Protocol):
    def get_report(self, inn: str, subject: Literal["COMPANY", "PERSON"]) -> BkiReport: ...


class AccountGateway(Protocol):
    def get_turnover(self, company_id: UUID, months: int = 12) -> AccountData: ...


class CoreBanking(Protocol):
    def open_loan_account(self, application_id: UUID, amount: Decimal) -> str: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class ApplicationServicePort(Protocol):
    def login(self, login: str, password: str) -> LoginOut: ...

    def user(self, user_id: UUID) -> UserOut: ...

    def company(self, user_id: UUID) -> CompanyOut: ...

    def list_applications(self, user_id: UUID) -> ApplicationListOut: ...

    def create_application(self, user_id: UUID, data: ApplicationIn) -> ApplicationOut: ...

    def submit_application(self, user_id: UUID, application_id: UUID) -> ApplicationOut: ...
