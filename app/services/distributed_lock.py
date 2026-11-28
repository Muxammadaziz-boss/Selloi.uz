"""Distributed coordination locks backed by Redis with thread-safe in-memory fallback.

Designed for multi-worker FastAPI/Uvicorn deployments so periodic background tasks
and stateful bot polling supervisors execute on at most one worker per lease window,
while falling back safely to process-local synchronization when Redis is unavailable.
"""

from __future__ import annotations

import os
import socket
import threading
import time
import uuid
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

WORKER_INSTANCE_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"

_MEM_LOCK = threading.Lock()
_MEM_LEASES: dict[str, tuple[str, float]] = {}

_ACQUIRE_OR_RENEW_LUA = """
local current = redis.call('GET', KEYS[1])
if (not current) or (current == ARGV[1]) then
    redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
    return 1
end
return 0
"""

_RELEASE_IF_OWNER_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
"""


def _resolve_redis(redis_client: Any = None) -> Any:
    """Return explicitly provided Redis client or shared client from rate_limit module."""
    if redis_client is not None:
        return redis_client
    try:
        from app.core.rate_limit import limiter

        return limiter._get_redis()
    except Exception:
        return None


def _mem_try_acquire(key: str, owner_id: str, ttl: int, renew: bool) -> bool:
    now = time.monotonic()
    with _MEM_LOCK:
        # Opportunistic cleanup of expired local leases
        expired = [k for k, (_owner, exp) in _MEM_LEASES.items() if exp <= now]
        for k in expired:
            _MEM_LEASES.pop(k, None)

        current = _MEM_LEASES.get(key)
        if current is None:
            _MEM_LEASES[key] = (owner_id, now + ttl)
            return True
        holder, _exp = current
        if renew and holder == owner_id:
            _MEM_LEASES[key] = (owner_id, now + ttl)
            return True
        return False


def _mem_release(key: str, owner_id: str) -> bool:
    with _MEM_LOCK:
        current = _MEM_LEASES.get(key)
        if current is not None and current[0] == owner_id:
            _MEM_LEASES.pop(key, None)
            return True
        return False


def try_acquire_lock(
    lock_name: str,
    ttl_seconds: int = 300,
    owner_id: str | None = None,
    *,
    renew: bool = False,
    redis_client: Any = None,
) -> tuple[bool, str]:
    """Attempt to acquire (or renew if ``renew=True``) a named distributed lock.

    Returns ``(acquired, owner_token)``.
    """
    ttl = max(1, int(ttl_seconds))
    owner = owner_id or WORKER_INSTANCE_ID
    redis_key = f"selloi:lock:{lock_name}"
    client = _resolve_redis(redis_client)

    if client is not None:
        try:
            if renew:
                if hasattr(client, "eval"):
                    res = client.eval(_ACQUIRE_OR_RENEW_LUA, 1, redis_key, owner, str(ttl))
                    return bool(int(res)), owner
                # Fallback for simplified Redis fakes without Lua eval support
                current = client.get(redis_key)
                if current is None or current == owner:
                    if current == owner:
                        client.set(redis_key, owner, ex=ttl)
                        return True, owner
                    acquired = client.set(redis_key, owner, nx=True, ex=ttl)
                    return bool(acquired), owner
                return False, owner

            acquired = client.set(redis_key, owner, nx=True, ex=ttl)
            return bool(acquired), owner
        except Exception as exc:
            logger.debug("Redis lock fallback triggered for %s (%s)", lock_name, exc)

    return _mem_try_acquire(redis_key, owner, ttl, renew), owner


def release_lock(
    lock_name: str,
    owner_id: str | None = None,
    *,
    redis_client: Any = None,
) -> bool:
    """Release ``lock_name`` only if currently held by ``owner_id``."""
    owner = owner_id or WORKER_INSTANCE_ID
    redis_key = f"selloi:lock:{lock_name}"
    client = _resolve_redis(redis_client)

    if client is not None:
        try:
            if hasattr(client, "eval"):
                res = client.eval(_RELEASE_IF_OWNER_LUA, 1, redis_key, owner)
                return bool(int(res))
            current = client.get(redis_key)
            if current == owner:
                client.delete(redis_key)
                return True
            return False
        except Exception as exc:
            logger.debug("Redis unlock fallback triggered for %s (%s)", lock_name, exc)

    return _mem_release(redis_key, owner)
