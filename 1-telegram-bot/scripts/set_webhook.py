"""Script to set or remove Telegram Bot Webhook."""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from dotenv import load_dotenv
import httpx
import os

load_dotenv()

async def setup_webhook():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        print("[XATO] .env faylida TELEGRAM_BOT_TOKEN topilmadi!")
        return

    public_url = os.environ.get("PUBLIC_WEBHOOK_URL")
    if not public_url:
        print("[OGOHLANTIRISH] PUBLIC_WEBHOOK_URL ko'rsatilmagan.")
        print("Masalan: PUBLIC_WEBHOOK_URL=https://your-domain.uz")
        return

    url = public_url.rstrip("/") + "/telegram/webhook"
    secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")

    payload = {
        "url": url,
        "secret_token": secret,
        "allowed_updates": [
            "message",
            "callback_query",
            "business_connection",
            "business_message",
            "channel_post",
        ],
        "drop_pending_updates": False,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"https://api.telegram.org/bot{token}/setWebhook", json=payload)
        res.raise_for_status()
        data = res.json()
        print("[MUVAFFAQIYAT] Telegram webhook o'rnatildi:")
        print(data)

if __name__ == "__main__":
    asyncio.run(setup_webhook())
