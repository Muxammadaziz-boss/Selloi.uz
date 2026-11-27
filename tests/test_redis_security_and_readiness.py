"""Tests for Redis-backed auth rate limits, /health/ready probe, and Owner Telegram alerting."""

import time
from unittest.mock import AsyncMock, patch
import httpx
import pytest

from app.core import security
from app.core.config import settings
from app.main import app
from app.services import alert_service


class _FakeSortedSetRedis:
    """Minimal Redis Sorted Set + KV mock to verify cross-worker persistence."""

    def __init__(self):
        self.zsets: dict[str, dict[str, float]] = {}
        self.kv: dict[str, str] = {}

    def ping(self):
        return True

    def delete(self, key: str):
        self.zsets.pop(key, None)
        self.kv.pop(key, None)
        return 1

    def set(self, key: str, value: str, ex: int | None = None, nx: bool = False):
        if nx and key in self.kv:
            return False
        self.kv[key] = value
        return True

    def pipeline(self, transaction: bool = True):
        return _FakePipeline(self)


class _FakePipeline:
    def __init__(self, store: _FakeSortedSetRedis):
        self.store = store
        self.ops: list = []

    def zadd(self, key: str, mapping: dict[str, float]):
        def _op():
            z = self.store.zsets.setdefault(key, {})
            z.update(mapping)
            return len(mapping)
        self.ops.append(_op)
        return self

    def expire(self, key: str, ttl: int):
        self.ops.append(lambda: True)
        return self

    def zremrangebyscore(self, key: str, min_s, max_s):
        cutoff = float(max_s)
        def _op():
            z = self.store.zsets.get(key, {})
            removed = [m for m, sc in z.items() if sc <= cutoff]
            for m in removed:
                z.pop(m, None)
            return len(removed)
        self.ops.append(_op)
        return self

    def zrange(self, key: str, start: int, end: int, withscores: bool = False):
        def _op():
            z = self.store.zsets.get(key, {})
            items = sorted(z.items(), key=lambda x: x[1])
            return items if withscores else [m for m, _s in items]
        self.ops.append(_op)
        return self

    def execute(self):
        return [op() for op in self.ops]


def test_auth_rate_limits_persist_across_workers_via_redis(monkeypatch):
    fake_redis = _FakeSortedSetRedis()
    monkeypatch.setattr(security, "_get_redis_safe", lambda: fake_redis)
    security._rate_limits.clear()

    key = "login:crossworker@example.uz"
    security.reset_rate_limit(key)
    assert security.is_rate_limited(key, max_attempts=3, window_seconds=60) is False

    for _ in range(3):
        security.record_attempt(key)

    # Clear process-local RAM to simulate a completely separate Uvicorn worker
    security._rate_limits.clear()
    assert security.is_rate_limited(key, max_attempts=3, window_seconds=60) is True
    assert security.get_rate_limit_retry_after(key, max_attempts=3, window_seconds=60) >= 1

    security.reset_rate_limit(key)
    assert security.is_rate_limited(key, max_attempts=3, window_seconds=60) is False


@pytest.mark.asyncio
async def test_health_ready_checks_database_and_redis(monkeypatch):
    fake_redis = _FakeSortedSetRedis()
    from app.core.rate_limit import limiter
    monkeypatch.setattr(limiter, "_get_redis", lambda: fake_redis)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health/ready")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["checks"]["database"] == "ok"
        assert body["checks"]["redis"] == "ok"

        # When Redis fails in production mode, readiness reports 503 degraded
        monkeypatch.setattr(settings, "app_env", "production")
        monkeypatch.setattr(limiter, "_get_redis", lambda: None)
        res_deg = await client.get("/health/ready")
        assert res_deg.status_code == 503
        assert res_deg.json()["status"] == "degraded"
        assert res_deg.json()["checks"]["redis"] == "unavailable"


@pytest.mark.asyncio
async def test_owner_alert_redacts_secrets_and_deduplicates(monkeypatch):
    sent_payloads: list[dict] = []

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url: str, json: dict):
            sent_payloads.append({"url": url, "json": json})
            return httpx.Response(200, json={"ok": True})

    alert_service._ALERT_COOLDOWN_MEM.clear()
    monkeypatch.setattr(settings, "telegram_bot_token", "123456:FakeBotTokenSecretXYZ")
    monkeypatch.setattr(settings, "admin_telegram_id", 777000111)
    monkeypatch.setattr(alert_service.httpx, "AsyncClient", _FakeAsyncClient)

    ok1 = await alert_service.send_owner_alert(
        "Gemini Xato",
        "Request failed at https://api.example.com?key=AIzaSySecret12345 with Bearer SuperSecretJWT9999",
        fingerprint="test:dedup:fp",
        cooldown_seconds=300,
        ignore_test_env=True,
    )
    ok2 = await alert_service.send_owner_alert(
        "Gemini Xato",
        "Duplicate flood attempt",
        fingerprint="test:dedup:fp",
        cooldown_seconds=300,
        ignore_test_env=True,
    )

    assert ok1 is True
    assert ok2 is False  # suppressed within 300s cooldown
    assert len(sent_payloads) == 1
    msg = sent_payloads[0]["json"]["text"]
    assert "AIzaSySecret12345" not in msg
    assert "SuperSecretJWT9999" not in msg
    assert "key=***" in msg
    assert "Bearer ***" in msg
