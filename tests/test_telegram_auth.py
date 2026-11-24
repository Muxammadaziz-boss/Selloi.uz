import pytest
import httpx
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone
from app.main import app
from app.services.telegram_auth import (
    create_auth_session,
    check_auth_session,
    consume_auth_session,
    verify_auth_session,
    _AUTH_SESSIONS,
)
from app.api.bot_commands import handle_private_command
from app.core.db import SessionLocal


@pytest.fixture(autouse=True)
def clean_auth_sessions():
    """Ensure in-memory sessions are cleared between test cases."""
    _AUTH_SESSIONS.clear()
    yield
    _AUTH_SESSIONS.clear()


@pytest.mark.asyncio
async def test_telegram_auth_service_non_destructive_polling():
    """Verify that polling a pending session never destroys or pops it from storage."""
    session = await create_auth_session()
    code = session["code"]
    assert code in _AUTH_SESSIONS
    assert _AUTH_SESSIONS[code]["status"] == "pending"

    # 1. Polling a pending session must return None from consume without deleting
    assert consume_auth_session(code) is None
    assert code in _AUTH_SESSIONS
    assert check_auth_session(code)["status"] == "pending"

    # 2. Multiple rapid polls must preserve the pending session
    for _ in range(5):
        assert consume_auth_session(code) is None
        assert check_auth_session(code)["status"] == "pending"

    # 3. Verification works with auth_ prefix and case-insensitivity
    verified = verify_auth_session(
        f"auth_{code.upper()}",
        telegram_id=12345678,
        username="testuser",
        full_name="Test User",
    )
    assert verified is True
    assert check_auth_session(code)["status"] == "verified"

    # 4. Consuming a verified session returns user data and enters grace window
    auth_data = consume_auth_session(code)
    assert auth_data is not None
    assert auth_data["telegram_id"] == 12345678
    assert auth_data["username"] == "testuser"
    assert auth_data["full_name"] == "Test User"

    # 5. Immediate retry poll within grace window still succeeds
    retry_data = consume_auth_session(code)
    assert retry_data is not None
    assert retry_data["telegram_id"] == 12345678


@pytest.mark.asyncio
async def test_telegram_auth_unknown_session():
    """Verify behavior on non-existent or expired code."""
    assert check_auth_session("non_existent_code") is None
    assert consume_auth_session("non_existent_code") is None
    assert verify_auth_session("non_existent_code", 111, "u", "Name") is False


@pytest.mark.anyio
async def test_telegram_auth_api_flow_end_to_end():
    """Full end-to-end HTTP integration: init -> repeated poll -> bot verify -> poll verify -> auth/me."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Initialize auth session
        init_resp = await client.post("/api/v1/auth/telegram/init")
        assert init_resp.status_code == 200, init_resp.text
        init_data = init_resp.json()
        assert "code" in init_data
        assert "bot_url" in init_data
        code = init_data["code"]

        # Step 2: Poll while pending (must return HTTP 200 {"status": "pending"}, NOT 404)
        for _ in range(3):
            poll_resp = await client.post("/api/v1/auth/telegram/poll", json={"code": code})
            assert poll_resp.status_code == 200, poll_resp.text
            assert poll_resp.json() == {"status": "pending"}

        # Step 3: Simulate Telegram bot /start auth_<code> execution
        dummy_tg_id = 778899001
        dummy_username = f"tg_bot_user_{int(datetime.now(timezone.utc).timestamp())}"
        msg = {
            "message_id": 9999,
            "text": f"/start auth_{code}",
            "chat": {"id": dummy_tg_id, "type": "private"},
            "from": {
                "id": dummy_tg_id,
                "first_name": "Alisher",
                "last_name": "Navoiy",
                "username": dummy_username,
            },
        }

        with patch("app.api.bot_commands.telegram.call", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {"ok": True}
            async with SessionLocal() as db:
                handled = await handle_private_command(msg, db)
                assert handled is True
                mock_call.assert_awaited()
                call_args = mock_call.await_args[0]
                assert call_args[0] == "sendMessage"
                assert "kirish tasdiqlandi" in call_args[1]["text"].lower()

        # Step 4: Next poll after verification must return verified with JWT access token
        final_poll = await client.post("/api/v1/auth/telegram/poll", json={"code": code})
        assert final_poll.status_code == 200, final_poll.text
        final_data = final_poll.json()
        assert final_data["status"] == "verified"
        assert "access_token" in final_data
        assert final_data["telegram_user_id"] == dummy_tg_id
        assert final_data["username"] == dummy_username
        access_token = final_data["access_token"]

        # Step 5: Verify access token works with protected /api/v1/auth/me endpoint
        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_resp.status_code == 200, me_resp.text
        me_data = me_resp.json()
        assert me_data["telegram_user_id"] == dummy_tg_id


@pytest.mark.asyncio
async def test_bot_command_start_auth_invalid_or_expired_notice():
    """Verify that bot properly notifies the user when an auth code is unknown or expired."""
    msg = {
        "message_id": 9998,
        "text": "/start auth_non_existent_code_999",
        "chat": {"id": 12345, "type": "private"},
        "from": {
            "id": 12345,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser",
        },
    }

    with patch("app.api.bot_commands.telegram.call", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = {"ok": True}
        async with SessionLocal() as db:
            handled = await handle_private_command(msg, db)
            assert handled is True
            mock_call.assert_awaited()
            call_args = mock_call.await_args[0]
            assert call_args[0] == "sendMessage"
            assert "topilmadi yoki muddati tugagan" in call_args[1]["text"].lower()
