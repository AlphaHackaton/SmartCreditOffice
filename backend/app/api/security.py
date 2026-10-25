"""JWT and password primitives shared by API authentication adapters."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
import jwt

from app.api.schemas import UserRole

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(hours=8)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: UUID, role: UserRole, secret: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "iat": now,
        "exp": now + TOKEN_TTL,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_access_token(token: str, secret: str) -> tuple[UUID, UserRole]:
    payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
    user_id = UUID(str(payload["sub"]))
    return user_id, UserRole(str(payload["role"]))
