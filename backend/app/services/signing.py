"""In-UI OTP signing service; no SMS or email integration."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID


class SigningError(Exception):
    """Signing challenge cannot be created or completed."""


class OtpSigner:
    def __init__(self, ttl: timedelta = timedelta(minutes=5), max_attempts: int = 3) -> None:
        self.ttl = ttl
        self.max_attempts = max_attempts
        self._challenges: dict[UUID, tuple[str, datetime, int]] = {}

    def create_challenge(self, application_id: UUID) -> tuple[str, datetime]:
        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = datetime.now(UTC) + self.ttl
        self._challenges[application_id] = (self._hash(code), expires_at, 0)
        return code, expires_at

    def verify(self, application_id: UUID, code: str) -> None:
        challenge = self._challenges.get(application_id)
        if challenge is None:
            raise SigningError("SIGNING_CHALLENGE_NOT_FOUND")
        code_hash, expires_at, attempts = challenge
        if datetime.now(UTC) >= expires_at:
            raise SigningError("SIGNING_CHALLENGE_EXPIRED")
        if attempts >= self.max_attempts:
            raise SigningError("SIGNING_ATTEMPTS_EXCEEDED")
        if not secrets.compare_digest(code_hash, self._hash(code)):
            self._challenges[application_id] = (code_hash, expires_at, attempts + 1)
            raise SigningError("INVALID_OTP")
        del self._challenges[application_id]

    @staticmethod
    def _hash(code: str) -> str:
        return hashlib.sha256(code.encode()).hexdigest()
