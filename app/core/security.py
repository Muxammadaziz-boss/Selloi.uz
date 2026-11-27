"""Security, hashing, cryptography and rate limiting utilities."""

import hashlib
import threading
import time
from collections import defaultdict
from cryptography.fernet import Fernet, InvalidToken
import bcrypt

from app.core.config import settings


# In-memory rate limiting tracker: key -> list of timestamp floats
_rate_limits: dict[str, list[float]] = defaultdict(list)


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with 12 rounds."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash, with backward-compatible sha256 fallback."""
    if not hashed_password or not password:
        return False
    
    pwd_bytes = password.encode("utf-8")
    hash_bytes = hashed_password.encode("utf-8")

    # Standard bcrypt format check
    if hashed_password.startswith(("$2b$", "$2a$", "$2y$")):
        try:
            return bcrypt.checkpw(pwd_bytes, hash_bytes)
        except Exception:
            return False

    # Backward compatibility: legacy SHA-256 hash (64 hex characters)
    if len(hashed_password) == 64 and all(c in "0123456789abcdefABCDEF" for c in hashed_password):
        legacy_hash = hashlib.sha256(pwd_bytes).hexdigest()
        return legacy_hash.lower() == hashed_password.lower()

    return False


def get_fernet() -> Fernet:
    """Return a Fernet cipher instance configured with settings.encryption_key."""
    key = settings.encryption_key
    if not key:
        key = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as e:
        raise ValueError(f"Invalid ENCRYPTION_KEY configured: {e}")


def encrypt_secret(plaintext: str | None) -> str:
    """Encrypt a secret string using Fernet. Returns empty string if plaintext is empty."""
    if not plaintext:
        return ""
    cipher = get_fernet()
    return cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str | None) -> str:
    """Decrypt a Fernet encrypted string. If plaintext or unencrypted, returns as-is."""
    if not ciphertext:
        return ""
    # Standard Fernet tokens begin with 'gAAAAA'
    if ciphertext.startswith("gAAAAA"):
        cipher = get_fernet()
        try:
            return cipher.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            # If decryption fails (e.g. key changed), return empty or raw string
            return ciphertext
        except Exception:
            return ciphertext
    return ciphertext


def mask_secret(secret: str | None) -> str:
    """Mask a secret for safe exposure in API responses (e.g. 'sk-1...9xyz')."""
    if not secret:
        return ""
    decrypted = decrypt_secret(secret)
    if len(decrypted) <= 8:
        return "********"
    return f"{decrypted[:4]}...{decrypted[-4:]}"


def is_rate_limited(key: str, max_attempts: int = 5, window_seconds: int = 60) -> bool:
    """Check if the given key has exceeded max_attempts within window_seconds."""
    now = time.time()
    cutoff = now - window_seconds
    timestamps = [t for t in _rate_limits[key] if t > cutoff]
    _rate_limits[key] = timestamps
    return len(timestamps) >= max_attempts


def get_rate_limit_retry_after(key: str, max_attempts: int = 5, window_seconds: int = 60) -> int:
    """Return remaining seconds until a rate-limited key frees a slot, or 0 if not limited."""
    now = time.time()
    cutoff = now - window_seconds
    timestamps = [t for t in _rate_limits[key] if t > cutoff]
    _rate_limits[key] = timestamps
    if len(timestamps) < max_attempts:
        return 0
    remaining = (min(timestamps) + window_seconds) - now
    whole = int(remaining)
    return max(1, whole + (1 if remaining > whole else 0))


def record_attempt(key: str) -> None:
    """Record an authentication or sensitive operation attempt."""
    _rate_limits[key].append(time.time())


def reset_rate_limit(key: str) -> None:
    """Reset the rate limit tracker for a key upon successful authentication."""
    if key in _rate_limits:
        del _rate_limits[key]


# ---------------------------------------------------------------------------
# Token & Session Revocation Registry (In-memory + Redis)
# ---------------------------------------------------------------------------

_revoked_tokens: dict[str, float] = {}
_revoked_users: dict[int, float] = {}
_revocation_lock = threading.Lock()


def revoke_token(jti_or_token: str, ttl_seconds: int = 86400) -> None:
    """Revoke a JWT token by jti or token signature."""
    now = time.time()
    expires_at = now + ttl_seconds
    with _revocation_lock:
        # Prune expired tokens
        expired = [k for k, exp in _revoked_tokens.items() if exp < now]
        for k in expired:
            _revoked_tokens.pop(k, None)
        _revoked_tokens[jti_or_token] = expires_at

    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            r.setex(f"revoked_token:{jti_or_token}", ttl_seconds, "1")
    except Exception:
        pass


def is_token_revoked(jti_or_token: str) -> bool:
    """Return True if the token or jti is in the revocation blacklist."""
    now = time.time()
    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            if r.exists(f"revoked_token:{jti_or_token}"):
                return True
    except Exception:
        pass

    with _revocation_lock:
        exp = _revoked_tokens.get(jti_or_token)
        if exp is not None:
            if exp > now:
                return True
            _revoked_tokens.pop(jti_or_token, None)
    return False


def revoke_user_sessions(user_id: int) -> None:
    """Revoke all active sessions for a specific user (e.g. on password change)."""
    now = time.time()
    with _revocation_lock:
        _revoked_users[user_id] = now

    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            r.setex(f"user_revoked:{user_id}", 86400 * 7, str(now))
    except Exception:
        pass


def is_user_session_revoked(user_id: int, issued_at: int | None) -> bool:
    """Return True if the user's sessions were revoked after this token was issued."""
    if issued_at is None:
        return False

    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            rev_time_str = r.get(f"user_revoked:{user_id}")
            if rev_time_str and float(rev_time_str) > issued_at:
                return True
    except Exception:
        pass

    with _revocation_lock:
        rev_time = _revoked_users.get(user_id)
        if rev_time is not None and rev_time > issued_at:
            return True
    return False

