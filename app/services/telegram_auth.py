import json
import secrets
import time
from typing import Any
from app.core.logging import get_logger
from app.services.telegram import telegram

logger = get_logger(__name__)

# In-process cache/fallback for Telegram auth & link sessions:
# code -> { status: "pending" | "verified" | "consumed", purpose: "login" | "link", user_id: int | None, created_at: float, user_data?: dict, consumed_at?: float }
_AUTH_SESSIONS: dict[str, dict[str, Any]] = {}
_CACHED_BOT_USERNAME: str | None = None
SESSION_TTL_SECONDS = 600  # 10 minutes
_REDIS_KEY_PREFIX = "tg_auth_sess:"


def _get_redis_client():
    """Return shared sync Redis client when configured and reachable, else None."""
    try:
        from app.core.rate_limit import limiter
        return limiter._get_redis()
    except Exception:
        return None


def _normalize_code(code: str) -> str:
    """Normalize auth/link code by trimming, lowercasing, and stripping auth_/link_ prefix."""
    c = (code or "").strip().lower()
    for prefix in ("auth_", "auth-", "link_", "link-"):
        if c.startswith(prefix):
            c = c[len(prefix):].strip()
            break
    return c


def _is_expired(session: dict[str, Any], now: float | None = None) -> bool:
    ts = now if now is not None else time.time()
    if ts - float(session.get("created_at", 0) or 0) > SESSION_TTL_SECONDS:
        return True
    if session.get("status") == "consumed" and ts - float(session.get("consumed_at", 0) or 0) > 120:
        return True
    return False


def _save_session(normalized: str, session: dict[str, Any], ttl_seconds: int | None = None) -> None:
    _AUTH_SESSIONS[normalized] = session
    r = _get_redis_client()
    if r is None:
        return
    try:
        if ttl_seconds is None:
            elapsed = max(0, int(time.time() - float(session.get("created_at", time.time()) or time.time())))
            ttl = max(30, SESSION_TTL_SECONDS - elapsed)
        else:
            ttl = max(30, int(ttl_seconds))
        r.set(f"{_REDIS_KEY_PREFIX}{normalized}", json.dumps(session), ex=ttl)
    except Exception as exc:
        logger.debug("Redis set failed for telegram auth session: %s", exc)


def _load_session(normalized: str) -> dict[str, Any] | None:
    if not normalized:
        return None
    now = time.time()
    r = _get_redis_client()
    if r is not None:
        try:
            raw = r.get(f"{_REDIS_KEY_PREFIX}{normalized}")
            if raw:
                session = json.loads(raw)
                if _is_expired(session, now):
                    _delete_session(normalized)
                    return None
                _AUTH_SESSIONS[normalized] = session
                return session
        except Exception as exc:
            logger.debug("Redis get failed for telegram auth session: %s", exc)

    session = _AUTH_SESSIONS.get(normalized)
    if session and _is_expired(session, now):
        _AUTH_SESSIONS.pop(normalized, None)
        return None
    return session


def _delete_session(normalized: str) -> None:
    _AUTH_SESSIONS.pop(normalized, None)
    r = _get_redis_client()
    if r is not None:
        try:
            r.delete(f"{_REDIS_KEY_PREFIX}{normalized}")
        except Exception as exc:
            logger.debug("Redis delete failed for telegram auth session: %s", exc)


def _prune_expired() -> None:
    now = time.time()
    expired = [k for k, v in _AUTH_SESSIONS.items() if _is_expired(v, now)]
    for k in expired:
        _AUTH_SESSIONS.pop(k, None)


async def get_bot_username() -> str:
    global _CACHED_BOT_USERNAME
    if _CACHED_BOT_USERNAME:
        return _CACHED_BOT_USERNAME
    try:
        if telegram:
            me = await telegram.call("getMe", {})
            username = me.get("username")
            if username:
                _CACHED_BOT_USERNAME = username
                return username
    except Exception as e:
        logger.warning("Could not fetch bot username via getMe: %s", e)
    return "Selloi_ai_bot"


async def create_auth_session(purpose: str = "login", user_id: int | None = None) -> dict[str, Any]:
    """Create a new pending Telegram authentication or account-linking session."""
    _prune_expired()
    clean_purpose = "link" if purpose == "link" else "login"
    prefix = "link_" if clean_purpose == "link" else "auth_"
    # Lowercase hex eliminates URL escaping and case-sensitivity mismatches
    code = secrets.token_hex(16).lower()
    bot_username = await get_bot_username()
    session = {
        "status": "pending",
        "purpose": clean_purpose,
        "user_id": int(user_id) if user_id is not None else None,
        "created_at": time.time(),
        "user_data": None,
    }
    _save_session(code, session, ttl_seconds=SESSION_TTL_SECONDS)
    bot_url = f"https://t.me/{bot_username}?start={prefix}{code}"
    return {
        "code": code,
        "purpose": clean_purpose,
        "expires_in": SESSION_TTL_SECONDS,
        "bot_username": bot_username,
        "bot_url": bot_url,
    }


def verify_auth_session(
    code: str,
    telegram_id: int,
    username: str | None,
    full_name: str,
    expected_purpose: str | None = None,
) -> bool:
    """Mark an auth/link session as verified from Telegram bot /start."""
    _prune_expired()
    normalized = _normalize_code(code)
    session = _load_session(normalized)
    if not session:
        logger.warning(
            "Telegram auth session '%s' not found (active_count=%d)",
            normalized,
            len(_AUTH_SESSIONS),
        )
        return False

    session_purpose = session.get("purpose", "login")
    if expected_purpose is not None and session_purpose != expected_purpose:
        logger.warning(
            "Telegram session '%s' purpose mismatch: expected=%s actual=%s",
            normalized,
            expected_purpose,
            session_purpose,
        )
        return False

    session["status"] = "verified"
    session["verified_at"] = time.time()
    session["user_data"] = {
        "telegram_id": int(telegram_id),
        "username": (username or "").strip().lstrip("@"),
        "full_name": full_name.strip() or f"Telegram User {telegram_id}",
    }
    _save_session(normalized, session)
    logger.info(
        "Telegram %s session %s verified for telegram_id=%s (@%s)",
        session_purpose,
        normalized,
        telegram_id,
        username,
    )
    return True


def check_auth_session(code: str) -> dict[str, Any] | None:
    """Check status of an auth/link session without consuming it."""
    _prune_expired()
    normalized = _normalize_code(code)
    session = _load_session(normalized)
    if not session:
        return None

    status = session.get("status")
    return {
        "status": "verified" if status == "consumed" else status,
        "purpose": session.get("purpose", "login"),
        "user_id": session.get("user_id"),
        "user_data": session.get("user_data"),
    }


def consume_auth_session(
    code: str,
    expected_purpose: str | None = None,
    expected_user_id: int | None = None,
) -> dict[str, Any] | None:
    """Consume and finalize a verified auth/link session.

    Never deletes a pending session; transitions verified -> consumed with a 60s
    idempotent retry window for dropped HTTP responses.
    """
    _prune_expired()
    normalized = _normalize_code(code)
    session = _load_session(normalized)
    if not session:
        return None

    if expected_purpose is not None and session.get("purpose", "login") != expected_purpose:
        return None
    if expected_user_id is not None and session.get("user_id") != int(expected_user_id):
        return None

    status = session.get("status")
    now = time.time()

    if status == "verified":
        session["status"] = "consumed"
        session["consumed_at"] = now
        _save_session(normalized, session, ttl_seconds=90)
        return session.get("user_data")

    if status == "consumed":
        consumed_at = float(session.get("consumed_at", 0) or 0)
        if now - consumed_at <= 60:
            return session.get("user_data")
        _delete_session(normalized)
        return None

    return None
