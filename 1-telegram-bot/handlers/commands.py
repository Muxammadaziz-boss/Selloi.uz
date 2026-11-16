"""Telegram Bot Command Handlers.

Handles all standard Telegram commands: /start, /help, /admin, /catalog, /operator.
"""

from typing import Any, Dict
from ..services.telegram_client import telegram_client
from .keyboards import main_menu_keyboard


async def handle_start_command(chat_id: int, user_first_name: str, storefront_url: str = "") -> Dict[str, Any]:
    """Execute the /start command welcome flow."""
    text = (
        f"Assalomu alaykum, <b>{user_first_name}</b>!\n\n"
        f"🤖 Men do'konimizning <b>AI Savdo Assistenti</b>man.\n"
        f"Sizga kerakli mahsulotlarni tanlash, narxlar va qoldiqlar haqida ma'lumot berish "
        f"hamda buyurtmangizni rasmiylashtirishda yordam bera olaman.\n\n"
        f"Quyidagi tugmalardan birini tanlang yoki to'g'ridan-to'g'ri savolingizni yozing 👇"
    )
    keyboard = main_menu_keyboard(storefront_url)
    return await telegram_client.send_message(chat_id, text, reply_markup=keyboard)


async def handle_help_command(chat_id: int) -> Dict[str, Any]:
    """Execute the /help command with list of capabilities."""
    text = (
        "<b>Qanday yordam bera olaman?</b>\n\n"
        "• <b>Mahsulot qidirish:</b> Mahsulot nomi yoki xususiyatini yozing (masalan, <i>'Asus i7 noutbuk bormi?'</i>)\n"
        "• <b>Narxlar va qoldiqlar:</b> AI sizga do'konda mavjud tovarlar haqida aniq javob beradi.\n"
        "• <b>Buyurtma berish:</b> Tovarni tanlang va manzilingizni qoldiring.\n"
        "• <b>Inson operatori:</b> Agar yordam kerak bo'lsa, /operator buyrug'ini yuboring."
    )
    return await telegram_client.send_message(chat_id, text)


async def handle_operator_command(chat_id: int) -> Dict[str, Any]:
    """Execute the /operator handover request."""
    text = (
        "👨‍💼 <b>Sizning so'rovingiz operatorimizga yo'naltirildi.</b>\n\n"
        "Tez orada sotuvchi mutaxassisimiz siz bilan to'g'ridan-to'g'ri muloqotga kirishadi. "
        "Iltimos, ozgina kuting!"
    )
    return await telegram_client.send_message(chat_id, text)
