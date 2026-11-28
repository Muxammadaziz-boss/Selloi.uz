"""Tests for Plan 3: Bounded LRU+TTL caches and HNSW + FTS hybrid search."""

from types import SimpleNamespace
import os
import time
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy import text

import app.core.db as core_db
from app.core.cache import BoundedTTLCache
from app.models import ChannelPost, Organization, Product
from app.services import alert_service, demo_service, shared_bot_routing, telegram_auth
from app.services.knowledge import (
    KnowledgeService,
    build_fts_or_tsquery,
    fuse_hybrid_ranks,
)
from app.services.telegram import TelegramService


def test_bounded_ttl_cache_eviction_and_expiry():
    cache: BoundedTTLCache[str, int] = BoundedTTLCache(maxsize=3, ttl_seconds=0.05)
    cache["a"] = 1
    cache["b"] = 2
    cache["c"] = 3
    # Touch 'a' so 'b' becomes LRU
    assert cache.get("a") == 1
    cache["d"] = 4
    assert "b" not in cache
    assert set(cache.keys()) == {"a", "c", "d"}

    time.sleep(0.08)
    assert cache.get("a") is None
    assert len(cache) == 0


def test_service_caches_use_bounded_ttl_stores():
    for store in (
        demo_service._DEMO_SESSIONS,
        demo_service._TG_CHAT_MAP,
        demo_service._ALERT_MAP,
        telegram_auth._AUTH_SESSIONS,
        shared_bot_routing._SHARED_SHOP_MEM,
        alert_service._ALERT_COOLDOWN_MEM,
    ):
        assert isinstance(store, BoundedTTLCache)
        assert store.maxsize >= 100


@pytest.mark.asyncio
async def test_telegram_avatar_negative_cache_bounded():
    svc = TelegramService(bot_token="123456:BOUNDED-TEST-TOKEN")
    assert isinstance(svc._avatar_cache, BoundedTTLCache)
    assert svc._avatar_cache.maxsize == 512

    mock_call = AsyncMock(return_value={"photos": []})
    with patch.object(svc, "call", mock_call):
        first = await svc.get_user_profile_photo_bytes(998877)
        second = await svc.get_user_profile_photo_bytes(998877)

    assert first is None
    assert second is None
    assert mock_call.await_count == 1


def test_fts_tsquery_sanitization_and_rrf_fusion():
    tsq = build_fts_or_tsquery(["iPhone 15 (Pro):", "$1,200!", "ноутбук", "x"])
    assert "iphone:*" in tsq
    assert "ноутбук:*" in tsq
    assert "$" not in tsq and "(" not in tsq and ":" not in tsq.replace(":*", "")

    p1 = SimpleNamespace(id=1, name="Shared Hit")
    p2 = SimpleNamespace(id=2, name="Vector Only")
    p3 = SimpleNamespace(id=3, name="FTS Only")
    fused = fuse_hybrid_ranks([p2, p1], [p3, p1], token_scores={1: 3, 3: 1}, limit=3)
    assert fused[0].id == 1


@pytest.mark.anyio
async def test_postgresql_hnsw_fts_indexes_and_hybrid_search():
    pid = os.getpid()
    async with core_db.SessionLocal() as db:
        if db.get_bind().dialect.name != "postgresql":
            pytest.skip("PostgreSQL pgvector + GIN verification requires PostgreSQL")

        idx_rows = (
            await db.execute(
                text(
                    "SELECT indexname FROM pg_indexes WHERE tablename IN ('products', 'channel_posts')"
                )
            )
        ).scalars().all()
        idx_set = set(idx_rows)
        assert "ix_products_embedding_hnsw" in idx_set
        assert "ix_products_fts" in idx_set
        assert "ix_channel_posts_embedding_hnsw" in idx_set
        assert "ix_channel_posts_fts" in idx_set

        org = Organization(name="Hybrid Store", slug=f"hybrid-store-{pid}")
        db.add(org)
        await db.flush()

        dim = 1536
        vec_a = [0.0] * dim
        vec_a[0] = 1.0
        vec_b = [0.0] * dim
        vec_b[1] = 1.0

        p_sem = Product(
            organization_id=org.id,
            code=f"SEM-{pid}",
            name="Ultra Slim Business Notebook",
            category="Ultrabook",
            specs="14 inch OLED, 16GB RAM",
            price="$890",
            is_active=True,
            embedding=vec_a,
        )
        p_other = Product(
            organization_id=org.id,
            code=f"OTH-{pid}",
            name="Budget Printer Laser",
            category="Office",
            specs="WiFi",
            price="$150",
            is_active=True,
            embedding=vec_b,
        )
        post = ChannelPost(
            organization_id=org.id,
            channel_username=f"hybrid_ch_{pid}",
            telegram_message_id=900000 + pid,
            text="Maxsus Ultrabook OLED 16GB chegirma bilan",
            embedding=vec_a,
        )
        db.add_all([p_sem, p_other, post])
        await db.commit()

        ks = KnowledgeService()
        with patch.object(ks, "embed", AsyncMock(return_value=vec_a)):
            prods = await ks.search_products(db, "ish uchun yengil notebook", limit=3, organization_id=org.id)
            posts = await ks.search(db, "ultrabook chegirma", limit=3, organization_id=org.id)

        assert any(p.code == f"SEM-{pid}" for p in prods)
        assert prods[0].code == f"SEM-{pid}"
        assert any(c.id == post.id for c in posts)
