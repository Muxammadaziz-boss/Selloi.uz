"""Tests for Telegram voice/audio transcription and business webhook voice reply flow."""

from types import SimpleNamespace
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import webhooks
from app.models import Base, BusinessConnection, Conversation, Message, Organization
from app.services.ai import SalesAI
from app.services.telegram import TelegramAPIError, TelegramService


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_telegram_download_file_bytes_enforces_size_limit(monkeypatch):
    svc = TelegramService("123:test_token")

    async def _fake_call_too_big(method, data):
        assert method == "getFile"
        return {"file_id": data["file_id"], "file_size": 25 * 1024 * 1024, "file_path": "voice/big.oga"}

    monkeypatch.setattr(svc, "call", _fake_call_too_big)
    with pytest.raises(TelegramAPIError):
        await svc.download_file_bytes("voice_big")


@pytest.mark.asyncio
async def test_sales_ai_transcribe_audio_gemini(monkeypatch):
    ai = SalesAI()
    ai.gemini_key = "test-gemini-key"

    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "candidates": [{
                    "content": {"parts": [{"text": "Assalomu alaykum, Asus TUF narxi necha pul?"}]}
                }]
            }

    class FakeHttpClient:
        async def post(self, url, json, timeout):
            assert "generateContent" in url
            parts = json["contents"][0]["parts"]
            assert parts[1]["inline_data"]["mime_type"] == "audio/ogg"
            return FakeResp()

    monkeypatch.setattr(ai, "_get_http_client", lambda: FakeHttpClient())
    transcript = await ai.transcribe_audio(b"OggS-fake-audio-bytes", mime_type="audio/ogg")
    assert transcript == "Assalomu alaykum, Asus TUF narxi necha pul?"


@pytest.mark.asyncio
async def test_business_webhook_transcribes_voice_and_answers(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "voice_wh.db")
    try:
        async with SessionFactory() as db:
            org = Organization(name="Voice Shop", slug="voice-shop")
            db.add(org)
            await db.flush()
            bc = BusinessConnection(
                id="bc-voice-1",
                organization_id=org.id,
                owner_user_id=999999,
                is_enabled=True,
                rights={"can_reply": True},
            )
            db.add(bc)
            await db.commit()
            org_id = org.id

        class FakeTg:
            async def read_business_message(self, *args, **kwargs):
                return True

            async def send_chat_action(self, *args, **kwargs):
                return True

            async def download_file_bytes(self, file_id):
                assert file_id == "voice-file-123"
                return b"fake-ogg-voice", "voice/file_123.oga"

        ai_inputs = []

        async def _fake_transcribe(audio_bytes, *, mime_type="audio/ogg", organization_id=None, db=None):
            assert audio_bytes == b"fake-ogg-voice"
            assert mime_type == "audio/ogg"
            assert organization_id == org_id
            return "HP Victus bormi, narxi qancha?"

        async def _fake_search(db, query, limit=6, organization_id=None):
            ai_inputs.append(("search", query))
            return []

        async def _fake_answer(customer_text, context, history, organization_id=None, db=None):
            ai_inputs.append(("answer", customer_text))
            return {
                "reply": "Ha, HP Victus mavjud! Narxi 750$.",
                "handoff": False,
                "reason": None,
                "intent": "product_question",
                "order_created": False,
                "order_data": None,
                "attach_photo": False,
                "source_post_id": None,
            }

        monkeypatch.setattr(webhooks, "get_telegram_service", lambda _tok: FakeTg())
        monkeypatch.setattr(webhooks.sales_ai, "transcribe_audio", _fake_transcribe)
        monkeypatch.setattr(webhooks.knowledge, "search", _fake_search)
        monkeypatch.setattr(webhooks.sales_ai, "answer", _fake_answer)

        staged = []
        from app.services import durable_inbox
        async def _fake_stage(db, *, idempotency_key, event_type, payload, organization_id=None):
            staged.append((event_type, payload))
        monkeypatch.setattr(durable_inbox, "stage_outbox_event", _fake_stage)

        voice_msg = {
            "message_id": 505,
            "business_connection_id": "bc-voice-1",
            "chat": {"id": 444555, "type": "private"},
            "from": {"id": 444555, "first_name": "Dilmurod", "username": "dilmurod_v"},
            "voice": {"file_id": "voice-file-123", "duration": 6, "mime_type": "audio/ogg"},
        }

        async with SessionFactory() as db:
            await webhooks._handle_business_message(voice_msg, db=db)
            await db.commit()

            conv = (await db.execute(select(Conversation).where(Conversation.organization_id == org_id))).scalar_one()
            # Voice message stayed in AI active flow instead of blind human_takeover!
            assert conv.status == "ai_active"
            saved_msg = (await db.execute(select(Message).where(Message.conversation_id == conv.id))).scalar_one()
            assert "HP Victus bormi, narxi qancha?" in saved_msg.text

        assert ai_inputs[0] == ("search", "🎤 HP Victus bormi, narxi qancha?")
        assert ai_inputs[1] == ("answer", "🎤 HP Victus bormi, narxi qancha?")
        assert any(evt == "send_business_text" and "750$" in payload["text"] for evt, payload in staged)
    finally:
        await engine.dispose()
