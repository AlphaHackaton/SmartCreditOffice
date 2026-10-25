from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.services.signing import OtpSigner, SigningError


def test_otp_is_valid_once_and_cannot_be_replayed() -> None:
    application_id = uuid4()
    signer = OtpSigner()
    code, expires_at = signer.create_challenge(application_id)

    assert expires_at > datetime.now(UTC)
    signer.verify(application_id, code)
    with pytest.raises(SigningError, match="NOT_FOUND"):
        signer.verify(application_id, code)


def test_otp_limits_invalid_attempts() -> None:
    application_id = uuid4()
    signer = OtpSigner(max_attempts=2)
    signer.create_challenge(application_id)

    for _ in range(2):
        with pytest.raises(SigningError, match="INVALID_OTP"):
            signer.verify(application_id, "000000")
    with pytest.raises(SigningError, match="EXCEEDED"):
        signer.verify(application_id, "000000")


def test_otp_expiration_is_enforced() -> None:
    application_id = uuid4()
    signer = OtpSigner(ttl=timedelta(seconds=-1))
    code, _ = signer.create_challenge(application_id)

    with pytest.raises(SigningError, match="EXPIRED"):
        signer.verify(application_id, code)
