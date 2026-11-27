"""Tests for 1-to-1 Telegram <-> Email unification, mandatory full verification, and 403 gating."""

import re
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.security import hash_password, reset_rate_limit
from app.dependencies.auth import create_access_token
from app.main import app
from app.models import Base, Organization, OrganizationMember, User
from app.services import email_service
from app.services.telegram_auth import create_auth_session, verify_auth_session


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_unverified_users_blocked_from_full_access_and_bind_email_unifies(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "unified_gate.db")
    sent_emails: list[dict] = []

    async def _fake_send_email(*, to_email: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
        sent_emails.append({"to": to_email, "subject": subject, "text": text_body})
        return True

    monkeypatch.setattr(email_service, "is_smtp_configured", lambda: True)
    monkeypatch.setattr(email_service, "send_email", _fake_send_email)

    async def _override_db():
        async with SessionFactory() as session:
            yield session

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = _override_db

    try:
        async with SessionFactory() as db:
            # Split user case: an unlinked Google/Gmail owner account + a Telegram-only owner account owning a shop
            gmail_stub = User(
                email="unify_owner@gmail.com",
                full_name="Azizbek",
                hashed_password="",
                email_verified=True,
                telegram_user_id=None,
                is_platform_owner=True,
                is_active=True,
            )
            org = Organization(name="Unified Shop", slug="unified-shop")
            db.add_all([gmail_stub, org])
            await db.flush()

            tg_only = User(
                email="aziz_tg@telegram.selloi.uz",
                full_name="Azizbek",
                hashed_password="",
                email_verified=True,  # stale/legacy flag that poll must not trust
                telegram_user_id=555444333,
                is_platform_owner=True,
                is_active=True,
            )
            db.add(tg_only)
            await db.flush()
            db.add(OrganizationMember(organization_id=org.id, user_id=tg_only.id, role="owner", is_active=True))

            other_full_user = User(
                email="taken_other@gmail.com",
                full_name="Other Bound",
                hashed_password=hash_password("OtherPass123"),
                email_verified=True,
                telegram_user_id=999888777,
                is_active=True,
            )
            db.add(other_full_user)
            await db.commit()
            gmail_id = gmail_stub.id
            tg_id = tg_only.id

        reset_rate_limit(f"bind_email_cooldown:{tg_id}")
        reset_rate_limit("bind_email_init:taken_other@gmail.com")
        reset_rate_limit("bind_email_init:unify_owner@gmail.com")

        gmail_headers = {"Authorization": f"Bearer {create_access_token(gmail_id, 'unify_owner@gmail.com')}"}

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 1. Email-verified user WITHOUT Telegram cannot access /admin or /organizations
            r_org_block = await client.get("/api/v1/organizations", headers=gmail_headers)
            assert r_org_block.status_code == 403
            assert r_org_block.json()["detail"]["missing_steps"] == ["telegram"]

            r_admin_block = await client.get("/admin/overview", headers=gmail_headers)
            assert r_admin_block.status_code == 403
            assert r_admin_block.json()["detail"]["error"] == "ACCOUNT_VERIFICATION_REQUIRED"

            # Direct PATCH /auth/profile spoofing telegram_user_id is rejected
            r_spoof = await client.patch(
                "/api/v1/auth/profile",
                headers=gmail_headers,
                json={"telegram_user_id": 555444333},
            )
            assert r_spoof.status_code == 400

            # 2. Telegram-only login reports email_verified=False and fully_verified=False
            sess = await create_auth_session(purpose="login")
            assert verify_auth_session(f"auth_{sess['code']}", 555444333, "aziz_tg", "Azizbek")
            poll_res = await client.post("/api/v1/auth/telegram/poll", json={"code": sess["code"]})
            assert poll_res.status_code == 200
            poll_data = poll_res.json()
            assert poll_data["email_verified"] is False
            assert poll_data["has_real_email"] is False
            assert poll_data["fully_verified"] is False
            assert poll_data["missing_steps"] == ["email"]

            tg_headers = {"Authorization": f"Bearer {poll_data['access_token']}"}
            r_tg_admin_block = await client.get("/admin/overview", headers=tg_headers)
            assert r_tg_admin_block.status_code == 403
            assert r_tg_admin_block.json()["detail"]["missing_steps"] == ["email"]

            # 3. Binding an email already linked to another Telegram account fails (409)
            r_conflict = await client.post(
                "/api/v1/auth/bind-email/init",
                headers=tg_headers,
                json={"email": "taken_other@gmail.com"},
            )
            assert r_conflict.status_code == 409

            # 4. Binding unify_owner@gmail.com sends 6-digit OTP and enforces 60s cooldown
            r_init = await client.post(
                "/api/v1/auth/bind-email/init",
                headers=tg_headers,
                json={"email": "unify_owner@gmail.com"},
            )
            assert r_init.status_code == 200
            assert len(sent_emails) == 1
            otp_code = re.search(r"\b(\d{6})\b", sent_emails[0]["text"]).group(1)

            r_cd = await client.post(
                "/api/v1/auth/bind-email/init",
                headers=tg_headers,
                json={"email": "unify_owner@gmail.com"},
            )
            assert r_cd.status_code == 429

            # 5. Confirming OTP unifies accounts (retains store ownership + owner role), grants full access
            r_confirm = await client.post(
                "/api/v1/auth/bind-email/confirm",
                headers=tg_headers,
                json={"email": "unify_owner@gmail.com", "code": otp_code},
            )
            assert r_confirm.status_code == 200
            c_data = r_confirm.json()
            assert c_data["fully_verified"] is True
            assert c_data["email"] == "unify_owner@gmail.com"
            assert c_data["telegram_user_id"] == 555444333

            unified_headers = {"Authorization": f"Bearer {c_data['access_token']}"}
            orgs_ok = await client.get("/api/v1/organizations", headers=unified_headers)
            assert orgs_ok.status_code == 200
            assert len(orgs_ok.json()) == 1
            assert orgs_ok.json()[0]["slug"] == "unified-shop"

            # Platform users list hides deactivated merged stub & marks unified account verified
            users_res = await client.get("/api/platform/users", headers=unified_headers)
            assert users_res.status_code == 200
            users_list = users_res.json()["users"]
            assert not any("@merged.selloi.uz" in u["email"] for u in users_list)
            assert any(
                u["email"] == "unify_owner@gmail.com"
                and u["telegram_user_id"] == 555444333
                and u["fully_verified"] is True
                and u["verification_status"] == "verified"
                for u in users_list
            )
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)
        await engine.dispose()


@pytest.mark.asyncio
async def test_google_link_user_id_enforces_one_to_one_and_unifies(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "google_link.db")

    async def _override_db():
        async with SessionFactory() as session:
            yield session

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = _override_db

    try:
        async with SessionFactory() as db:
            tg_only = User(
                email="tg_user_g@telegram.selloi.uz",
                full_name="TG Only",
                telegram_user_id=123001122,
                email_verified=False,
                is_active=True,
            )
            taken_gmail = User(
                email="already_taken@gmail.com",
                full_name="Already Bound",
                telegram_user_id=888777666,
                email_verified=True,
                is_active=True,
            )
            db.add_all([tg_only, taken_gmail])
            await db.commit()
            tg_user_id = tg_only.id

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 1. Google link with a Gmail already linked to another TG returns 409 Conflict
            conflict_res = await client.post(
                "/api/v1/auth/google",
                json={
                    "email": "already_taken@gmail.com",
                    "full_name": "TG Only",
                    "google_id": "g-taken",
                    "link_user_id": tg_user_id,
                },
            )
            assert conflict_res.status_code == 409

            # 2. Google link with a free Gmail unifies TG + Gmail in 1 record
            ok_res = await client.post(
                "/api/v1/auth/google",
                json={
                    "email": "fresh_unified@gmail.com",
                    "full_name": "Unified Name",
                    "google_id": "g-fresh",
                    "link_user_id": tg_user_id,
                },
            )
            assert ok_res.status_code == 200
            data = ok_res.json()
            assert data["user_id"] == tg_user_id
            assert data["email"] == "fresh_unified@gmail.com"
            assert data["telegram_user_id"] == 123001122
            assert data["email_verified"] is True
            assert data["fully_verified"] is True
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)
        await engine.dispose()
