"""Tests for Uzbek + Russian + Cyrillic/Latin retail slang normalization and catalog search."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base, Organization, Product
from app.services.ai import SalesAI
from app.services.knowledge import KnowledgeService
from app.services.uzbek_nlp import (
    cyrillic_to_latin,
    detect_retail_intents,
    expand_search_tokens,
    normalize_for_matching,
)


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def test_cyrillic_to_latin_and_retail_slang_tokens():
    assert cyrillic_to_latin("Салом, Айфон 15 нечпул?") == "salom, ayfon 15 nechpul?"
    assert normalize_for_matching("Қизил Ғишт ўйин") == "qizil gisht oyin"

    tokens = expand_search_tokens("Салом, айфон 15 нечпул, дастафка и оптом борми?")
    assert "ayfon" in tokens
    assert "iphone" in tokens
    assert "narx" in tokens
    assert "yetkazib" in tokens
    assert "optom" in tokens
    assert "ulgurji" in tokens

    intents = detect_retail_intents("Нечпул бу ноотбук? Рассрочка и дастафка борми?")
    assert "price_inquiry" in intents
    assert "installment_inquiry" in intents
    assert "delivery_inquiry" in intents
    assert "availability_inquiry" in intents


def test_sales_ai_is_greeting_handles_cyrillic_russian_and_slang():
    assert SalesAI.is_greeting("Салом") is True
    assert SalesAI.is_greeting("Ассалому алайкум!") is True
    assert SalesAI.is_greeting("Здравствуйте!") is True
    assert SalesAI.is_greeting("Привет") is True

    # Mixed greeting + slang product/price questions MUST NOT short-circuit as simple greetings
    assert SalesAI.is_greeting("Салом, нечпул?") is False
    assert SalesAI.is_greeting("Привет, сколько стоит?") is False
    assert SalesAI.is_greeting("Салом дастафка борми") is False
    assert SalesAI.is_greeting("Salom optom bormi") is False
    assert SalesAI.is_greeting("Assalomu alaykum kreditga bormi?") is False


@pytest.mark.asyncio
async def test_cross_script_product_search_finds_latin_products_from_cyrillic_slang(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "nlp_prod.db")
    try:
        ks = KnowledgeService()
        async with SessionFactory() as db:
            org = Organization(name="Tech Uz", slug="tech-uz")
            db.add(org)
            await db.flush()

            db.add_all([
                Product(
                    organization_id=org.id,
                    code="IP-15",
                    name="Apple iPhone 15 Pro 256GB",
                    category="Smartfon",
                    specs="Yangi, rasmiy kafolat, naqd va nasiya",
                    price="1 050$",
                    is_active=True,
                ),
                Product(
                    organization_id=org.id,
                    code="NB-01",
                    name="Ноутбук Lenovo ThinkPad",
                    category="Ofis",
                    specs="16GB RAM, SSD 512GB",
                    price="700$",
                    is_active=True,
                ),
            ])
            await db.commit()

            # Cyrillic slang query finding Latin catalog product
            res_iphone = await ks.search_products(
                db,
                "Айфон 15 нечпул, рассрочка борми?",
                limit=5,
                organization_id=org.id,
            )
            assert len(res_iphone) >= 1
            assert res_iphone[0].code == "IP-15"

            # Latin slang query finding Cyrillic catalog product
            res_laptop = await ks.search_products(
                db,
                "nootbuk lenovo optom bormi",
                limit=5,
                organization_id=org.id,
            )
            assert len(res_laptop) >= 1
            assert res_laptop[0].code == "NB-01"
    finally:
        await engine.dispose()
