"""Deduplicated critical Telegram alerts to Platform Owner (ADMIN_TELEGRAM_ID)."""

import asyncio
import hashlib
import os
import re
import threading
import time
import httpx

from app.core.cache import BoundedTTLCache
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_ALERT_COOLDOWN_MEM: BoundedTTLCache[str, float] = BoundedTTLCache(maxsize=1000)
_ALERT_LOCK = threading.Lock()


def _sanitize_alert_text(raw: str) -> str:
    """Strip query API keys, bot tokens, and authorization secrets before sending alerts."""
    text = str(raw or "")
    text = re.sub(r"([?&](?:key|api_key|token|secret)=)[^&\s]+", r"\1***", text, flags=re.IGNORECASE)
    text = re.sub(r"\bbot\d+:[A-Za-z0-9_-]{15,}", "bot***", text)
    text = re.sub(r"\bBearer\s+[A-Za-z0-9._-]{12,}", "Bearer ***", text, flags=re.IGNORECASE)
    return text.strip()[:2800]


def _should_send_alert(fingerprint: str, cooldown_seconds: int) -> bool:
    """Enforce per-fingerprint alert cooldown via Redis with in-memory fallback."""
    if cooldown_seconds <= 0:
        return True

    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:24]
    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            # SET NX EX atomically acquires alert slot for cooldown_seconds across all workers
            acquired = r.set(f"alert_cd:{digest}", "1", ex=int(cooldown_seconds), nx=True)
            return bool(acquired)
    except Exception:
        pass

    now = time.time()
    with _ALERT_LOCK:
        # Prune expired entries occasionally
        expired = [k for k, exp in _ALERT_COOLDOWN_MEM.items() if exp <= now]
        for k in expired:
            _ALERT_COOLDOWN_MEM.pop(k, None)
        if _ALERT_COOLDOWN_MEM.get(digest, 0.0) > now:
            return False
        _ALERT_COOLDOWN_MEM.set(digest, now + cooldown_seconds, ttl_seconds=cooldown_seconds)
        return True


def _is_test_context() -> bool:
    return bool(
        settings.is_testing
        or os.environ.get("TESTING") == "true"
        or os.environ.get("PYTEST_CURRENT_TEST")
    )


async def send_owner_alert(
    title: str,
    detail: str,
    *,
    fingerprint: str | None = None,
    cooldown_seconds: int = 300,
    ignore_test_env: bool = False,
) -> bool:
    """Send a deduplicated critical operational alert to ADMIN_TELEGRAM_ID."""
    if not ignore_test_env and _is_test_context():
        return False

    bot_token = (settings.telegram_bot_token or "").strip()
    admin_id = int(getattr(settings, "admin_telegram_id", 0) or 0)
    if not bot_token or admin_id <= 0:
        return False

    fp = fingerprint or f"{title}:{detail[:80]}"
    if not _should_send_alert(fp, cooldown_seconds):
        return False

    clean_title = _sanitize_alert_text(title)
    clean_detail = _sanitize_alert_text(detail)
    message = (
        f"[SELLOI ALERT - {settings.app_env.upper()}]\n"
        f"{clean_title}\n\n"
        f"{clean_detail}"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": admin_id, "text": message},
            )
            return resp.status_code == 200
    except Exception as exc:
        logger.debug("Owner alert delivery failed: %s", exc)
        return False


def schedule_owner_alert(
    title: str,
    detail: str,
    *,
    fingerprint: str | None = None,
    cooldown_seconds: int = 300,
) -> None:
    """Fire-and-forget async alert scheduler safe inside FastAPI async handlers."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            send_owner_alert(
                title,
                detail,
                fingerprint=fingerprint,
                cooldown_seconds=cooldown_seconds,
            )
        )
    except RuntimeError:
        pass
