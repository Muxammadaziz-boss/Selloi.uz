import secrets
import time
from typing import Any
from app.core.logging import get_logger
from app.services.telegram import telegram

logger = get_logger(__name__)

# Storage for pending Telegram authentication sessions
# code -> { status: "pending" | "verified" | "consumed", created_at: float, user_data?: dict, consumed_at?: float }
_AUTH_SESSIONS: dict[str, dict[str, Any]] = {}
_CACHED_BOT_USERNAME: str | None = None
SESSION_TTL_SECONDS = 600  # 10 minutes


def _normalize_code(code: str) -> str:
    """Normalize auth code by trimming, lowercasing, and stripping any auth_ prefix."""
    c = (code or "").strip().lower()
    if c.startswith("auth_"):
        c = c[5:].strip()
    elif c.startswith("auth-"):
        c = c[5:].strip()
    return c


def _prune_expired() -> None:
    now = time.time()
    expired = [
        k for k, v in _AUTH_SESSIONS.items()
        if (now - v.get("created_at", 0) > SESSION_TTL_SECONDS)
        or (v.get("status") == "consumed" and now - v.get("consumed_at", 0) > 120)
    ]
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


async def create_auth_session() -> dict[str, str]:
    """Create a new pending Telegram authentication session."""
    _prune_expired()
    # Use lowercase hex to eliminate URL escaping and case-sensitivity mismatches
    code = secrets.token_hex(16).lower()
    bot_username = await get_bot_username()
    _AUTH_SESSIONS[code] = {
        "status": "pending",
        "created_at": time.time(),
        "user_data": None,
    }
    bot_url = f"https://t.me/{bot_username}?start=auth_{code}"
    return {
        "code": code,
        "bot_username": bot_username,
        "bot_url": bot_url,
    }


def verify_auth_session(code: str, telegram_id: int, username: str | None, full_name: str) -> bool:
    """Mark an auth session as verified from Telegram bot /start."""
    _prune_expired()
    normalized = _normalize_code(code)
    session = _AUTH_SESSIONS.get(normalized)
    if not session:
        logger.warning(
            "Telegram auth session '%s' not found (active_count=%d)",
            normalized,
            len(_AUTH_SESSIONS),
        )
        return False

    session["status"] = "verified"
    session["verified_at"] = time.time()
    session["user_data"] = {
        "telegram_id": int(telegram_id),
        "username": (username or "").strip().lstrip("@"),
        "full_name": full_name.strip() or f"Telegram User {telegram_id}",
    }
    logger.info("Telegram auth session %s verified for telegram_id=%s (@%s)", normalized, telegram_id, username)
    return True


def check_auth_session(code: str) -> dict[str, Any] | None:
    """Check status of an auth session without consuming it."""
    _prune_expired()
    normalized = _normalize_code(code)
    session = _AUTH_SESSIONS.get(normalized)
    if not session:
        return None

    status = session.get("status")
    return {
        "status": "verified" if status == "consumed" else status,
        "user_data": session.get("user_data"),
    }


def consume_auth_session(code: str) -> dict[str, Any] | None:
    """Consume and finalize a verified auth session.

    CRITICAL FIX: Never deletes or pops a session that is still 'pending'.
    Only transitions 'verified' sessions to 'consumed' with a 60-second
    idempotent window for network retries.
    """
    _prune_expired()
    normalized = _normalize_code(code)
    session = _AUTH_SESSIONS.get(normalized)
    if not session:
        return None

    status = session.get("status")
    now = time.time()

    if status == "verified":
        session["status"] = "consumed"
        session["consumed_at"] = now
        return session.get("user_data")

    if status == "consumed":
        # Allow retry window for client in case HTTP response was dropped
        consumed_at = session.get("consumed_at", 0)
        if now - consumed_at <= 60:
            return session.get("user_data")
        _AUTH_SESSIONS.pop(normalized, None)
        return None

    # If pending, DO NOT DELETE. Return None so caller knows it's not ready yet.
    return None
