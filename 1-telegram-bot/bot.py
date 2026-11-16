"""Standalone Telegram Bot Polling / Worker Entrypoint.

Can be run independently to process Telegram updates via polling or to test bot flows.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
import httpx
from services.telegram_client import telegram_client
from handlers.webhooks import route_telegram_update

load_dotenv()


async def run_bot_polling():
    """Poll for Telegram updates when webhook is not active (e.g. local development)."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        print("[XATO] TELEGRAM_BOT_TOKEN topilmadi!")
        return

    print("🤖 Telegram Bot Polling rejimi ishga tushmoqda...")
    offset = 0

    # First delete any existing webhook to enable getUpdates
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(f"https://api.telegram.org/bot{token}/deleteWebhook")

    print("✅ Webhook tozalab olindi. getUpdates polling faol!")

    async with httpx.AsyncClient(timeout=45) as client:
        while True:
            try:
                res = await client.get(
                    f"https://api.telegram.org/bot{token}/getUpdates",
                    params={"offset": offset, "timeout": 30},
                )
                if res.status_code == 200:
                    data = res.json()
                    updates = data.get("result", [])
                    for update in updates:
                        offset = update["update_id"] + 1
                        await route_telegram_update(update)
            except asyncio.CancelledError:
                print("\n🛑 Bot to'xtatildi.")
                break
            except Exception as e:
                print(f"[OGOHLANTIRISH] Polling xatosi: {e}")
                await asyncio.sleep(3)


if __name__ == "__main__":
    try:
        asyncio.run(run_bot_polling())
    except KeyboardInterrupt:
        print("\nBot yakunlandi.")
