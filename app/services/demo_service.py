"""Redis-backed real-time live demo service with SSE broadcast and @Selloi_ai_bot relay."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import html as _html
import json
import re
import secrets
import time
from typing import Any, AsyncIterator

from app.core.cache import BoundedTTLCache
from app.core.config import settings
from app.core.logging import get_logger
from app.models import ChannelPost
from app.services.ai import sales_ai
from app.services.demo_catalog import (
    DEMO_PRODUCTS,
    build_demo_fallback_reply,
    fmt_uzs,
    get_demo_product,
    search_demo_catalog,
)
from app.services.telegram import telegram
from app.services.telegram_auth import get_bot_username

logger = get_logger(__name__)

DEMO_TTL_SECONDS = 7200  # 2 hours
_SESSION_PREFIX = "demo_sess:"
_TG_CHAT_PREFIX = "demo_tg_chat:"
_ALERT_PREFIX = "demo_alert_msg:"
_MAX_SSE_SESSIONS = 2000
_MAX_SSE_PER_SESSION = 20

# Bounded in-process store/fallback + active SSE queues
_DEMO_SESSIONS: BoundedTTLCache[str, dict[str, Any]] = BoundedTTLCache(maxsize=1000, ttl_seconds=DEMO_TTL_SECONDS)
_TG_CHAT_MAP: BoundedTTLCache[str, str] = BoundedTTLCache(maxsize=2000, ttl_seconds=DEMO_TTL_SECONDS)
_ALERT_MAP: BoundedTTLCache[str, str] = BoundedTTLCache(maxsize=5000, ttl_seconds=DEMO_TTL_SECONDS)
_SSE_SUBSCRIBERS: dict[str, set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]]] = {}


def _now_hhmm() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%H:%M")


def _get_redis():
    try:
        from app.core.rate_limit import limiter
        return limiter._get_redis()
    except Exception:
        return None


def _save_demo_session(session: dict[str, Any]) -> None:
    sid = session["session_id"]
    session["updated_at"] = time.time()
    # Keep bounded history in Redis/memory
    if len(session.get("messages", [])) > 80:
        session["messages"] = session["messages"][-80:]
    _DEMO_SESSIONS[sid] = session
    r = _get_redis()
    if r is not None:
        try:
            r.set(f"{_SESSION_PREFIX}{sid}", json.dumps(session, ensure_ascii=False), ex=DEMO_TTL_SECONDS)
        except Exception as exc:
            logger.debug("Redis set failed for demo session %s: %s", sid, exc)


def get_demo_session(session_id: str) -> dict[str, Any] | None:
    sid = (session_id or "").strip().lower()
    if not sid or not re.fullmatch(r"[a-z0-9_-]{6,48}", sid):
        return None
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(f"{_SESSION_PREFIX}{sid}")
            if raw:
                session = json.loads(raw)
                _DEMO_SESSIONS[sid] = session
                return session
        except Exception as exc:
            logger.debug("Redis get failed for demo session %s: %s", sid, exc)
    return _DEMO_SESSIONS.get(sid)


def _bind_tg_chat_map(chat_id: int, session_id: str) -> None:
    key = str(int(chat_id))
    _TG_CHAT_MAP[key] = session_id
    r = _get_redis()
    if r is not None:
        try:
            r.set(f"{_TG_CHAT_PREFIX}{key}", session_id, ex=DEMO_TTL_SECONDS)
        except Exception:
            pass


def get_session_id_by_tg_chat(chat_id: int) -> str | None:
    key = str(int(chat_id))
    r = _get_redis()
    if r is not None:
        try:
            val = r.get(f"{_TG_CHAT_PREFIX}{key}")
            if val:
                _TG_CHAT_MAP[key] = val
                return val
        except Exception:
            pass
    return _TG_CHAT_MAP.get(key)


def _save_alert_mapping(chat_id: int, tg_message_id: int, session_id: str) -> None:
    key = f"{int(chat_id)}:{int(tg_message_id)}"
    _ALERT_MAP[key] = session_id
    r = _get_redis()
    if r is not None:
        try:
            r.set(f"{_ALERT_PREFIX}{key}", session_id, ex=DEMO_TTL_SECONDS)
        except Exception:
            pass


def resolve_alert_session_id(chat_id: int, reply_to_message: dict[str, Any] | None) -> str | None:
    if not reply_to_message:
        return None
    msg_id = reply_to_message.get("message_id")
    if msg_id:
        key = f"{int(chat_id)}:{int(msg_id)}"
        r = _get_redis()
        if r is not None:
            try:
                val = r.get(f"{_ALERT_PREFIX}{key}")
                if val:
                    return val
            except Exception:
                pass
        if key in _ALERT_MAP:
            return _ALERT_MAP[key]
    body_text = str(reply_to_message.get("text") or reply_to_message.get("caption") or "")
    m = re.search(r"demo[:_]([a-z0-9_-]{6,48})", body_text.lower())
    return m.group(1) if m else None


def publish_demo_event(session_id: str, event_type: str, payload: dict[str, Any]) -> None:
    sid = (session_id or "").strip().lower()
    subs = list(_SSE_SUBSCRIBERS.get(sid, set()))
    event = {"type": event_type, "data": payload}
    for sub_loop, queue in subs:
        def _put(q=queue, ev=event):
            if q.full():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                q.put_nowait(ev)
            except asyncio.QueueFull:
                pass

        try:
            if sub_loop.is_running():
                sub_loop.call_soon_threadsafe(_put)
        except Exception:
            pass


async def subscribe_demo_events(session_id: str) -> AsyncIterator[str]:
    sid = (session_id or "").strip().lower()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
    entry = (loop, queue)
    if sid not in _SSE_SUBSCRIBERS and len(_SSE_SUBSCRIBERS) >= _MAX_SSE_SESSIONS:
        stale_keys = [k for k, subs in _SSE_SUBSCRIBERS.items() if not subs]
        for k in stale_keys:
            _SSE_SUBSCRIBERS.pop(k, None)
        while len(_SSE_SUBSCRIBERS) >= _MAX_SSE_SESSIONS:
            oldest_sid = next(iter(_SSE_SUBSCRIBERS))
            _SSE_SUBSCRIBERS.pop(oldest_sid, None)
    bucket = _SSE_SUBSCRIBERS.setdefault(sid, set())
    if len(bucket) >= _MAX_SSE_PER_SESSION:
        oldest_sub = next(iter(bucket))
        bucket.discard(oldest_sub)
    bucket.add(entry)
    try:
        yield f"event: connected\ndata: {json.dumps({'session_id': sid})}\n\n"
        while True:
            try:
                ev = await asyncio.wait_for(queue.get(), timeout=18.0)
                yield f"event: {ev['type']}\ndata: {json.dumps(ev['data'], ensure_ascii=False)}\n\n"
            except asyncio.TimeoutError:
                yield "event: ping\ndata: {}\n\n"
    finally:
        bucket = _SSE_SUBSCRIBERS.get(sid)
        if bucket is not None:
            bucket.discard(entry)
            if not bucket:
                _SSE_SUBSCRIBERS.pop(sid, None)


def _welcome_message(language: str, bot_username: str) -> dict[str, Any]:
    lang = language if language in {"uz", "ru", "en"} else "uz"
    texts = {
        "uz": (
            "Assalomu alaykum. TechZone katalogidan qaysi noutbuk, kompyuter yoki monitor "
            "qiziqtirayotganini yozing — mos variantlarni tanlab beraman.\n\n"
            f"Sinov davomida buyurtma bersangiz, @{bot_username} ham shu yerda javob qaytaradi."
        ),
        "ru": (
            "Здравствуйте. Напишите, какой ноутбук, ПК или монитор из каталога TechZone вас "
            "интересует — подберу подходящие варианты и рассчитаю условия.\n\n"
            f"При оформлении заказа в демо @{bot_username} сразу ответит прямо в этом чате."
        ),
        "en": (
            "Hello. Tell me which laptop, PC, or monitor from the TechZone catalog you need, "
            "and I will match the best options.\n\n"
            f"If you place a test order here, @{bot_username} replies right back in this live chat."
        ),
    }
    return {
        "id": "msg_welcome",
        "seq": 1,
        "from": "bot",
        "sender_name": "Selloi AI",
        "via": "ai",
        "text": texts[lang],
        "ts": _now_hhmm(),
        "quoted": None,
        "order": None,
    }


async def create_or_resume_session(
    session_id: str | None = None,
    *,
    language: str = "uz",
) -> dict[str, Any]:
    bot_username = await get_bot_username()
    existing = get_demo_session(session_id) if session_id else None
    lang = language if language in {"uz", "ru", "en"} else "uz"

    if existing is not None:
        existing["language"] = lang
        msgs = existing.get("messages", [])
        if len(msgs) == 1 and msgs[0].get("id") == "msg_welcome":
            msgs[0] = _welcome_message(lang, bot_username)
        _save_demo_session(existing)
        return _public_session_payload(existing, bot_username)

    sid = secrets.token_hex(6).lower()
    session = {
        "session_id": sid,
        "language": lang,
        "created_at": time.time(),
        "updated_at": time.time(),
        "next_seq": 2,
        "telegram_chat_id": None,
        "telegram_username": None,
        "telegram_full_name": None,
        "last_product_id": None,
        "orders": [],
        "messages": [_welcome_message(lang, bot_username)],
    }
    _save_demo_session(session)
    return _public_session_payload(session, bot_username)


def _public_session_payload(session: dict[str, Any], bot_username: str, after_seq: int = 0) -> dict[str, Any]:
    sid = session["session_id"]
    msgs = [m for m in session.get("messages", []) if int(m.get("seq", 0)) > after_seq]
    return {
        "session_id": sid,
        "language": session.get("language", "uz"),
        "bot_username": bot_username,
        "bot_url": f"https://t.me/{bot_username}?start=demo_{sid}",
        "ai_enabled": sales_ai.provider != "none",
        "telegram_linked": bool(session.get("telegram_chat_id")),
        "telegram_username": session.get("telegram_username"),
        "orders": session.get("orders", []),
        "messages": msgs,
        "latest_seq": session.get("messages", [{}])[-1].get("seq", 0) if session.get("messages") else 0,
    }


def _append_message(
    session: dict[str, Any],
    *,
    sender_role: str,
    sender_name: str,
    via: str,
    text: str,
    quoted: dict[str, str] | None = None,
    order: dict[str, Any] | None = None,
) -> dict[str, Any]:
    seq = int(session.get("next_seq", len(session.get("messages", [])) + 1))
    session["next_seq"] = seq + 1
    msg = {
        "id": f"msg_{secrets.token_hex(4)}",
        "seq": seq,
        "from": sender_role,
        "sender_name": sender_name,
        "via": via,
        "text": text,
        "ts": _now_hhmm(),
        "quoted": quoted,
        "order": order,
    }
    session.setdefault("messages", []).append(msg)
    _save_demo_session(session)
    publish_demo_event(session["session_id"], "message", msg)
    return msg


async def _generate_ai_reply(
    session: dict[str, Any],
    user_text: str,
    *,
    product_id: str | None = None,
) -> dict[str, Any]:
    matches = search_demo_catalog(user_text, product_id=product_id or session.get("last_product_id"), limit=5)
    if matches:
        session["last_product_id"] = matches[0]["id"]

    lang = session.get("language", "uz")
    context_posts = [
        ChannelPost(
            id=idx + 1,
            organization_id=1,
            channel_username="Test_pcssss",
            telegram_message_id=idx + 1,
            text=f"{p['id']} | {p['name']} | {p['specs']} | Narxi: {fmt_uzs(p['price'])} | Ombor: {p['stock']} dona | Kafolat: {p['warranty']}",
            image_description=f"{p['name']} ({p['category']})",
            source_url=f"https://t.me/Test_pcssss/{idx + 1}",
        )
        for idx, p in enumerate(matches)
    ]
    history = [
        {
            "role": "customer" if m["from"] == "user" else "assistant",
            "text": m["text"],
        }
        for m in session.get("messages", [])[-8:]
    ]

    demo_prompt = (
        "Sen TechZone UZ do'konining JONLI DEMO AI savdo maslahatchisisan (katalog: 100 ta noutbuk, PC, monitor va aksessuar). "
        "Mijozga do'stona, qisqa, tabiiy va professional insondek javob ber — robotik iboralar va ortiqcha emojilardan qoch. "
        "Agar mijoz mahsulot buyurtma bermoqchi bo'lsa va hali ismi + telefon raqamini bermagan bo'lsa, buyurtma formasidan foydalanishini "
        "yoki shu chatda ismi hamda telefon raqamini yozib qoldirishini muloyim taklif qil. "
        f"Javob tili: {lang}."
    )

    if sales_ai.provider != "none":
        try:
            ai_res = await sales_ai.answer(
                user_text,
                context=context_posts,
                history=history,
                organization_id=None,
                db=None,
                custom_prompt_override=demo_prompt,
                track_usage=False,
                extra_products=[
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "specs": p["specs"],
                        "price_uzs": fmt_uzs(p["price"]),
                        "stock": p["stock"],
                        "warranty": p["warranty"],
                    }
                    for p in matches
                ],
            )
            if ai_res.get("intent") not in {"error", "api_key_missing"} and ai_res.get("reply"):
                return {
                    "reply": ai_res["reply"],
                    "order_created": bool(ai_res.get("order_created")),
                    "order_data": ai_res.get("order_data"),
                    "matched_product": matches[0] if matches else None,
                }
        except Exception as exc:
            logger.warning("Demo AI live generation fell back to catalog matcher: %s", exc)

    return {
        "reply": build_demo_fallback_reply(user_text, matches, language=lang),
        "order_created": False,
        "order_data": None,
        "matched_product": matches[0] if matches else None,
    }


async def process_demo_chat(
    session_id: str,
    text: str,
    *,
    product_id: str | None = None,
    language: str | None = None,
    origin_via: str = "web",
) -> dict[str, Any]:
    session = get_demo_session(session_id)
    if session is None:
        raise KeyError("Demo sessiyasi topilmadi")
    if language in {"uz", "ru", "en"}:
        session["language"] = language

    clean_text = text.strip()[:1200]
    pinned = get_demo_product(product_id)
    quoted = (
        {"name": pinned["name"], "text": f"{fmt_uzs(pinned['price'])} · {pinned['specs'].split('|')[0].strip()}"}
        if pinned
        else None
    )

    user_msg = _append_message(
        session,
        sender_role="user",
        sender_name=session.get("telegram_full_name") or "Siz",
        via=origin_via,
        text=clean_text,
        quoted=quoted,
    )

    publish_demo_event(session_id, "typing", {"active": True, "sender": "Selloi AI"})
    try:
        ai_out = await _generate_ai_reply(session, clean_text, product_id=product_id)
    finally:
        publish_demo_event(session_id, "typing", {"active": False})

    order_payload = None
    if ai_out.get("order_created") and isinstance(ai_out.get("order_data"), dict):
        order_data = ai_out["order_data"]
        matched = ai_out.get("matched_product") or pinned or DEMO_PRODUCTS[0]
        return await place_demo_order(
            session_id=session_id,
            product_id=matched["id"],
            customer_name=str(order_data.get("customer_name") or "Demo mijoz"),
            phone=str(order_data.get("phone") or "+998900000000"),
            address=str(order_data.get("delivery_address") or "Toshkent"),
            emit_user_message=False,
            user_message_ref=user_msg,
        )

    bot_msg = _append_message(
        session,
        sender_role="bot",
        sender_name="Selloi AI",
        via="ai",
        text=ai_out["reply"],
    )

    # Mirror AI reply to linked Telegram chat when user connected @Selloi_ai_bot
    if origin_via == "web" and session.get("telegram_chat_id") and settings.telegram_bot_token:
        try:
            await telegram.call(
                "sendMessage",
                {
                    "chat_id": int(session["telegram_chat_id"]),
                    "text": ai_out["reply"],
                },
            )
        except Exception as exc:
            logger.debug("Demo TG mirror skipped: %s", exc)

    return {
        "ok": True,
        "user_message": user_msg,
        "bot_message": bot_msg,
        "order": order_payload,
    }


async def _dispatch_order_via_telegram_bot(
    session: dict[str, Any],
    order: dict[str, Any],
) -> bool:
    """Send real Telegram notifications via @Selloi_ai_bot and record reply mapping."""
    if not settings.telegram_bot_token:
        return False

    sid = session["session_id"]
    order_code = order["order_code"]
    safe_prod = _html.escape(order["product_name"])
    safe_cust = _html.escape(order["customer_name"])
    safe_phone = _html.escape(order["phone"])
    safe_addr = _html.escape(order["address"])
    price_str = fmt_uzs(order["price"])

    sent_any = False

    # 1) Direct message to visitor's Telegram chat if visitor linked @Selloi_ai_bot?start=demo_<sid>
    tg_chat_id = session.get("telegram_chat_id")
    if tg_chat_id:
        try:
            res = await telegram.call(
                "sendMessage",
                {
                    "chat_id": int(tg_chat_id),
                    "text": (
                        f"<b>Buyurtmangiz qabul qilindi — {order_code}</b>\n\n"
                        f"Mahsulot: <b>{safe_prod}</b>\n"
                        f"Narxi: {price_str} ({_html.escape(order['warranty'])} kafolat)\n"
                        f"Mijoz: {safe_cust} ({safe_phone})\n"
                        f"Manzil: {safe_addr}\n\n"
                        "Pastdagi tugmalardan foydalansangiz yoki shu chatga javob yozsangiz, "
                        "web-demoda ham darhol ko'rinadi."
                    ),
                    "parse_mode": "HTML",
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {"text": "Tasdiqlayman", "callback_data": f"demo:confirm:{sid}:{order_code}"},
                                {"text": "12 oy nasiya", "callback_data": f"demo:credit:{sid}:{order_code}"},
                            ],
                        ]
                    },
                },
            )
            if isinstance(res, dict) and res.get("message_id"):
                _save_alert_mapping(int(tg_chat_id), int(res["message_id"]), sid)
                sent_any = True
        except Exception as exc:
            logger.debug("Demo user TG send failed: %s", exc)

    # 2) Owner alert so admin can tap quick-reply buttons or Reply back live into the web demo
    owner_id = settings.admin_telegram_id
    if owner_id and int(owner_id) != int(tg_chat_id or 0):
        try:
            res = await telegram.call(
                "sendMessage",
                {
                    "chat_id": int(owner_id),
                    "text": (
                        f"<b>Yangi Demo Buyurtma — {order_code}</b> [demo:{sid}]\n\n"
                        f"Mahsulot: <b>{safe_prod}</b>\n"
                        f"Summa: {price_str}\n"
                        f"Mijoz: {safe_cust} · {safe_phone}\n"
                        f"Manzil: {safe_addr}\n\n"
                        "<i>Ushbu xabarga Reply qilsangiz yoki tugmani bossangiz, "
                        "web-saytdagi mijozga @Selloi_ai_bot nomidan real vaqtda javob boradi.</i>"
                    ),
                    "parse_mode": "HTML",
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {"text": "Tasdiqlandi", "callback_data": f"demo:confirm:{sid}:{order_code}"},
                                {"text": "Kuryer yo'lda", "callback_data": f"demo:courier:{sid}:{order_code}"},
                            ],
                        ]
                    },
                },
            )
            if isinstance(res, dict) and res.get("message_id"):
                _save_alert_mapping(int(owner_id), int(res["message_id"]), sid)
                sent_any = True
        except Exception as exc:
            logger.debug("Demo owner TG notify failed: %s", exc)

    return sent_any


async def place_demo_order(
    session_id: str,
    *,
    product_id: str,
    customer_name: str,
    phone: str,
    address: str = "Toshkent",
    emit_user_message: bool = True,
    user_message_ref: dict[str, Any] | None = None,
) -> dict[str, Any]:
    session = get_demo_session(session_id)
    if session is None:
        raise KeyError("Demo sessiyasi topilmadi")

    product = get_demo_product(product_id) or DEMO_PRODUCTS[0]
    session["last_product_id"] = product["id"]
    clean_name = customer_name.strip()[:80] or "Mehmon"
    clean_phone = phone.strip()[:32]
    clean_addr = address.strip()[:120] or "Toshkent"
    order_code = f"#SL-{1000 + secrets.randbelow(8999)}"
    lang = session.get("language", "uz")

    order = {
        "order_code": order_code,
        "product_id": product["id"],
        "product_name": product["name"],
        "price": product["price"],
        "warranty": product["warranty"],
        "stock": product["stock"],
        "customer_name": clean_name,
        "phone": clean_phone,
        "address": clean_addr,
        "status": "Tasdiqlandi" if lang == "uz" else ("Принят" if lang == "ru" else "Confirmed"),
        "bot_notified": False,
        "created_at": time.time(),
    }

    u_msg = user_message_ref
    if emit_user_message:
        order_req_text = {
            "uz": f"{product['name']} uchun buyurtma — {clean_name}, {clean_phone} ({clean_addr})",
            "ru": f"Заказ на {product['name']} — {clean_name}, {clean_phone} ({clean_addr})",
            "en": f"Order for {product['name']} — {clean_name}, {clean_phone} ({clean_addr})",
        }[lang]
        u_msg = _append_message(
            session,
            sender_role="user",
            sender_name=clean_name,
            via="web",
            text=order_req_text,
            quoted={"name": product["name"], "text": fmt_uzs(product["price"])},
        )

    publish_demo_event(session_id, "typing", {"active": True, "sender": "@Selloi_ai_bot"})
    bot_username = await get_bot_username()
    bot_sent = await _dispatch_order_via_telegram_bot(session, order)
    order["bot_notified"] = bot_sent
    session.setdefault("orders", []).append(order)
    _save_demo_session(session)
    publish_demo_event(session_id, "typing", {"active": False})

    price_str = fmt_uzs(product["price"])
    ru_price_str = price_str.replace("so'm", "сум")
    reply_texts = {
        "uz": (
            f"@{bot_username} orqali buyurtma {order_code} rasmiylashtirildi.\n\n"
            f"Mahsulot: {product['name']}\n"
            f"Summa: {price_str} · Kafolat: {product['warranty']}\n"
            f"Mijoz: {clean_name} ({clean_phone}) · {clean_addr}\n\n"
            "Menejerimiz bog'lanib yetkazib berish vaqtini aniqlashtiradi."
        ),
        "ru": (
            f"Заказ {order_code} оформлен через @{bot_username}.\n\n"
            f"Товар: {product['name']}\n"
            f"Сумма: {ru_price_str} · Гарантия: {product['warranty']}\n"
            f"Покупатель: {clean_name} ({clean_phone}) · {clean_addr}\n\n"
            "Менеджер свяжется с вами для уточнения времени доставки."
        ),
        "en": (
            f"Order {order_code} confirmed via @{bot_username}.\n\n"
            f"Item: {product['name']}\n"
            f"Total: {price_str} · Warranty: {product['warranty']}\n"
            f"Customer: {clean_name} ({clean_phone}) · {clean_addr}\n\n"
            "Our courier team will confirm your delivery window shortly."
        ),
    }

    bot_msg = _append_message(
        session,
        sender_role="bot",
        sender_name=f"@{bot_username}",
        via="telegram_bot",
        text=reply_texts[lang],
        quoted={
            "name": f"Buyurtma {order_code}",
            "text": u_msg["text"] if u_msg else f"{product['name']} ({price_str})",
        },
        order=order,
    )
    publish_demo_event(session_id, "order_created", order)

    return {
        "ok": True,
        "order": order,
        "user_message": u_msg,
        "bot_message": bot_msg,
    }


async def bind_telegram_chat_to_demo(
    session_id: str,
    *,
    chat_id: int,
    username: str | None,
    full_name: str,
) -> dict[str, Any] | None:
    session = get_demo_session(session_id)
    if session is None:
        return None
    clean_uname = (username or "").strip().lstrip("@")
    session["telegram_chat_id"] = int(chat_id)
    session["telegram_username"] = clean_uname or None
    session["telegram_full_name"] = full_name.strip() or None
    _bind_tg_chat_map(int(chat_id), session["session_id"])
    _save_demo_session(session)

    bot_username = await get_bot_username()
    publish_demo_event(
        session["session_id"],
        "telegram_linked",
        {
            "telegram_linked": True,
            "telegram_username": session["telegram_username"],
            "bot_username": bot_username,
        },
    )
    _append_message(
        session,
        sender_role="bot",
        sender_name=f"@{bot_username}",
        via="telegram_bot",
        text=(
            f"Telegram hisobingiz (@{clean_uname}) jonli demo bilan ulandi. "
            "Endi saytda bergan buyurtmalaringiz botga ham boradi, botdagi javoblar esa shu yerda ko'rinadi."
            if clean_uname
            else "Telegram hisobingiz jonli demo bilan ulandi. Endi buyurtma va javoblar ikki tomonda sinxron ishlaydi."
        ),
    )
    return session


async def push_telegram_reply_to_demo(
    session_id: str,
    *,
    text: str,
    sender_label: str | None = None,
) -> dict[str, Any] | None:
    session = get_demo_session(session_id)
    if session is None:
        return None
    bot_username = await get_bot_username()
    return _append_message(
        session,
        sender_role="bot",
        sender_name=sender_label or f"@{bot_username}",
        via="telegram_bot",
        text=text.strip()[:1200],
    )


async def handle_demo_telegram_callback(data: str) -> tuple[bool, str]:
    """Process demo:<action>:<session_id>:<order_code> callbacks from Telegram."""
    parts = data.split(":", 3)
    if len(parts) < 4:
        return False, "Demo ma'lumoti to'liq emas"
    _, action, sid, order_code = parts
    session = get_demo_session(sid)
    if session is None:
        return False, "Demo sessiyasi muddati tugagan"

    bot_username = await get_bot_username()
    target_order = next((o for o in session.get("orders", []) if o.get("order_code") == order_code), None)
    prod_name = target_order["product_name"] if target_order else "Tanlangan mahsulot"

    if action == "confirm":
        if target_order:
            target_order["status"] = "Operator tasdiqladi"
            _save_demo_session(session)
        msg_text = f"Buyurtma {order_code} ({prod_name}) @{bot_username} orqali tasdiqlandi va jo'natishga tayyorlandi."
        toast = f"{order_code} web demoga tasdiqlandi"
    elif action == "courier":
        if target_order:
            target_order["status"] = "Kuryer yo'lda"
            _save_demo_session(session)
        msg_text = f"Buyurtma {order_code} uchun kuryer tayinlandi — yetkazib berish 2 soat ichida amalga oshiriladi."
        toast = f"{order_code} kuryer holati web demoga yuborildi"
    elif action == "credit":
        monthly = fmt_uzs(round((target_order["price"] if target_order else 20_000_000) / 12))
        msg_text = f"{order_code} bo'yicha 12 oylik nasiya rejasi: oyiga ~{monthly}. Boshlang'ich to'lovsiz."
        toast = "Nasiya jadvali web demoga yuborildi"
    else:
        return False, "Noma'lum amal"

    _append_message(
        session,
        sender_role="bot",
        sender_name=f"@{bot_username}",
        via="telegram_bot",
        text=msg_text,
        quoted={"name": f"Buyurtma {order_code}", "text": prod_name},
        order=target_order,
    )
    return True, toast
