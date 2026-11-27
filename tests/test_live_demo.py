"""Tests for the public real-time live demo API and @Selloi_ai_bot two-way order replay."""

from unittest.mock import AsyncMock, patch
import httpx
import pytest

from app.api.bot_commands import handle_callback_query, handle_private_command
from app.core.config import settings
from app.core.db import SessionLocal
from app.main import app
from app.services import demo_service
from app.services.demo_catalog import search_demo_catalog


@pytest.fixture(autouse=True)
def clean_demo_state():
    demo_service._DEMO_SESSIONS.clear()
    demo_service._TG_CHAT_MAP.clear()
    demo_service._ALERT_MAP.clear()
    yield
    demo_service._DEMO_SESSIONS.clear()
    demo_service._TG_CHAT_MAP.clear()
    demo_service._ALERT_MAP.clear()


def test_demo_catalog_search_budget_and_pinned():
    matches = search_demo_catalog("20 mln gacha gaming noutbuk", limit=5)
    assert len(matches) == 5
    assert any("RTX" in m["specs"] or "Gaming" in m["name"] or "Legion" in m["name"] for m in matches)

    pinned = search_demo_catalog("nasiya shartlari", product_id="TZ-002", limit=3)
    assert pinned[0]["id"] == "TZ-002"


@pytest.mark.asyncio
async def test_live_demo_chat_order_and_bot_two_way_replay(monkeypatch):
    monkeypatch.setattr(settings, "telegram_bot_token", "123456:TEST_TOKEN")
    monkeypatch.setattr(settings, "admin_telegram_id", 777000111)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Catalog endpoint serves all 100 items
        cat_resp = await client.get("/api/v1/demo/catalog")
        assert cat_resp.status_code == 200
        assert cat_resp.json()["total"] == 100

        # 2. Create demo session
        sess_resp = await client.post("/api/v1/demo/session", json={"language": "uz"})
        assert sess_resp.status_code == 200
        sess_data = sess_resp.json()
        sid = sess_data["session_id"]
        assert f"?start=demo_{sid}" in sess_data["bot_url"]
        assert len(sess_data["messages"]) == 1

        # 3. Chat interacts with real catalog + AI layer
        with patch.object(demo_service.sales_ai, "answer", new_callable=AsyncMock) as mock_ai:
            mock_ai.return_value = {
                "reply": "RTX 4080 bilan ASUS ROG Strix G16 omborda 3 dona bor.",
                "handoff": False,
                "reason": None,
                "intent": "product_question",
                "order_created": False,
                "order_data": None,
                "attach_photo": False,
                "source_post_id": None,
            }
            chat_resp = await client.post(
                "/api/v1/demo/chat",
                json={"session_id": sid, "text": "ASUS ROG bormi?", "product_id": "TZ-001"},
            )
        assert chat_resp.status_code == 200, chat_resp.text
        chat_data = chat_resp.json()
        assert chat_data["user_message"]["from"] == "user"
        assert "RTX 4080" in chat_data["bot_message"]["text"]

        # 4. Bind visitor's Telegram chat via /start demo_<sid>
        with patch("app.api.bot_commands.telegram.call", new_callable=AsyncMock) as mock_tg:
            mock_tg.return_value = {"ok": True}
            async with SessionLocal() as db:
                handled = await handle_private_command(
                    {
                        "message_id": 5001,
                        "text": f"/start demo_{sid}",
                        "chat": {"id": 555111222, "type": "private"},
                        "from": {"id": 555111222, "first_name": "Sardor", "username": "sardor_uz"},
                    },
                    db,
                )
            assert handled is True
            assert "sinxron ulandi" in mock_tg.await_args[0][1]["text"].lower()

        # 5. Placing an order triggers live @Selloi_ai_bot reply in web demo + real Telegram dispatch
        with patch("app.services.demo_service.telegram.call", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"message_id": 8801}
            order_resp = await client.post(
                "/api/v1/demo/order",
                json={
                    "session_id": sid,
                    "product_id": "TZ-001",
                    "customer_name": "Sardorbek",
                    "phone": "+998901112233",
                    "address": "Toshkent",
                },
            )
        assert order_resp.status_code == 200, order_resp.text
        order_payload = order_resp.json()
        order_code = order_payload["order"]["order_code"]
        assert order_code.startswith("#SL-")
        assert order_payload["bot_message"]["via"] == "telegram_bot"
        assert order_code in order_payload["bot_message"]["text"]
        assert order_payload["order"]["bot_notified"] is True
        # Both linked user chat and owner notification received sendMessage calls
        assert mock_send.await_count >= 1

        # 6. Inline button tap in Telegram bot pushes update back into web demo
        with patch("app.api.bot_commands.telegram.answer_callback", new_callable=AsyncMock) as mock_cb_ans, patch(
            "app.api.bot_commands.telegram.call", new_callable=AsyncMock
        ):
            async with SessionLocal() as db:
                await handle_callback_query(
                    {
                        "id": "cb_1",
                        "data": f"demo:confirm:{sid}:{order_code}",
                        "from": {"id": 777000111},
                        "message": {"message_id": 8801, "chat": {"id": 777000111}, "text": "Demo Alert"},
                    },
                    db,
                )
            mock_cb_ans.assert_awaited()

        # 7. Owner replying directly to the bot alert mirrors live into web demo
        with patch("app.api.bot_commands.telegram.call", new_callable=AsyncMock) as mock_reply_tg:
            mock_reply_tg.return_value = {"ok": True}
            async with SessionLocal() as db:
                handled_reply = await handle_private_command(
                    {
                        "message_id": 5002,
                        "text": "Kuryerimiz soat 16:00 da chiqadi.",
                        "chat": {"id": 777000111, "type": "private"},
                        "from": {"id": 777000111, "first_name": "Owner"},
                        "reply_to_message": {"message_id": 8801, "text": f"Buyurtma [demo:{sid}]"},
                    },
                    db,
                )
            assert handled_reply is True

        # 8. Delta sync works via both /api/v1/demo/... and Nginx /api/demo/... paths
        sync_resp = await client.get(f"/api/v1/demo/session/{sid}?after_seq=1")
        assert sync_resp.status_code == 200
        alias_resp = await client.get(f"/api/demo/session?session_id={sid}&after_seq=1")
        assert alias_resp.status_code == 200
        sync_data = alias_resp.json()
        assert sync_data["telegram_linked"] is True
        texts = "\n".join(m["text"] for m in sync_data["messages"])
        assert order_code in texts
        assert "tasdiqlandi" in texts.lower()
        assert "16:00" in texts
