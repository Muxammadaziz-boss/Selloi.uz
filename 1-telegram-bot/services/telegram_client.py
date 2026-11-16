"""Telegram Bot API Client Service.

Provides asynchronous HTTP client wrapper for all direct Telegram Bot API operations:
sending messages, photos, documents, setting bot commands, and managing webhooks.
"""

import httpx
from typing import Any, Dict, Optional
from ..config import bot_settings


class TelegramClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token or bot_settings.bot_token
        self.base_url = f"{bot_settings.telegram_api_url}{self.token}"

    async def call(self, method: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a direct Telegram Bot API call."""
        if not self.token:
            return {"ok": False, "description": "TELEGRAM_BOT_TOKEN is not configured"}

        url = f"{self.base_url}/{method}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload or {})
            try:
                return resp.json()
            except Exception:
                return {"ok": False, "status_code": resp.status_code, "text": resp.text}

    async def send_message(
        self,
        chat_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = "HTML",
    ) -> Dict[str, Any]:
        """Send a text message to a specific Telegram chat."""
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return await self.call("sendMessage", payload)

    async def send_photo(
        self,
        chat_id: int,
        photo_url: str,
        caption: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Send a photo with caption and buttons to a chat."""
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "photo": photo_url,
        }
        if caption:
            payload["caption"] = caption
            payload["parse_mode"] = "HTML"
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return await self.call("sendPhoto", payload)

    async def set_webhook(self, webhook_url: str, secret_token: Optional[str] = None) -> Dict[str, Any]:
        """Configure the Telegram server to send updates to the specified webhook URL."""
        payload: Dict[str, Any] = {
            "url": webhook_url,
            "drop_pending_updates": False,
        }
        if secret_token:
            payload["secret_token"] = secret_token
        return await self.call("setWebhook", payload)

    async def get_webhook_info(self) -> Dict[str, Any]:
        """Retrieve current webhook status and pending updates count from Telegram."""
        return await self.call("getWebhookInfo")

    async def delete_webhook(self) -> Dict[str, Any]:
        """Remove webhook configuration to allow polling mode."""
        return await self.call("deleteWebhook", {"drop_pending_updates": False})

    async def set_my_commands(self, commands: list[dict[str, str]]) -> Dict[str, Any]:
        """Register the official bot commands in the Telegram menu button."""
        return await self.call("setMyCommands", {"commands": commands})


telegram_client = TelegramClient()
