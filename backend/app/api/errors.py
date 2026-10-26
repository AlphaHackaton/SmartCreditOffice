"""Mapping of domain/repository errors to HTTP responses with a single ErrorDTO."""

from fastapi import FastAPI, Request, status
from starlette.responses import JSONResponse

from app.api.schemas import ErrorDTO
from app.db.repositories import ApplicationNotFound, RepositoryError, VersionConflict
from app.domain.errors import DomainError
from app.services.application_service import ApplicationError
from app.services.signing import SigningError


class ApiError(Exception):
    """Raised by services/routers; rendered as `ErrorDTO` with a stable code."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


#: Application-level codes that describe a state conflict rather than bad input.
_CONFLICT_CODES = frozenset({"INVALID_STATUS"})


def register_exception_handlers(app: FastAPI) -> None:
    """Attach uniform error handlers; `ValueError` keeps legacy stub behaviour."""

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        body = ErrorDTO(code=exc.code, message=exc.message).model_dump(mode="json")
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(ApplicationError)
    async def application_error_handler(request: Request, exc: ApplicationError) -> JSONResponse:
        code = str(exc)
        http_status = (
            status.HTTP_409_CONFLICT if code in _CONFLICT_CODES else status.HTTP_400_BAD_REQUEST
        )
        body = ErrorDTO(code=code, message="Application command cannot be completed").model_dump(
            mode="json"
        )
        return JSONResponse(status_code=http_status, content=body)

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        code = exc.code
        http_status = status.HTTP_409_CONFLICT
        if code == "REASON_REQUIRED":
            http_status = status.HTTP_400_BAD_REQUEST
        elif code in {"AMOUNT_OUT_OF_RANGE", "TERM_OUT_OF_RANGE", "UNKNOWN_PRODUCT"}:
            http_status = status.HTTP_422_UNPROCESSABLE_ENTITY
        body = ErrorDTO(code=code, message=exc.message).model_dump(mode="json")
        return JSONResponse(status_code=http_status, content=body)

    @app.exception_handler(RepositoryError)
    async def repository_error_handler(request: Request, exc: RepositoryError) -> JSONResponse:
        if isinstance(exc, ApplicationNotFound):
            http_status = status.HTTP_404_NOT_FOUND
            code = "APPLICATION_NOT_FOUND"
        elif isinstance(exc, VersionConflict):
            http_status = status.HTTP_409_CONFLICT
            code = "VERSION_CONFLICT"
        else:
            http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
            code = "REPOSITORY_ERROR"
        body = ErrorDTO(code=code, message=str(exc)).model_dump(mode="json")
        return JSONResponse(status_code=http_status, content=body)

    @app.exception_handler(SigningError)
    async def signing_error_handler(request: Request, exc: SigningError) -> JSONResponse:
        body = ErrorDTO(code=str(exc), message="Signing challenge failed").model_dump(mode="json")
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=body)
