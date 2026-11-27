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


@pytest.mark.asyncio
async def test_telegram_auth_redis_cross_worker_persistence():
    """Verify auth/link sessions survive process memory isolation when Redis is available."""
    fake_store: dict[str, str] = {}

    class _FakeRedis:
        def get(self, key: str):
            return fake_store.get(key)

        def set(self, key: str, value: str, ex: int | None = None):
            fake_store[key] = value
            return True

        def delete(self, key: str):
            fake_store.pop(key, None)
            return 1

    with patch("app.services.telegram_auth._get_redis_client", return_value=_FakeRedis()):
        created = await create_auth_session(purpose="link", user_id=42)
        code = created["code"]
        assert f"?start=link_{code}" in created["bot_url"]
        assert created["purpose"] == "link"

        # Simulate separate worker where _AUTH_SESSIONS does not hold the key locally
        _AUTH_SESSIONS.clear()
        assert check_auth_session(code)["status"] == "pending"

        # Cross-purpose verify must fail; matching purpose succeeds across workers
        assert verify_auth_session(f"link_{code}", 555666777, "workeruser", "Worker User", expected_purpose="login") is False
        assert verify_auth_session(f"link_{code}", 555666777, "workeruser", "Worker User", expected_purpose="link") is True

        _AUTH_SESSIONS.clear()
        assert consume_auth_session(code, expected_purpose="link", expected_user_id=99) is None
        consumed = consume_auth_session(code, expected_purpose="link", expected_user_id=42)
        assert consumed is not None
        assert consumed["telegram_id"] == 555666777


@pytest.mark.asyncio
async def test_telegram_account_link_and_unlink_flow(tmp_path):
    """Verify logged-in user can link @Selloi_ai_bot, prevent hijacking, greet in /start, and unlink."""
    import secrets
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from app.core.db import get_db
    from app.core.security import hash_password, reset_rate_limit
    from app.dependencies.auth import create_access_token
    from app.models import Base, User

    db_file = tmp_path / "tg_link.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    session_maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    prev_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    try:
        suffix = secrets.token_hex(4)
        tg_id = 880000000 + int(suffix[:6], 16) % 900000

        async with session_maker() as db:
            u1 = User(
                email=f"tg_link_u1_{suffix}@example.com",
                full_name="Birinchi Egasi",
                hashed_password=hash_password("Pass1234!"),
                email_verified=True,
                is_active=True,
            )
            u2 = User(
                email=f"tg_link_u2_{suffix}@example.com",
                full_name="Ikkinchi Egasi",
                hashed_password=hash_password("Pass1234!"),
                email_verified=True,
                is_active=True,
            )
            tg_only = User(
                email=f"tg_only_{suffix}@telegram.selloi.uz",
                full_name="Faqat Telegram",
                hashed_password="",
                telegram_user_id=tg_id + 999999,
                email_verified=True,
                is_active=True,
            )
            empty_stub = User(
                email=f"tg_stub_{suffix}@telegram.selloi.uz",
                full_name="Eski Stub",
                hashed_password="",
                telegram_user_id=tg_id,
                email_verified=True,
                is_active=True,
            )
            db.add_all([u1, u2, tg_only, empty_stub])
            await db.commit()
            await db.refresh(u1)
            await db.refresh(u2)
            await db.refresh(tg_only)
            u1_id, u1_email = u1.id, u1.email
            u2_id, u2_email = u2.id, u2.email
            tgo_id, tgo_email = tg_only.id, tg_only.email

        reset_rate_limit(f"tg_link_init:{u1_id}")
        reset_rate_limit(f"tg_link_init:{u2_id}")

        h1 = {"Authorization": f"Bearer {create_access_token(u1_id, u1_email)}"}
        h2 = {"Authorization": f"Bearer {create_access_token(u2_id, u2_email)}"}
        h_tgo = {"Authorization": f"Bearer {create_access_token(tgo_id, tgo_email)}"}

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            init_resp = await client.post("/api/v1/auth/telegram/link/init", headers=h1)
            assert init_resp.status_code == 200, init_resp.text
            init_data = init_resp.json()
            code = init_data["code"]
            assert f"?start=link_{code}" in init_data["bot_url"]

            # Cannot redeem a link code on the login poll endpoint
            bad_login_poll = await client.post("/api/v1/auth/telegram/poll", json={"code": code})
            assert bad_login_poll.status_code == 404

            pending_poll = await client.post("/api/v1/auth/telegram/link/poll", json={"code": code}, headers=h1)
            assert pending_poll.status_code == 200
            assert pending_poll.json() == {"status": "pending"}

            # Wrong user cannot poll another user's link session
            other_poll = await client.post("/api/v1/auth/telegram/link/poll", json={"code": code}, headers=h2)
            assert other_poll.status_code == 404

            msg_link = {
                "message_id": 9101,
                "text": f"/start link_{code}",
                "chat": {"id": tg_id, "type": "private"},
                "from": {"id": tg_id, "first_name": "Aziz", "last_name": "Karimov", "username": f"aziz_{suffix}"},
            }
            with patch("app.api.bot_commands.telegram.call", new_callable=AsyncMock) as mock_call:
                mock_call.return_value = {"ok": True}
                async with session_maker() as db:
                    handled = await handle_private_command(msg_link, db)
                    assert handled is True
                    assert "ulandi" in mock_call.await_args[0][1]["text"].lower()

            # Linking reclaims empty @telegram.selloi.uz stub safely
            done_poll = await client.post("/api/v1/auth/telegram/link/poll", json={"code": code}, headers=h1)
            assert done_poll.status_code == 200, done_poll.text
            done_data = done_poll.json()
            assert done_data["ok"] is True
            assert done_data["telegram_user_id"] == tg_id

            me_resp = await client.get("/api/v1/auth/me", headers=h1)
            assert me_resp.status_code == 200
            assert me_resp.json()["telegram_user_id"] == tg_id
            assert "bot_username" in me_resp.json()

            # Direct /start greets linked user cleanly
            msg_start = {
                "message_id": 9102,
                "text": "/start",
                "chat": {"id": tg_id, "type": "private"},
                "from": {"id": tg_id, "first_name": "Aziz", "username": f"aziz_{suffix}"},
            }
            with patch("app.api.bot_commands.telegram.call", new_callable=AsyncMock) as mock_call:
                mock_call.return_value = {"ok": True}
                async with session_maker() as db:
                    assert await handle_private_command(msg_start, db) is True
                    assert "selloi ai kabinetingizga ulangan" in mock_call.await_args[0][1]["text"].lower()

            # Second user trying to hijack the already-linked real account gets 409 Conflict
            init2 = (await client.post("/api/v1/auth/telegram/link/init", headers=h2)).json()
            assert verify_auth_session(init2["code"], tg_id, f"aziz_{suffix}", "Aziz", expected_purpose="link") is True
            conflict = await client.post("/api/v1/auth/telegram/link/poll", json={"code": init2["code"]}, headers=h2)
            assert conflict.status_code == 409

            # Telegram-only account without password cannot unlink (lockout protection)
            tgo_unlink = await client.post("/api/v1/auth/telegram/unlink", headers=h_tgo)
            assert tgo_unlink.status_code == 400

            # Email user can unlink safely
            unlink_resp = await client.post("/api/v1/auth/telegram/unlink", headers=h1)
            assert unlink_resp.status_code == 200
            assert unlink_resp.json()["telegram_user_id"] is None
    finally:
        if prev_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = prev_override
        await engine.dispose()

