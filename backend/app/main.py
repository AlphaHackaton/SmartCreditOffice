"""FastAPI entrypoint. Importing this module never opens a database connection.

`APP_MODE=stub` boots the in-memory demo service (no database required).
`APP_MODE=real` boots the database-backed service: every request gets its own
session, seeding runs once on startup, and scoring/disbursement run as
background tasks with independent sessions.
"""

from collections.abc import AsyncIterator, Awaitable, Callable
from uuid import UUID

from fastapi import FastAPI, Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.responses import JSONResponse, Response

from app.api.errors import register_exception_handlers
from app.api.routers import applications, auth, bank, companies, demo, health, products
from app.api.schemas import ErrorDTO
from app.api.security import decode_access_token
from app.config import Settings, settings
from app.services.stub import StubApplicationService


def create_app(app_settings: Settings | None = None) -> FastAPI:
    runtime = app_settings or settings
    application = FastAPI(
        title="Smart Credit Office API",
        version="0.1.0",
        separate_input_output_schemas=False,
    )
    application.state.settings = runtime

    @application.middleware("http")
    async def attach_identity(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        token = request.headers.get("Authorization", "")
        if token.startswith("Bearer "):
            try:
                user_id, role = decode_access_token(token[7:], runtime.jwt_secret)
            except Exception:
                pass
            else:
                request.state.user_id = user_id
                request.state.role = role
        return await call_next(request)

    register_exception_handlers(application)

    @application.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> Response:
        body = ErrorDTO(code=str(exc), message="Request cannot be completed").model_dump(
            mode="json"
        )
        return JSONResponse(status_code=400, content=body)

    prefix = runtime.api_prefix
    application.include_router(health.router, prefix=prefix)
    application.include_router(demo.router, prefix=prefix)
    application.include_router(auth.router, prefix=prefix)
    application.include_router(products.router, prefix=prefix)
    application.include_router(companies.router, prefix=prefix)
    application.include_router(applications.router, prefix=prefix)
    application.include_router(bank.router, prefix=prefix)

    if runtime.app_mode == "real":
        _wire_real(application, runtime)
    else:
        _wire_stub(application, runtime)
    return application


def _wire_stub(application: FastAPI, runtime: Settings) -> None:
    from app.services.bank import StubBankService

    service = StubApplicationService(runtime.jwt_secret)
    application.state.service = service
    application.state.bank_service = StubBankService(service)


def _wire_real(application: FastAPI, runtime: Settings) -> None:
    from contextlib import asynccontextmanager

    from app.seed.seed import seed
    from app.services.application_service import ApplicationService
    from app.services.bank import BankService

    engine = create_engine(runtime.database_url, pool_pre_ping=True)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    @asynccontextmanager
    async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
        with session_factory() as session:
            seed(session)
        yield

    application.router.lifespan_context = _lifespan

    @application.middleware("http")
    async def per_request_service(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # Demo-scale concurrency note: one service per request is placed on app
        # state; routers resolve it without extra FastAPI dependency plumbing.
        with session_factory() as session:
            service = ApplicationService(session, jwt_secret=runtime.jwt_secret)
            request.app.state.service = service
            request.app.state.bank_service = BankService(service)
            return await call_next(request)

    def scoring_runner(application_id: UUID, version: int) -> None:
        with session_factory() as session:
            ApplicationService(session, jwt_secret=runtime.jwt_secret).run_scoring(
                application_id, version
            )

    def disbursement_runner(application_id: UUID, version: int) -> None:
        with session_factory() as session:
            service = ApplicationService(session, jwt_secret=runtime.jwt_secret)
            row = service.repository.get(application_id)
            if row.status == "SIGNED" and row.version == version:
                service.disburse(application_id)

    application.state.scoring_runner = scoring_runner
    application.state.disbursement_runner = disbursement_runner


app = create_app()
