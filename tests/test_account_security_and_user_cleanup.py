"""Tests for Step 3: passwordless set-password, session revocation, and Owner user deletion."""

import time
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.security import hash_password, reset_rate_limit, verify_password
from app.dependencies.auth import create_access_token
from app.main import app
from app.models import AuditLog, Base, Organization, OrganizationMember, User


async def _make_isolated_db(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_set_password_for_oauth_user_and_revoke_all_sessions(tmp_path):
    engine, SessionFactory = await _make_isolated_db(tmp_path / "step3_security.db")

    async def _override_db():
        async with SessionFactory() as session:
            yield session

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = _override_db

    try:
        async with SessionFactory() as db:
            oauth_user = User(
                email="oauth_nopass@gmail.com",
                full_name="OAuth User",
                hashed_password="",
                email_verified=True,
                telegram_user_id=777111222,
                is_active=True,
                token_version=1,
            )
            db.add(oauth_user)
            await db.commit()
            user_id = oauth_user.id

        old_token = create_access_token(user_id, "oauth_nopass@gmail.com", token_version=1)
        time.sleep(1.1)

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 1. Passwordless user can set initial password without current_password
            r_set = await client.post(
                "/api/v1/auth/set-password",
                headers={"Authorization": f"Bearer {old_token}"},
                json={"current_password": "", "new_password": "FirstPassword123!"},
            )
            assert r_set.status_code == 200
            body = r_set.json()
            assert body["ok"] is True
            assert body["has_password"] is True
            assert body["token_version"] == 2
            rotated_token = body["access_token"]
            assert rotated_token

            # 2. Old token is invalidated while rotated token remains accepted
            assert (await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"})).status_code == 401
            assert (await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {rotated_token}"})).status_code == 200

            # 3. Attempting change-password with wrong current_password is now rejected
            r_bad = await client.post(
                "/api/v1/auth/change-password",
                headers={"Authorization": f"Bearer {rotated_token}"},
                json={"current_password": "WrongOldPassword", "new_password": "AnotherPass123!"},
            )
            assert r_bad.status_code == 400

            # 4. Global session revocation invalidates rotated token as well
            time.sleep(1.1)
            r_rev = await client.post(
                "/api/v1/auth/revoke-sessions",
                headers={"Authorization": f"Bearer {rotated_token}"},
            )
            assert r_rev.status_code == 200
            assert r_rev.json()["ok"] is True

            assert (await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {rotated_token}"})).status_code == 401

        async with SessionFactory() as db:
            u = await db.get(User, user_id)
            assert u is not None
            assert verify_password("FirstPassword123!", u.hashed_password)
            assert u.token_version == 3
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)
        await engine.dispose()


@pytest.mark.asyncio
async def test_platform_owner_can_delete_unverified_user_but_protects_store_owners(tmp_path):
    engine, SessionFactory = await _make_isolated_db(tmp_path / "step3_delete_user.db")

    async def _override_db():
        async with SessionFactory() as session:
            yield session

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = _override_db

    try:
        async with SessionFactory() as db:
            owner = User(
                email="plat_owner@selloi.uz",
                full_name="Platform Owner",
                hashed_password=hash_password("OwnerPass123"),
                email_verified=True,
                telegram_user_id=777111001,
                is_platform_owner=True,
                is_active=True,
            )
            site_admin = User(
                email="site_admin@selloi.uz",
                full_name="Site Admin",
                hashed_password=hash_password("AdminPass123"),
                email_verified=True,
                telegram_user_id=777111002,
                is_platform_admin=True,
                is_active=True,
            )
            unverified_user = User(
                email="stale_unverified@gmail.com",
                full_name="Stale Unverified",
                hashed_password=hash_password("TempPass123"),
                email_verified=False,
                telegram_user_id=None,
                is_active=True,
            )
            sole_store_owner = User(
                email="sole_shop_owner@gmail.com",
                full_name="Shop Owner",
                hashed_password=hash_password("ShopPass123"),
                email_verified=True,
                telegram_user_id=777111003,
                is_active=True,
            )
            org = Organization(name="Protected Store", slug="protected-store")
            db.add_all([owner, site_admin, unverified_user, sole_store_owner, org])
            await db.flush()
            db.add(OrganizationMember(organization_id=org.id, user_id=sole_store_owner.id, role="owner", is_active=True))
            await db.commit()

            owner_id = owner.id
            admin_id = site_admin.id
            unverified_id = unverified_user.id
            sole_owner_id = sole_store_owner.id

        owner_headers = {"Authorization": f"Bearer {create_access_token(owner_id, 'plat_owner@selloi.uz')}"}
        site_admin_headers = {"Authorization": f"Bearer {create_access_token(admin_id, 'site_admin@selloi.uz')}"}

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Site Admin must NOT be allowed to delete users (strict owner only)
            r_forbidden = await client.delete(f"/api/platform/users/{unverified_id}", headers=site_admin_headers)
            assert r_forbidden.status_code == 403

            # Sole store owner cannot be deleted while owning an active store
            r_sole = await client.delete(f"/api/platform/users/{sole_owner_id}", headers=owner_headers)
            assert r_sole.status_code == 400

            # Appointed Site Admin cannot be deleted before revoking admin status
            r_admin = await client.delete(f"/api/platform/users/{admin_id}", headers=owner_headers)
            assert r_admin.status_code == 400

            # Owner itself cannot be deleted
            r_self = await client.delete(f"/api/platform/users/{owner_id}", headers=owner_headers)
            assert r_self.status_code == 400

            # Unverified stale user is cleanly deleted
            r_del = await client.delete(f"/api/platform/users/{unverified_id}", headers=owner_headers)
            assert r_del.status_code == 200
            assert r_del.json()["deleted_user_id"] == unverified_id

            # Repeat returns 404
            r_missing = await client.delete(f"/api/platform/users/{unverified_id}", headers=owner_headers)
            assert r_missing.status_code == 404

        async with SessionFactory() as db:
            assert await db.get(User, unverified_id) is None
            assert await db.get(User, sole_owner_id) is not None
            audit_res = await db.execute(select(AuditLog).where(AuditLog.action == "DELETE_USER"))
            audit = audit_res.scalar_one_or_none()
            assert audit is not None
            assert audit.metadata_json.get("email") == "stale_unverified@gmail.com"
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)
        await engine.dispose()
