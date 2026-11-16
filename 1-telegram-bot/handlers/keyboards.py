"""Telegram Bot Keyboards & Inline Markups.

Provides builder helpers for Telegram interactive menus:
Catalog buttons, WebApp storefront link, operator assistance, and order confirmations.
"""

from typing import Any, Dict, List, Optional


def main_menu_keyboard(storefront_url: Optional[str] = None) -> Dict[str, Any]:
    """Build the primary customer interaction inline keyboard."""
    buttons: List[List[Dict[str, Any]]] = [
        [
            {"text": "🛍 Mahsulotlar Katalogi", "callback_data": "action_catalog"},
            {"text": "🛒 Mening Savatim", "callback_data": "action_cart"},
        ],
        [
            {"text": "💬 Savol Berish (AI)", "callback_data": "action_ask_ai"},
            {"text": "👨‍💼 Operator bilan bog'lanish", "callback_data": "action_human_takeover"},
        ],
    ]

    if storefront_url:
        buttons.append([
            {"text": "🌐 Sayt orqali xarid qilish", "web_app": {"url": storefront_url}}
        ])

    return {"inline_keyboard": buttons}


def product_card_keyboard(product_id: str, storefront_url: Optional[str] = None) -> Dict[str, Any]:
    """Buttons attached to a specific product display card."""
    buttons: List[List[Dict[str, Any]]] = [
        [
            {"text": "⚡️ Buyurtma Berish", "callback_data": f"order_now_{product_id}"},
            {"text": "🛒 Savatga Qo'shish", "callback_data": f"add_cart_{product_id}"},
        ],
        [
            {"text": "💬 Batafsil AI dan so'rash", "callback_data": f"ask_product_{product_id}"},
        ],
    ]
    return {"inline_keyboard": buttons}


def order_confirmation_keyboard(order_id: str) -> Dict[str, Any]:
    """Buttons for order review and confirmation."""
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Tasdiqlash", "callback_data": f"confirm_order_{order_id}"},
                {"text": "❌ Bekor qilish", "callback_data": f"cancel_order_{order_id}"},
            ]
        ]
    }
