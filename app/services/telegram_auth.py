import secrets
import time
from typing import Any
from app.core.logging import get_logger
from app.services.telegram import telegram

logger = get_logger(__name__)

# In-memory storage for pending Telegram authentication sessions
# code -> { status: "pending" | "verified", created_at: float, user_data?: dict }
_AUTH_SESSIONS: dict[str, dict[str, Any]] = {}
_CACHED_BOT_USERNAME: str | None = None
SESSION_TTL_SECONDS = 600  # 10 minutes


def _prune_expired() -> None:
    now = time.time()
    expired = [k for k, v in _AUTH_SESSIONS.items() if now - v["created_at"] > SESSION_TTL_SECONDS]
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
    return "musiqa_2_ro_bot"


async def create_auth_session() -> dict[str, str]:
    """Create a new pending Telegram authentication session."""
    _prune_expired()
    code = secrets.token_urlsafe(16).replace("-", "").replace("_", "")[:16]
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
    session = _AUTH_SESSIONS.get(code)
    if not session:
        return False
    session["status"] = "verified"
    session["user_data"] = {
        "telegram_id": telegram_id,
        "username": (username or "").strip().lstrip("@"),
        "full_name": full_name.strip() or f"Telegram User {telegram_id}",
    }
    logger.info("Telegram auth session %s verified for telegram_id=%s (@%s)", code, telegram_id, username)
    return True


def check_auth_session(code: str) -> dict[str, Any] | None:
    """Check status of an auth session without consuming it."""
    _prune_expired()
    session = _AUTH_SESSIONS.get(code)
    if not session:
        return None
    return {
        "status": session["status"],
        "user_data": session.get("user_data"),
    }


def consume_auth_session(code: str) -> dict[str, Any] | None:
    """Consume and delete a verified auth session."""
    _prune_expired()
    session = _AUTH_SESSIONS.pop(code, None)
    if not session:
        return None
    if session["status"] != "verified":
        return None
    return session.get("user_data")
