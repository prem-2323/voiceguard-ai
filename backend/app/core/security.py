import base64
import binascii
import hashlib
import hmac
import secrets
from datetime import timedelta

from jose import JWTError, jwt

from app.core.config import settings
from app.core.time import utc_now

_HASH_SCHEME = "pbkdf2_sha256"
_HASH_ROUNDS = 310_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _HASH_ROUNDS)
    return f"{_HASH_SCHEME}${_HASH_ROUNDS}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, rounds, salt_text, digest_text = encoded.split("$", maxsplit=3)
        if scheme != _HASH_SCHEME:
            return False
        iteration_count = int(rounds)
        if iteration_count < 100_000 or iteration_count > 1_000_000:
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        if len(salt) != 16 or len(expected) != hashlib.sha256().digest_size:
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iteration_count)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, binascii.Error):
        return False


def create_access_token(*, user_id: int, role: str) -> str:
    expires = utc_now() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": expires}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, object] | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
