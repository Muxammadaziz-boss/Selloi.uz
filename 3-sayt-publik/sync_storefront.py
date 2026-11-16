"""Storefront Catalog Synchronizer.

Syncs products from PostgreSQL database / Telegram channel into static JSON
data files for ultra-fast, CDN-ready public storefront delivery.
"""

import asyncio
import json
from pathlib import Path
import sys

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import SessionLocal
from app.models import ChannelPost


async def sync_catalog_to_storefront():
    output_path = Path(__file__).resolve().parent / "products.json"
    print(f"📦 Mahsulotlar bazadan o'qilmoqda...")

    items = []
    async with SessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(ChannelPost).order_by(ChannelPost.id.desc()))
        posts = result.scalars().all()

        for p in posts:
            # Parse price and details if available
            text = p.text or ""
            items.append({
                "id": p.id,
                "title": (text.split("\n")[0] if text else "Mahsulot")[:80],
                "description": text[:200],
                "category": "Elektronika",
                "price": 1000000,
                "stock": 10,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"✅ {len(items)} ta mahsulot {output_path} fayliga sinxronlandi!")


if __name__ == "__main__":
    asyncio.run(sync_catalog_to_storefront())
