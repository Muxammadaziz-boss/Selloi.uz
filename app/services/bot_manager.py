"""Multi-tenant Telegram Bot Manager & Background Polling Engine.

Ensures every organization's Telegram bot is operational whether running
behind an HTTPS webhook (production) or via long-polling (local dev / VPS without domain).
"""

import asyncio
from typing import Dict, Any, Optional
import httpx
from sqlalchemy import select
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.models import Organization, ConnectedChannel, Order
from app.services.telegram import get_telegram_service, TelegramService
from app.services.ai import sales_ai
from app.services.knowledge import knowledge

logger = get_logger(__name__)


class TenantBotManager:
    """Manages Telegram bot lifecycle and polling loops for all active tenant organizations."""

    def __init__(self):
        self._tasks: Dict[int, asyncio.Task] = {}
        self._invalid_org_ids: set[int] = set()
        self._running = False

    async def start(self) -> None:
        """Start monitoring and polling for all active organizations with configured bots."""
        self._running = True
        logger.info("TenantBotManager ishga tushmoqda...")
        asyncio.create_task(self._supervision_loop())

    async def stop(self) -> None:
        """Gracefully cancel all running bot polling tasks."""
        self._running = False
        for org_id, task in list(self._tasks.items()):
            task.cancel()
        self._tasks.clear()
        self._invalid_org_ids.clear()
        logger.info("TenantBotManager to'xtatildi")

    async def _supervision_loop(self) -> None:
        """Periodic supervision loop to discover new tenant bots and restart failed workers."""
        while self._running:
            try:
                await self._refresh_workers()
            except Exception as exc:
                logger.warning("Bot supervision loop xatoligi: %s", exc)
            await asyncio.sleep(60)

    async def _refresh_workers(self) -> None:
        """Find all active organizations with bot tokens and ensure their workers are running."""
        async with SessionLocal() as db:
            result = await db.execute(
                select(Organization).where(
                    Organization.status == "active",
                    Organization.telegram_bot_token.is_not(None),
                )
            )
            orgs = result.scalars().all()

        active_ids = {org.id for org in orgs}

        # Cancel tasks for removed or inactive organizations
        for org_id in list(self._tasks.keys()):
            if org_id not in active_ids:
                logger.info("Tashkilot bot polling to'xtatildi: org_id=%s", org_id)
                self._tasks[org_id].cancel()
                del self._tasks[org_id]

        # Ensure workers exist for all valid active organizations
        for org in orgs:
            if org.id in self._invalid_org_ids:
                continue
            if org.id not in self._tasks or self._tasks[org.id].done():
                token = org.decrypted_bot_token
                if token:
                    self._tasks[org.id] = asyncio.create_task(
                        self._run_org_bot(org.id, org.slug, org.name, token)
                    )

    async def restart_org(self, org_id: int) -> None:
        """Restart worker for a specific organization after settings change."""
        self._invalid_org_ids.discard(org_id)
        if org_id in self._tasks:
            self._tasks[org_id].cancel()
            del self._tasks[org_id]
        async with SessionLocal() as db:
            org = await db.get(Organization, org_id)
            if org and org.status == "active":
                token = org.decrypted_bot_token
                if token:
                    self._tasks[org.id] = asyncio.create_task(
                        self._run_org_bot(org.id, org.slug, org.name, token)
                    )

    async def _run_org_bot(self, org_id: int, org_slug: str, org_name: str, token: str) -> None:
        """Worker loop for a single organization bot."""
        tg_svc = get_telegram_service(token)
        logger.info("Bot worker boshlandi: org=%s (%s)", org_name, org_slug)

        # 1. Check if public HTTPS webhook is active
        try:
            webhook_info = await tg_svc.get_webhook_info()
            if not webhook_info.get("ok"):
                desc = webhook_info.get("description", "")
                if "Unauthorized" in desc or webhook_info.get("error_code") == 401:
                    logger.info("Bot token yaroqsiz (Unauthorized), polling to'xtatildi: org=%s", org_slug)
                    self._invalid_org_ids.add(org_id)
                    return
            webhook_url = webhook_info.get("result", {}).get("url", "")
            if webhook_url.startswith("https://"):
                logger.info(
                    "Bot HTTPS webhook orqali ishlamoqda: org=%s, url=%s (polling o'chirildi)",
                    org_slug,
                    webhook_url,
                )
                return
            elif webhook_url:
                # Remove stale or invalid (e.g. http://localhost) webhook so polling can work
                logger.info("Eski/yaroqsiz webhook o'chirildi: %s (org=%s)", webhook_url, org_slug)
                await tg_svc.delete_webhook(drop_pending_updates=False)
        except Exception as exc:
            err_str = str(exc)
            logger.warning("Bot webhook tekshirishda xatolik (org=%s): %s", org_slug, err_str)
            if "Unauthorized" in err_str or "401" in err_str:
                logger.info("Bot token yaroqsiz (Unauthorized), polling to'xtatildi: org=%s", org_slug)
                self._invalid_org_ids.add(org_id)
                return

        # 2. Start Long-Polling loop
        offset = 0
        backoff = 2
        while self._running:
            try:
                updates = await self._fetch_updates(token, offset, timeout=10)
                if updates is None:  # Unauthorized or fatal
                    self._invalid_org_ids.add(org_id)
                    break
                backoff = 2  # reset backoff on success

                for update in updates:
                    update_id = update.get("update_id", 0)
                    offset = max(offset, update_id + 1)
                    try:
                        await self._process_update(update, org_id, org_name, tg_svc)
                    except Exception as exc:
                        logger.exception("Update qayta ishlashda xatolik (org=%s): %s", org_slug, exc)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Bot polling tarmoq xatoligi (org=%s): %s (kutish: %ss)", org_slug, exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)

        logger.info("Bot worker to'xtatildi: org=%s", org_slug)

    async def _fetch_updates(self, token: str, offset: int, timeout: int = 10) -> Optional[list[dict]]:
        """Fetch pending updates via Telegram getUpdates API."""
        async with httpx.AsyncClient(timeout=timeout + 5) as client:
            resp = await client.get(
                f"https://api.telegram.org/bot{token}/getUpdates",
                params={
                    "offset": offset,
                    "timeout": timeout,
                    "allowed_updates": [
                        "message",
                        "callback_query",
                        "business_message",
                        "business_connection",
                        "channel_post",
                    ],
                },
            )
            data = resp.json()
            if not data.get("ok"):
                if data.get("error_code") == 401 or "Unauthorized" in data.get("description", ""):
                    return None
                return []
            return data.get("result", [])

    async def _process_update(self, update: dict, org_id: int, org_name: str, tg_svc: TelegramService) -> None:
        """Process a single incoming Telegram update for this store."""
        msg = update.get("message")
        if not msg:
            return

        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        if not chat_id:
            return

        sender = msg.get("from") or {}
        first_name = sender.get("first_name", "")
        last_name = sender.get("last_name", "")
        customer_name = f"{first_name} {last_name}".strip() or "Mijoz"
        text = (msg.get("text") or msg.get("caption") or "").strip()

        # Handle Private Chat Messages
        if chat.get("type") == "private":
            if text == "/start":
                welcome_text = (
                    f"Assalomu alaykum, {first_name}! 👋\n\n"
                    f"**{org_name}** do'konining rasmiy savdo botiga xush kelibsiz!\n\n"
                    "Men sun'iy intellekt asosida ishlovchi savdo assistentiman. "
                    "Do'konimizdagi barcha mahsulotlar, narxlar va buyurtma berish haqida har qanday savolingizga javob bera olaman.\n\n"
                    "💡 Savolingiz yoki qiziqtirgan mahsulotingizni bemalol yozing!"
                )
                await tg_svc.call("sendMessage", {
                    "chat_id": chat_id,
                    "text": welcome_text,
                    "parse_mode": "Markdown",
                })
                return

            if text in ("/help", "/yordam"):
                help_text = (
                    f"🤖 **{org_name} Savdo Assistentidan foydalanish:**\n\n"
                    "• Qiziqtirgan mahsulotingiz nomini yozing (masalan: *narxi qancha?*, *yetkazib berish bormi?*)\n"
                    "• AI mahsulot ma'lumotlarini rasmlari bilan taqdim etadi.\n"
                    "• Buyurtma bermoqchi bo'lsangiz, ismingiz, telefon raqamingiz va manzilingizni qoldiring.\n\n"
                    "Assistent 24/7 rejimida xizmatingizda!"
                )
                await tg_svc.call("sendMessage", {
                    "chat_id": chat_id,
                    "text": help_text,
                    "parse_mode": "Markdown",
                })
                return

            if not text:
                return

            # Show typing action while AI processes
            try:
                await tg_svc.call("sendChatAction", {"chat_id": chat_id, "action": "typing"})
            except Exception:
                pass

            # Search knowledge base for this organization
            async with SessionLocal() as db:
                org = await db.get(Organization, org_id)
                ai_lang = org.ai_language if org else "uz"
                ai_persona = org.ai_personality if org else None

                evidence = []
                if not sales_ai.is_greeting(text):
                    evidence = await knowledge.search(db, text, limit=6, organization_id=org_id)

                decision = await sales_ai.answer(text, evidence, [], store_name=org_name, language=ai_lang)

            # Reply to customer with photo if available
            reply_text = decision.get("reply", "Kechirasiz, tizimda vaqtinchalik xatolik yuz berdi.")
            sent = False
            if decision.get("attach_photo") and decision.get("source_post_id") is not None:
                selected_post = next((p for p in evidence if p.telegram_message_id == decision["source_post_id"]), None)
                if selected_post and selected_post.photo_file_id:
                    try:
                        await tg_svc.call("sendPhoto", {
                            "chat_id": chat_id,
                            "photo": selected_post.photo_file_id,
                            "caption": reply_text[:1024],
                        })
                        sent = True
                    except Exception:
                        sent = False

            if not sent:
                await tg_svc.call("sendMessage", {
                    "chat_id": chat_id,
                    "text": reply_text,
                })

            # Check if order was created or handoff needed -> notify admin
            if decision.get("order_created") and decision.get("order_data"):
                order_info = decision["order_data"]
                async with SessionLocal() as db:
                    new_order = Order(
                        organization_id=org_id,
                        customer_name=order_info.get("customer_name") or customer_name,
                        phone=order_info.get("phone") or "",
                        product_summary=order_info.get("product_summary") or "",
                        delivery_address=order_info.get("delivery_address") or "",
                        status="new",
                        notes=f"Telegram bot chatidan (@{sender.get('username') or ''}, ID: {chat_id})",
                    )
                    db.add(new_order)
                    await db.commit()
                    await db.refresh(new_order)

                    # Notify store owner at admin_chat_id if configured
                    if org and org.admin_chat_id:
                        try:
                            alert_text = (
                                f"🛒 **Yangi Buyurtma! (#{new_order.id})**\n\n"
                                f"👤 **Mijoz:** {new_order.customer_name}\n"
                                f"📞 **Telefon:** {new_order.phone or 'Kiritilmagan'}\n"
                                f"📦 **Mahsulot:** {new_order.product_summary}\n"
                                f"📍 **Manzil:** {new_order.delivery_address or 'Kiritilmagan'}\n"
                                f"💬 **Telegram:** @{sender.get('username') or 'Mavjud emas'}"
                            )
                            await tg_svc.call("sendMessage", {
                                "chat_id": org.admin_chat_id,
                                "text": alert_text,
                                "parse_mode": "Markdown",
                            })
                        except Exception as alert_err:
                            logger.warning("Admin alert xabari yuborilmadi: %s", alert_err)


# Global singleton instance
bot_manager = TenantBotManager()
