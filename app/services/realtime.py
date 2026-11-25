"""Multi-tenant real-time event broker supporting in-process SSE fan-out and PostgreSQL LISTEN/NOTIFY."""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
from typing import Any, AsyncIterator
import uuid

from app.core.config import settings
from app.core.db import is_test_env
from app.core.logging import get_logger

logger = get_logger(__name__)

PG_CHANNEL = "selloi_realtime"
_MAX_QUEUE_SIZE = 200
_MAX_DEDUPE_IDS = 512
_MAX_NOTIFY_BYTES = 7500


def _to_asyncpg_dsn(database_url: str) -> str:
    if database_url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + database_url[len("postgresql+asyncpg://"):]
    return database_url


def _is_postgres_enabled() -> bool:
    return (
        not is_test_env
        and settings.database_url.strip().lower().startswith("postgresql")
    )


def format_sse(
    event_type: str,
    data: dict[str, Any],
    event_id: str | None = None,
) -> str:
    """Format a payload dict into a valid Server-Sent Events frame."""
    lines: list[str] = []
    if event_id:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event_type}")
    lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
    return "\n".join(lines) + "\n\n"


def _sanitize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Keep SSE event payloads compact so PostgreSQL NOTIFY never exceeds 8KB."""
    cleaned: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str) and len(value) > 400:
            cleaned[key] = value[:397] + "..."
        else:
            cleaned[key] = value
    return cleaned


class RealtimeHub:
    """Tenant-isolated async pub/sub hub with optional PostgreSQL LISTEN/NOTIFY bridge."""

    def __init__(self) -> None:
        self._subscribers: dict[int, set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]]] = {}
        self._seen_event_ids: OrderedDict[str, None] = OrderedDict()
        self._listener_task: asyncio.Task[None] | None = None
        self._listener_conn: Any = None
        self._pub_conn: Any = None
        self._pub_lock: asyncio.Lock | None = None
        self._running = False

    def _remember_event(self, event_id: str) -> bool:
        """Return True if event_id was not seen recently, False if duplicate."""
        if not event_id:
            return True
        if event_id in self._seen_event_ids:
            return False
        self._seen_event_ids[event_id] = None
        while len(self._seen_event_ids) > _MAX_DEDUPE_IDS:
            self._seen_event_ids.popitem(last=False)
        return True

    def subscriber_count(self, organization_id: int) -> int:
        return len(self._subscribers.get(int(organization_id), set()))

    @asynccontextmanager
    async def subscribe(self, organization_id: int) -> AsyncIterator[asyncio.Queue[dict[str, Any]]]:
        """Subscribe to real-time events strictly scoped to organization_id."""
        org_id = int(organization_id)
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=_MAX_QUEUE_SIZE)
        entry = (loop, queue)
        self._subscribers.setdefault(org_id, set()).add(entry)
        try:
            yield queue
        finally:
            bucket = self._subscribers.get(org_id)
            if bucket is not None:
                bucket.discard(entry)
                if not bucket:
                    self._subscribers.pop(org_id, None)

    def _enqueue_for_subscriber(
        self,
        sub_loop: asyncio.AbstractEventLoop,
        queue: asyncio.Queue[dict[str, Any]],
        event: dict[str, Any],
    ) -> None:
        def _push() -> None:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

        try:
            curr_loop = asyncio.get_running_loop()
        except RuntimeError:
            curr_loop = None

        if sub_loop.is_closed():
            return
        if sub_loop is curr_loop:
            _push()
        else:
            sub_loop.call_soon_threadsafe(_push)

    def _dispatch_local(self, event: dict[str, Any]) -> None:
        org_id = event.get("organization_id")
        if not isinstance(org_id, int) or org_id <= 0:
            return
        event_id = str(event.get("id") or "")
        if event_id and not self._remember_event(event_id):
            return

        subs = list(self._subscribers.get(org_id, ()))
        if not subs:
            return

        stale: list[tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]] = []
        for sub_loop, queue in subs:
            if sub_loop.is_closed():
                stale.append((sub_loop, queue))
                continue
            self._enqueue_for_subscriber(sub_loop, queue, event)

        if stale:
            bucket = self._subscribers.get(org_id)
            if bucket is not None:
                for entry in stale:
                    bucket.discard(entry)
                if not bucket:
                    self._subscribers.pop(org_id, None)

    async def _pg_notify(self, encoded_event: str) -> None:
        if not _is_postgres_enabled():
            return
        if len(encoded_event.encode("utf-8")) > _MAX_NOTIFY_BYTES:
            return
        try:
            import asyncpg
        except ImportError:
            return

        if self._pub_lock is None:
            self._pub_lock = asyncio.Lock()

        async with self._pub_lock:
            try:
                if self._pub_conn is None or self._pub_conn.is_closed():
                    self._pub_conn = await asyncpg.connect(_to_asyncpg_dsn(settings.database_url), timeout=3.0)
                await self._pub_conn.execute("SELECT pg_notify($1, $2)", PG_CHANNEL, encoded_event)
            except Exception as exc:
                logger.debug("RealtimeHub pg_notify fallback (%s)", exc)
                if self._pub_conn is not None:
                    try:
                        await self._pub_conn.close()
                    except Exception:
                        pass
                    self._pub_conn = None

    def _on_pg_notification(self, _conn: Any, _pid: int, _channel: str, payload: str) -> None:
        try:
            event = json.loads(payload)
            if isinstance(event, dict):
                self._dispatch_local(event)
        except Exception:
            logger.debug("Ignoring malformed realtime pg_notify payload")

    async def _listener_loop(self) -> None:
        import asyncpg

        backoff = 2.0
        while self._running:
            conn = None
            try:
                conn = await asyncpg.connect(_to_asyncpg_dsn(settings.database_url), timeout=5.0)
                self._listener_conn = conn
                await conn.add_listener(PG_CHANNEL, self._on_pg_notification)
                logger.info("RealtimeHub PostgreSQL LISTEN connected on channel '%s'", PG_CHANNEL)
                backoff = 2.0
                while self._running and not conn.is_closed():
                    await asyncio.sleep(25.0)
                    await conn.execute("SELECT 1")
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("RealtimeHub PostgreSQL LISTEN disconnected (%s); reconnecting in %.0fs", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2.0, 20.0)
            finally:
                self._listener_conn = None
                if conn is not None:
                    try:
                        if not conn.is_closed():
                            await conn.remove_listener(PG_CHANNEL, self._on_pg_notification)
                            await conn.close()
                    except Exception:
                        pass

    async def start(self) -> None:
        """Start background PostgreSQL LISTEN loop when running against PostgreSQL."""
        if self._running or not _is_postgres_enabled():
            return
        self._running = True
        self._listener_task = asyncio.create_task(self._listener_loop(), name="realtime_pg_listener")

    async def stop(self) -> None:
        """Stop PostgreSQL listener and close dedicated connections cleanly."""
        self._running = False
        if self._listener_task is not None:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None
        if self._pub_conn is not None:
            try:
                await self._pub_conn.close()
            except Exception:
                pass
            self._pub_conn = None
        self._pub_lock = None
        self._seen_event_ids.clear()

    async def publish(
        self,
        organization_id: int | None,
        event_type: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """Publish an organization-scoped real-time event cleanly without raising on transient errors."""
        if not organization_id:
            return
        try:
            org_id = int(organization_id)
        except (TypeError, ValueError):
            return
        if org_id <= 0 or not event_type:
            return

        event_id = uuid.uuid4().hex
        event: dict[str, Any] = {
            "id": event_id,
            "type": event_type,
            "organization_id": org_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            **_sanitize_payload(payload or {}),
        }

        try:
            self._dispatch_local(event)
            if _is_postgres_enabled():
                encoded = json.dumps(event, ensure_ascii=False)
                await self._pg_notify(encoded)
        except Exception as exc:
            logger.debug("RealtimeHub publish skipped (%s)", exc)


realtime_hub = RealtimeHub()


async def publish_event(
    organization_id: int | None,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Publish a tenant-scoped SSE event safely (never interrupts callers)."""
    await realtime_hub.publish(organization_id, event_type, payload)
