"""FastAPI entrypoint. Importing this module never opens a database connection."""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from starlette.responses import JSONResponse, Response

from app.api.routers import applications, auth, bank, demo, health
from app.api.schemas import ErrorDTO
from app.config import Settings, settings
from app.services.bank import BankService
from app.services.stub import StubApplicationService


def create_app(app_settings: Settings | None = None) -> FastAPI:
    runtime = app_settings or settings
    application = FastAPI(
        title="Smart Credit Office API",
        version="0.1.0",
        separate_input_output_schemas=False,
    )
    application.state.settings = runtime
    application.state.service = StubApplicationService(runtime.jwt_secret)
    application.state.bank_service = BankService(application.state.service)

    @application.middleware("http")
    async def attach_identity(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        token = request.headers.get("Authorization", "")
        if token.startswith("Bearer "):
            try:
                user_id, role = application.state.service.user_id_from_token(token[7:])
            except Exception:
                pass
            else:
                request.state.user_id = user_id
                request.state.role = role
        return await call_next(request)

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
    application.include_router(applications.router, prefix=prefix)
    application.include_router(bank.router, prefix=prefix)
    return application


app = create_app()
