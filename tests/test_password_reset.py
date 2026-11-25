"""Tests for Telegram-based password reset OTP flow, attempt lockouts, expiry, and JWT revocation."""

from datetime import datetime, timedelta, timezone
import re
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.security import hash_password, reset_rate_limit, verify_password
from app.main import app
from app.models import AuditLog, Base, PasswordResetToken, User
from app.services import telegram as telegram_module


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


class _DummyTelegram:
    def __init__(self):
        self.sent: list[tuple[int | str, str]] = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))
        return {"message_id": len(self.sent)}


@pytest.mark.asyncio
async def test_forgot_password_non_enumerating_and_hashed_storage(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "pw_forgot.db")
    dummy_tg = _DummyTelegram()
    monkeypatch.setattr(telegram_module, "telegram", dummy_tg)

    async def _override_get_db():
        async with SessionFactory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    for email_key in ("linked@example.uz", "unlinked@example.uz", "missing@example.uz"):
        reset_rate_limit(f"forgot_pw:{email_key}")

    try:
        async with SessionFactory() as db:
            db.add_all([
                User(
                    email="linked@example.uz",
                    hashed_password=hash_password("OldPass123"),
                    full_name="Linked User",
                    telegram_user_id=777001,
                    is_active=True,
                ),
                User(
                    email="unlinked@example.uz",
                    hashed_password=hash_password("OldPass123"),
                    full_name="Unlinked User",
                    telegram_user_id=None,
                    is_active=True,
                ),
            ])
            await db.commit()

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            r_linked = await client.post("/api/v1/auth/forgot-password", json={"email": "LINKED@example.uz"})
            r_unlinked = await client.post("/api/v1/auth/forgot-password", json={"email": "unlinked@example.uz"})
            r_missing = await client.post("/api/v1/auth/forgot-password", json={"email": "missing@example.uz"})

        assert r_linked.status_code == 200
        assert r_unlinked.status_code == 200
        assert r_missing.status_code == 200
        assert r_linked.json() == r_unlinked.json() == r_missing.json()
        assert len(dummy_tg.sent) == 1
        assert dummy_tg.sent[0][0] == 777001

        otp_match = re.search(r"\b(\d{6})\b", dummy_tg.sent[0][1])
        assert otp_match is not None
        plaintext_code = otp_match.group(1)

        async with SessionFactory() as db:
            tokens = (await db.execute(select(PasswordResetToken))).scalars().all()
            assert len(tokens) == 1
            assert tokens[0].code_hash != plaintext_code
            assert plaintext_code not in tokens[0].code_hash
            audit = (
                await db.execute(select(AuditLog).where(AuditLog.action == "password_reset_requested"))
            ).scalar_one_or_none()
            assert audit is not None
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_reset_password_lockout_and_expiry(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "pw_lockout.db")
    dummy_tg = _DummyTelegram()
    monkeypatch.setattr(telegram_module, "telegram", dummy_tg)

    async def _override_get_db():
        async with SessionFactory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    reset_rate_limit("forgot_pw:lockout@example.uz")
    reset_rate_limit("reset_pw:lockout@example.uz")

    try:
        async with SessionFactory() as db:
            user = User(
                email="lockout@example.uz",
                hashed_password=hash_password("InitialPass1"),
                full_name="Lockout User",
                telegram_user_id=777002,
                is_active=True,
            )
            db.add(user)
            await db.commit()

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            req_res = await client.post("/api/v1/auth/forgot-password", json={"email": "lockout@example.uz"})
            assert req_res.status_code == 200

            # 4 wrong attempts -> HTTP 400; 5th wrong attempt -> HTTP 429 lockout
            for i in range(4):
                wrong_res = await client.post(
                    "/api/v1/auth/reset-password",
                    json={"email": "lockout@example.uz", "code": "000000", "new_password": "NewPassword99"},
                )
                assert wrong_res.status_code == 400, f"Unexpected status at attempt {i + 1}: {wrong_res.text}"

            lock_res = await client.post(
                "/api/v1/auth/reset-password",
                json={"email": "lockout@example.uz", "code": "000000", "new_password": "NewPassword99"},
            )
            assert lock_res.status_code == 429

            # Request fresh code, then expire it in DB and confirm HTTP 400 expiry rejection
            req_res_2 = await client.post("/api/v1/auth/forgot-password", json={"email": "lockout@example.uz"})
            assert req_res_2.status_code == 200
            second_code = re.search(r"\b(\d{6})\b", dummy_tg.sent[-1][1]).group(1)

            async with SessionFactory() as db:
                latest_token = (
                    await db.execute(select(PasswordResetToken).order_by(PasswordResetToken.id.desc()).limit(1))
                ).scalar_one()
                latest_token.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
                await db.commit()

            exp_res = await client.post(
                "/api/v1/auth/reset-password",
                json={"email": "lockout@example.uz", "code": second_code, "new_password": "NewPassword99"},
            )
            assert exp_res.status_code == 400
            assert "muddati tugagan" in exp_res.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_reset_password_success_and_session_invalidation(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "pw_success.db")
    dummy_tg = _DummyTelegram()
    monkeypatch.setattr(telegram_module, "telegram", dummy_tg)

    async def _override_get_db():
        async with SessionFactory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    for key in (
        "login:hero@example.uz",
        "forgot_pw:hero@example.uz",
        "reset_pw:hero@example.uz",
    ):
        reset_rate_limit(key)

    try:
        async with SessionFactory() as db:
            db.add(
                User(
                    email="hero@example.uz",
                    hashed_password=hash_password("OldSecret123"),
                    full_name="Hero Owner",
                    telegram_user_id=777003,
                    is_active=True,
                )
            )
            await db.commit()

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            old_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "hero@example.uz", "password": "OldSecret123"},
            )
            assert old_login.status_code == 200
            old_token = old_login.json()["access_token"]

            me_before = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})
            assert me_before.status_code == 200

            forgot_res = await client.post("/api/v1/auth/forgot-password", json={"email": "hero@example.uz"})
            assert forgot_res.status_code == 200
            otp_code = re.search(r"\b(\d{6})\b", dummy_tg.sent[0][1]).group(1)

            reset_res = await client.post(
                "/api/v1/auth/reset-password",
                json={"email": "hero@example.uz", "code": otp_code, "new_password": "BrandNewPass456"},
            )
            assert reset_res.status_code == 200
            assert reset_res.json()["ok"] is True

            # Prior session JWT must now be rejected because token_version incremented
            me_after = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})
            assert me_after.status_code == 401

            # Old password fails, new password succeeds
            bad_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "hero@example.uz", "password": "OldSecret123"},
            )
            assert bad_login.status_code == 401

            new_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "hero@example.uz", "password": "BrandNewPass456"},
            )
            assert new_login.status_code == 200

        async with SessionFactory() as db:
            user = (await db.execute(select(User).where(User.email == "hero@example.uz"))).scalar_one()
            assert verify_password("BrandNewPass456", user.hashed_password)
            assert user.token_version >= 2
            token_row = (await db.execute(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id))).scalar_one()
            assert token_row.used_at is not None
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
