"""Multi-tenant Telegram Bot Manager & Background Polling Engine.

Ensures every organization's Telegram bot is operational whether running
behind an HTTPS webhook (production) or via long-polling (local dev / VPS without domain).
"""

import asyncio
from typing import Dict, Optional
import httpx
from sqlalchemy import select
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.models import Organization
from app.services.distributed_lock import release_lock, try_acquire_lock
from app.services.telegram import get_telegram_service, TelegramService

logger = get_logger(__name__)

_BOT_MANAGER_LOCK_NAME = "bot_manager_leader"
_BOT_MANAGER_LOCK_TTL = 150


class TenantBotManager:
    """Manages Telegram bot lifecycle and polling loops for all active tenant organizations."""

    def __init__(self):
        self._tasks: Dict[int, asyncio.Task] = {}
        self._invalid_org_ids: set[int] = set()
        self._running = False
        self._is_leader = False

    async def start(self) -> None:
        """Start monitoring and polling for all active organizations with configured bots."""
        self._running = True
        logger.info("TenantBotManager ishga tushmoqda...")
        asyncio.create_task(self._supervision_loop())

    async def _stop_all_tasks(self) -> None:
        """Cancel all running per-organization bot polling tasks."""
        for _org_id, task in list(self._tasks.items()):
            task.cancel()
        self._tasks.clear()

    async def stop(self) -> None:
        """Gracefully cancel all running bot polling tasks and release leadership."""
        self._running = False
        await self._stop_all_tasks()
        self._invalid_org_ids.clear()
        if self._is_leader:
            release_lock(_BOT_MANAGER_LOCK_NAME)
            self._is_leader = False
        logger.info("TenantBotManager to'xtatildi")

    async def _supervision_loop(self) -> None:
        """Periodic supervision loop using a distributed leader lease across API workers."""
        while self._running:
            try:
                acquired, _owner = try_acquire_lock(
                    _BOT_MANAGER_LOCK_NAME,
                    ttl_seconds=_BOT_MANAGER_LOCK_TTL,
                    renew=True,
                )
                if acquired:
                    if not self._is_leader:
                        logger.info("TenantBotManager liderligi olindi (polling faol)")
                    self._is_leader = True
                    await self._refresh_workers()
                else:
                    if self._is_leader:
                        logger.info("TenantBotManager liderligi boshqa workerga o'tdi")
                        await self._stop_all_tasks()
                    self._is_leader = False
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
        acquired, _owner = try_acquire_lock(
            _BOT_MANAGER_LOCK_NAME,
            ttl_seconds=_BOT_MANAGER_LOCK_TTL,
            renew=True,
        )
        if not acquired:
            self._is_leader = False
            return
        self._is_leader = True
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
            webhook_url = webhook_info.get("url", "") if isinstance(webhook_info, dict) else ""
            if isinstance(webhook_info, dict) and "result" in webhook_info:
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
                backoff = 2

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
            resp = await client.post(
                f"https://api.telegram.org/bot{token}/getUpdates",
                json={
                    "offset": offset,
                    "timeout": timeout,
                    "allowed_updates": [
                        "message",
                        "callback_query",
                        "business_message",
                        "edited_business_message",
                        "business_connection",
                        "channel_post",
                        "edited_channel_post",
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
        """Process a single incoming Telegram update through the unified multi-tenant pipeline."""
        msg = update.get("message")
        if msg and msg.get("chat", {}).get("type") == "private":
            chat_id = msg.get("chat", {}).get("id")
            sender = msg.get("from") or {}
            first_name = sender.get("first_name", "")
            text = (msg.get("text") or msg.get("caption") or "").strip()

            if text == "/start" and org_id != 1 and chat_id:
                welcome_text = (
                    f"Assalomu alaykum, {first_name or 'mijoz'}! 👋\n\n"
                    f"**{org_name}** do'konining rasmiy savdo botiga xush kelibsiz!\n\n"
                    "Men sun'iy intellekt asosida ishlovchi savdo assistentiman. "
                    "Do'konimizdagi barcha mahsulotlar, narxlar va buyurtma berish haqida savolingizga javob bera olaman.\n\n"
                    "💡 Savolingiz yoki qiziqtirgan mahsulotingizni bemalol yozing!"
                )
                await tg_svc.call("sendMessage", {
                    "chat_id": chat_id,
                    "text": welcome_text,
                    "parse_mode": "Markdown",
                })
                return

            if text in ("/help", "/yordam") and org_id != 1 and chat_id:
                help_text = (
                    f"🤖 **{org_name} Savdo Assistentidan foydalanish:**\n\n"
                    "• Qiziqtirgan mahsulotingiz nomini yozing (masalan: *narxi qancha?*, *yetkazib berish bormi?*)\n"
                    "• AI mahsulot ma'lumotlarini rasmlari bilan taqdim etadi.\n"
                    "• Buyurtma bermoqchi bo'lsangiz, ismingiz, telefon raqamingiz va manzilingizni qoldiring."
                )
                await tg_svc.call("sendMessage", {
                    "chat_id": chat_id,
                    "text": help_text,
                    "parse_mode": "Markdown",
                })
                return

        update_id = update.get("update_id")
        if isinstance(update_id, int):
            from app.services.durable_inbox import process_single_inbox_job, record_inbox_update

            async with SessionLocal() as db:
                inbox_item, is_dup = await record_inbox_update(
                    db,
                    bot_id=f"org_{org_id}",
                    update_id=update_id,
                    payload=update,
                    organization_id=org_id,
                )
            if is_dup:
                return
            if inbox_item and not getattr(settings, "run_background_workers", False):
                await process_single_inbox_job(inbox_item.id)
            return

        from app.api.webhooks import execute_update_payload
        await execute_update_payload(update, organization_id=org_id)


# Global singleton instance
bot_manager = TenantBotManager()
