"""Ошибки домена.

`code` — стабильный машинный код (Dev 2 отображает его в HTTP):
`TransitionError` → 409 `INVALID_TRANSITION` / `REASON_REQUIRED`,
`PolicyViolation` → 422 `AMOUNT_OUT_OF_RANGE` / `TERM_OUT_OF_RANGE` / `UNKNOWN_PRODUCT`.
"""

from collections.abc import Mapping


class DomainError(Exception):
    """Базовая ошибка домена: код, сообщение, детали для трассировки."""

    code: str
    message: str
    details: Mapping[str, str]

    def __init__(self, code: str, message: str, details: Mapping[str, str] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = dict(details) if details is not None else {}


class TransitionError(DomainError):
    """Недопустимый переход статуса заявки (Dev 2 → HTTP 409)."""


class PolicyViolation(DomainError):
    """Нарушение ограничений политики запроса (Dev 2 → HTTP 422)."""
