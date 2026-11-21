import asyncio
import httpx
from app.core.config import settings

async def main():
    token = settings.telegram_bot_token
    secret = settings.telegram_webhook_secret
    url = f"https://api.telegram.org/bot{token}/setWebhook"
    payload = {
        "url": "https://selloi.uz/telegram/webhook",
        "secret_token": secret,
        "allowed_updates": [
            "message",
            "edited_message",
            "channel_post",
            "edited_channel_post",
            "callback_query",
            "business_connection",
            "business_message",
            "edited_business_message",
        ],
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json=payload)
        print("setWebhook result:", r.json())
        info = await client.get(f"https://api.telegram.org/bot{token}/getWebhookInfo")
        print("getWebhookInfo:", info.json())

if __name__ == "__main__":
    asyncio.run(main())
