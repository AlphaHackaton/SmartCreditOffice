"""Ports consumed by API routers."""

from typing import Protocol
from uuid import UUID

from app.api.schemas import (
    ApplicationIn,
    ApplicationListOut,
    ApplicationOut,
    CompanyOut,
    LoginOut,
    UserOut,
)


class ApplicationServicePort(Protocol):
    def login(self, login: str, password: str) -> LoginOut: ...

    def user(self, user_id: UUID) -> UserOut: ...

    def company(self, user_id: UUID) -> CompanyOut: ...

    def list_applications(self, user_id: UUID) -> ApplicationListOut: ...

    def create_application(self, user_id: UUID, data: ApplicationIn) -> ApplicationOut: ...

    def submit_application(self, user_id: UUID, application_id: UUID) -> ApplicationOut: ...
