"""Test bot token and check connection using getMe."""

import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test_bot_connection():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        print("[XATO] TELEGRAM_BOT_TOKEN aniqlanmadi!")
        return

    url = f"https://api.telegram.org/bot{token}/getMe"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.get(url)
            data = res.json()
            if data.get("ok"):
                bot = data["result"]
                print(f"[OK] Bot ulandi: @{bot.get('username')} (ID: {bot.get('id')})")
                print(f"      Ismi: {bot.get('first_name')}")
            else:
                print(f"[XATO] Telegram API rad etdi: {data.get('description')}")
        except Exception as e:
            print(f"[XATO] Bog'lanishda xatolik: {e}")

if __name__ == "__main__":
    asyncio.run(test_bot_connection())
