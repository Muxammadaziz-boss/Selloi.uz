"""Telegram Bot Webhook Router.

Ingests webhook POST requests sent by Telegram's servers and routes
them to the appropriate command, callback, or text handler.
"""

from typing import Any, Dict
from .commands import handle_start_command, handle_help_command, handle_operator_command
from .callbacks import handle_callback_query
from ..config import config


async def route_telegram_update(update: Dict[str, Any]) -> Dict[str, Any]:
    """Inspect update payload and route to the correct sub-handler."""
    # 1. Check for Callback Query (Button clicks)
    if "callback_query" in update:
        return await handle_callback_query(
            update["callback_query"],
            storefront_url=config.STOREFRONT_URL,
        )

    # 2. Check for Incoming Message
    message = update.get("message") or update.get("channel_post")
    if not message:
        return {"status": "ignored", "reason": "no_supported_field"}

    text = message.get("text", "").strip()
    chat_id = message.get("chat", {}).get("id")
    user_first_name = message.get("from", {}).get("first_name", "Foydalanuvchi")

    if not chat_id:
        return {"status": "ignored", "reason": "no_chat_id"}

    # 3. Handle standard slash commands
    if text.startswith("/start"):
        return await handle_start_command(chat_id, user_first_name, storefront_url=config.STOREFRONT_URL)

    elif text.startswith("/help"):
        return await handle_help_command(chat_id)

    elif text.startswith("/operator"):
        return await handle_operator_command(chat_id)

    # 4. Text messages are forwarded to module 2 (telegram-user-chat)
    return {
        "status": "forward_to_ai_chat",
        "chat_id": chat_id,
        "text": text,
        "message_id": message.get("message_id"),
        "user": message.get("from", {}),
    }
