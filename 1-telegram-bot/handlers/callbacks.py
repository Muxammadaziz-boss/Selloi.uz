"""Telegram Bot Inline Callback Query Handlers.

Processes inline keyboard button clicks such as catalog browsing,
cart viewing, human operator request, or product details.
"""

from typing import Any, Dict
from ..services.telegram_client import telegram_client
from .keyboards import main_menu_keyboard, operator_request_keyboard


async def handle_callback_query(callback_data: Dict[str, Any], storefront_url: str = "") -> Dict[str, Any]:
    """Route callback queries based on data payload."""
    query_id = callback_data.get("id", "")
    data = callback_data.get("data", "")
    chat_id = callback_data.get("message", {}).get("chat", {}).get("id")

    if not chat_id:
        return {}

    # Acknowledge callback immediately
    await telegram_client.answer_callback_query(query_id)

    if data == "menu_catalog":
        text = (
            "🛍 <b>Mahsulotlar katalogi</b>\n\n"
            "Siz bizning to'liq assortimentimiz bilan onlayn veb-do'konimizda tanishishingiz "
            "yoki to'g'ridan-to'g'ri shu yerda kerakli mahsulot nomini yozishingiz mumkin."
        )
        return await telegram_client.send_message(
            chat_id,
            text,
            reply_markup=main_menu_keyboard(storefront_url),
        )

    elif data == "menu_operator":
        text = (
            "👨‍💼 <b>Inson operatori bilan bog'lanish</b>\n\n"
            "Sizga mutaxassis yordami kerakmi? Tasdiqlash uchun quyidagi tugmani bosing."
        )
        return await telegram_client.send_message(
            chat_id,
            text,
            reply_markup=operator_request_keyboard(),
        )

    elif data == "confirm_operator":
        text = (
            "✅ <b>Operator chaqirildi!</b>\n\n"
            "Navbatchi operatorimiz 1-3 daqiqa ichida siz bilan bog'lanadi. Iltimos, kuting."
        )
        return await telegram_client.send_message(chat_id, text)

    elif data == "menu_help":
        text = (
            "ℹ️ <b>Yordam va Yo'riqnoma:</b>\n\n"
            "1. Shunchaki o'zingiz izlayotgan tovar haqida yozing.\n"
            "2. AI mahsulot narxi, xususiyatlari va rasmlarini ko'rsatadi.\n"
            "3. Manzilingizni yuborib bir zumda xarid qiling."
        )
        return await telegram_client.send_message(chat_id, text)

    return {}
