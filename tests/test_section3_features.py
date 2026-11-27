"""Automated tests for Click/Payme store webhooks, plan quotas, RAG upload/CSV import, SMTP reset, and email team invites."""

import base64
from datetime import datetime, timezone
import hashlib
import httpx
import pytest
import zlib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.db import get_db
from app.core.permissions import ROLE_DEFAULTS
from app.core.security import hash_password, reset_rate_limit
from app.dependencies.auth import get_current_admin
from app.dependencies.tenant import get_admin_tenant_id
from app.main import app
from app.models import (
    Admin,
    Base,
    BusinessConnection,
    ConnectedChannel,
    Conversation,
    Customer,
    Order,
    Organization,
    OrganizationInvite,
    OrganizationMember,
    Plan,
    Product,
    StoreOrderPayment,
    Subscription,
    User,
)
from app.services import email_service, store_payment_service
from app.services.knowledge import chunk_text, extract_text_from_uploaded_file, parse_csv_product_rows


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def _click_sig(
    *,
    click_trans_id: str,
    service_id: str,
    secret_key: str,
    merchant_trans_id: str,
    merchant_prepare_id: str,
    amount: str,
    action: str,
    sign_time: str,
) -> str:
    if action == "1":
        raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{merchant_prepare_id}{amount}{action}{sign_time}"
    else:
        raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{amount}{action}{sign_time}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


@pytest.mark.asyncio
async def test_click_and_payme_webhooks_settle_store_orders(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "click_payme.db")

    class _FakeTg:
        def __init__(self):
            self.sent = []

        async def send_business_text(self, bc, chat_id, text, **kwargs):
            self.sent.append((bc, chat_id, text))
            return {"message_id": 100 + len(self.sent)}

    fake_tg = _FakeTg()
    monkeypatch.setattr(store_payment_service, "_get_org_telegram_service", lambda _org: fake_tg)

    try:
        async with SessionFactory() as db:
            org = Organization(name="Mega Texnika", slug="mega-texnika")
            db.add(org)
            await db.flush()

            bc = BusinessConnection(id="bc-uz-1", organization_id=org.id)
            db.add(bc)
            await db.flush()

            conv = Conversation(
                organization_id=org.id,
                business_connection_id=bc.id,
                chat_id=123001,
                customer_name="Sardor",
                status="ai_active",
            )
            db.add(conv)
            await db.flush()

            ord_click = Order(
                organization_id=org.id,
                conversation_id=conv.id,
                customer_name="Sardor",
                product_summary="Click TV",
                amount="150 000 so'm",
                status="new",
            )
            ord_payme = Order(
                organization_id=org.id,
                conversation_id=conv.id,
                customer_name="Sardor",
                product_summary="Payme Watch",
                amount="200 000 so'm",
                status="new",
            )
            db.add_all([ord_click, ord_payme])
            await db.commit()
            await db.refresh(ord_click)
            await db.refresh(ord_payme)
            org_id = org.id
            ord_click_id = ord_click.id
            ord_payme_id = ord_payme.id

        admin_stub = Admin(
            id=1,
            organization_id=org_id,
            telegram_user_id=88001,
            name="Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        prev = dict(app.dependency_overrides)
        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: admin_stub
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_id

        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                # 1. Configure Click + Payme secrets
                cfg_res = await client.put(
                    "/admin/payments/config",
                    json={
                        "provider": "click",
                        "is_enabled": True,
                        "click_service_id": "31452",
                        "click_merchant_id": "18421",
                        "click_secret_key": "clk_secret_123",
                        "payme_merchant_id": "650a8888",
                        "payme_secret_key": "payme_secret_456",
                    },
                )
                assert cfg_res.status_code == 200
                cfg_json = cfg_res.json()["config"]
                assert cfg_json["click_secret_key_set"] is True
                assert cfg_json["payme_secret_key_set"] is True
                assert "clk_secret_123" not in cfg_res.text
                assert "payme_secret_456" not in cfg_res.text

                # 2. Generate Click link and verify Prepare -> Complete webhooks
                click_pay = await client.post(
                    f"/admin/orders/{ord_click_id}/send-payment",
                    json={"amount_uzs": 150000, "description": "Click TV"},
                )
                assert click_pay.status_code == 200
                click_ref = click_pay.json()["payment"]["external_reference"]

                # Bad signature rejected
                bad_prep = await client.post(
                    f"/api/store-payments/click/prepare/{org_id}",
                    data={
                        "click_trans_id": "9001",
                        "service_id": "31452",
                        "click_paydoc_id": "7001",
                        "merchant_trans_id": click_ref,
                        "amount": "150000",
                        "action": "0",
                        "error": "0",
                        "sign_time": "2026-11-26 23:00:00",
                        "sign_string": "deadbeef",
                    },
                )
                assert bad_prep.status_code == 200
                assert bad_prep.json()["error"] == -1

                prep_sig = _click_sig(
                    click_trans_id="9001",
                    service_id="31452",
                    secret_key="clk_secret_123",
                    merchant_trans_id=click_ref,
                    merchant_prepare_id="",
                    amount="150000",
                    action="0",
                    sign_time="2026-11-26 23:00:00",
                )
                ok_prep = await client.post(
                    f"/api/store-payments/click/prepare/{org_id}",
                    data={
                        "click_trans_id": "9001",
                        "service_id": "31452",
                        "click_paydoc_id": "7001",
                        "merchant_trans_id": click_ref,
                        "amount": "150000",
                        "action": "0",
                        "error": "0",
                        "sign_time": "2026-11-26 23:00:00",
                        "sign_string": prep_sig,
                    },
                )
                assert ok_prep.json()["error"] == 0
                prep_id = str(ok_prep.json()["merchant_prepare_id"])

                comp_sig = _click_sig(
                    click_trans_id="9001",
                    service_id="31452",
                    secret_key="clk_secret_123",
                    merchant_trans_id=click_ref,
                    merchant_prepare_id=prep_id,
                    amount="150000",
                    action="1",
                    sign_time="2026-11-26 23:01:00",
                )
                ok_comp = await client.post(
                    f"/api/store-payments/click/complete/{org_id}",
                    data={
                        "click_trans_id": "9001",
                        "service_id": "31452",
                        "click_paydoc_id": "7001",
                        "merchant_trans_id": click_ref,
                        "merchant_prepare_id": prep_id,
                        "amount": "150000",
                        "action": "1",
                        "error": "0",
                        "sign_time": "2026-11-26 23:01:00",
                        "sign_string": comp_sig,
                    },
                )
                assert ok_comp.json()["error"] == 0

                # Duplicate complete returns -4 Already paid
                dup_comp = await client.post(
                    f"/api/store-payments/click/complete/{org_id}",
                    data={
                        "click_trans_id": "9001",
                        "service_id": "31452",
                        "click_paydoc_id": "7001",
                        "merchant_trans_id": click_ref,
                        "merchant_prepare_id": prep_id,
                        "amount": "150000",
                        "action": "1",
                        "error": "0",
                        "sign_time": "2026-11-26 23:01:00",
                        "sign_string": comp_sig,
                    },
                )
                assert dup_comp.json()["error"] == -4

                # 3. Switch provider to Payme and run full Payme JSON-RPC flow
                await client.put("/admin/payments/config", json={"provider": "payme", "is_enabled": True})
                payme_pay = await client.post(
                    f"/admin/orders/{ord_payme_id}/send-payment",
                    json={"amount_uzs": 200000, "description": "Payme Watch"},
                )
                assert payme_pay.status_code == 200
                payme_ref = payme_pay.json()["payment"]["external_reference"]

                auth_ok = "Basic " + base64.b64encode(b"Paycom:payme_secret_456").decode("ascii")
                auth_bad = "Basic " + base64.b64encode(b"Paycom:wrong").decode("ascii")

                r_unauth = await client.post(
                    f"/api/store-payments/payme/webhook/{org_id}",
                    headers={"Authorization": auth_bad},
                    json={"jsonrpc": "2.0", "id": 1, "method": "CheckPerformTransaction", "params": {"amount": 20000000, "account": {"order_id": payme_ref}}},
                )
                assert r_unauth.json()["error"]["code"] == -32504

                r_check = await client.post(
                    f"/api/store-payments/payme/webhook/{org_id}",
                    headers={"Authorization": auth_ok},
                    json={"jsonrpc": "2.0", "id": 2, "method": "CheckPerformTransaction", "params": {"amount": 20000000, "account": {"order_id": payme_ref}}},
                )
                assert r_check.json()["result"]["allow"] is True

                r_create = await client.post(
                    f"/api/store-payments/payme/webhook/{org_id}",
                    headers={"Authorization": auth_ok},
                    json={"jsonrpc": "2.0", "id": 3, "method": "CreateTransaction", "params": {"id": "pm_tx_1", "time": 1700000000000, "amount": 20000000, "account": {"order_id": payme_ref}}},
                )
                assert r_create.json()["result"]["state"] == 1

                r_perform = await client.post(
                    f"/api/store-payments/payme/webhook/{org_id}",
                    headers={"Authorization": auth_ok},
                    json={"jsonrpc": "2.0", "id": 4, "method": "PerformTransaction", "params": {"id": "pm_tx_1"}},
                )
                assert r_perform.json()["result"]["state"] == 2

                r_stmt = await client.post(
                    f"/api/store-payments/payme/webhook/{org_id}",
                    headers={"Authorization": auth_ok},
                    json={"jsonrpc": "2.0", "id": 5, "method": "GetStatement", "params": {"from": 1699999999000, "to": 1700000001000}},
                )
                assert len(r_stmt.json()["result"]["transactions"]) == 1
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(prev)

        async with SessionFactory() as db:
            c_ord = await db.get(Order, ord_click_id)
            p_ord = await db.get(Order, ord_payme_id)
            assert c_ord.status == "Paid"
            assert p_ord.status == "Paid"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_plan_quotas_and_feature_gates_return_402(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "quotas.db")
    try:
        async with SessionFactory() as db:
            start_plan = Plan(
                code="start",
                name="START",
                limits={
                    "products": 1,
                    "customers": 1,
                    "monthly_orders": 1,
                    "team_members": 1,
                    "telegram_channels": 1,
                },
                features={
                    "multiple_channels": False,
                    "data_export": False,
                },
            )
            org = Organization(name="Tiny Store", slug="tiny-store")
            db.add_all([start_plan, org])
            await db.flush()

            user = User(email="tiny@example.uz", hashed_password=hash_password("Pass123"), full_name="Tiny")
            db.add(user)
            await db.flush()
            db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="owner", is_active=True))
            db.add(
                Subscription(
                    organization_id=org.id,
                    plan_id=start_plan.id,
                    status="subscription_active",
                )
            )
            await db.commit()
            org_id = org.id
            user_id = user.id

        admin_stub = Admin(
            id=1,
            organization_id=org_id,
            telegram_user_id=445566,
            name="Tiny Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )
        admin_stub._is_platform_owner = False

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        prev = dict(app.dependency_overrides)
        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: admin_stub
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_id

        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                # 1st product allowed, 2nd -> 402 LIMIT_EXCEEDED
                assert (await client.post("/admin/products", json={"name": "P1", "price": "10000"})).status_code == 200
                r_prod2 = await client.post("/admin/products", json={"name": "P2", "price": "20000"})
                assert r_prod2.status_code == 402
                assert r_prod2.json()["detail"]["error"] == "LIMIT_EXCEEDED"

                # 1st order allowed (increments monthly_orders), 2nd -> 402 LIMIT_EXCEEDED
                assert (await client.post("/admin/orders", json={"customer_name": "C1", "product_summary": "P1", "amount": "10000"})).status_code == 200
                r_ord2 = await client.post("/admin/orders", json={"customer_name": "C2", "product_summary": "P1", "amount": "10000"})
                assert r_ord2.status_code == 402

                # 1st customer allowed, 2nd -> 402 LIMIT_EXCEEDED
                assert (await client.post("/admin/customers", json={"name": "Cust 1"})).status_code == 200
                assert (await client.post("/admin/customers", json={"name": "Cust 2"})).status_code == 402

                # Team already has 1 active OrganizationMember -> adding admin OR team invite hits limit=1 -> 402
                r_adm = await client.post("/admin/admins", json={"telegram_user_id": 999111, "name": "Ops"})
                assert r_adm.status_code == 402
                r_inv = await client.post("/admin/team/invites", json={"email": "staff@example.uz", "role": "operator"})
                assert r_inv.status_code == 402

                # data_export disabled on START -> 402 FEATURE_NOT_AVAILABLE
                r_exp = await client.get("/admin/export/orders")
                assert r_exp.status_code == 402
                assert r_exp.json()["detail"]["error"] == "FEATURE_NOT_AVAILABLE"
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(prev)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_knowledge_file_extract_chunking_and_csv_product_import(tmp_path, monkeypatch):
    # 1. Compressed PDF stream extraction + CSV + chunking
    long_text = "\n\n".join([f"Mahsulot qoidasi #{i}: Bepul yetkazib berish Toshkentda 2 soat." for i in range(40)])
    chunks = chunk_text(long_text, max_chars=500, overlap=80)
    assert len(chunks) >= 3

    csv_sample = "\ufeffname,category,price,specs,stock,warranty\nMacBook Air M3,Ultrabook,14500000 so'm,16GB/512GB,In Stock,1 yil\nMouse Logitech,Accessories,350000 so'm,Wireless,Kam qoldi,6 oy\n"
    rows = parse_csv_product_rows(csv_sample)
    assert len(rows) == 2
    assert rows[0]["name"] == "MacBook Air M3"
    assert rows[1]["stock"] == "Low Stock"

    pdf_stream = zlib.compress(b"BT (Selloi Kafolat 12 oy Toshkent) Tj ET")
    synthetic_pdf = b"%PDF-1.4\n1 0 obj\n<< /Length 99 /Filter /FlateDecode >>\nstream\n" + pdf_stream + b"\nendstream\nendobj\n%%EOF"
    extracted_pdf, _ = extract_text_from_uploaded_file("kafolat.pdf", synthetic_pdf)
    assert "Selloi Kafolat 12 oy Toshkent" in extracted_pdf

    # 2. HTTP /admin/products/import + /admin/knowledge/upload
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "kb_csv.db")
    try:
        async with SessionFactory() as db:
            org = Organization(name="Catalog Pro", slug="catalog-pro")
            db.add(org)
            await db.commit()
            await db.refresh(org)
            org_id = org.id

        admin_stub = Admin(
            id=1,
            organization_id=org_id,
            telegram_user_id=77711,
            name="Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )

        ingested_calls = []

        class _FakePost:
            def __init__(self, idx, text):
                self.id = idx
                self.channel_username = f"kb_{org_id}_doc"
                self.telegram_message_id = 5000 + idx
                self.text = text

        async def _fake_ingest(db, *, organization_id, title, text, source_tag="faq", **kwargs):
            ingested_calls.append({"org_id": organization_id, "title": title, "text": text, "tag": source_tag})
            parts = chunk_text(text, max_chars=900, overlap=120)
            return [_FakePost(i + 1, c) for i, c in enumerate(parts)]

        from app.services import knowledge as knowledge_module
        monkeypatch.setattr(knowledge_module.knowledge, "ingest_manual_document", _fake_ingest)

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        prev = dict(app.dependency_overrides)
        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: admin_stub
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_id

        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                imp_res = await client.post("/admin/products/import", json={"csv_text": csv_sample})
                assert imp_res.status_code == 200
                assert imp_res.json()["imported_count"] == 2

                b64_pdf = base64.b64encode(synthetic_pdf).decode("ascii")
                up_res = await client.post(
                    "/admin/knowledge/upload",
                    json={"filename": "kafolat.pdf", "content_base64": b64_pdf},
                )
                assert up_res.status_code == 200
                assert up_res.json()["chunks_created"] >= 1
                assert len(ingested_calls) == 1
                assert "Selloi Kafolat" in ingested_calls[0]["text"]
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(prev)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_smtp_email_password_reset_and_team_email_invite_flow(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "smtp_invite.db")
    sent_emails = []

    async def _fake_send_email(*, to_email: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
        sent_emails.append({"to": to_email, "subject": subject, "text": text_body})
        return True

    monkeypatch.setattr(email_service, "is_smtp_configured", lambda: True)
    monkeypatch.setattr(email_service, "send_email", _fake_send_email)

    async def _override_db():
        async with SessionFactory() as s:
            yield s

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = _override_db
    reset_rate_limit("forgot_pw:emailonly@example.uz")
    reset_rate_limit("reset_pw:emailonly@example.uz")

    try:
        async with SessionFactory() as db:
            org = Organization(name="Olmazor Market", slug="olmazor-market")
            db.add(org)
            await db.flush()
            owner_user = User(
                email="emailonly@example.uz",
                hashed_password=hash_password("Initial123"),
                full_name="Email Only Owner",
                telegram_user_id=None,
                is_active=True,
            )
            db.add(owner_user)
            await db.flush()
            db.add(OrganizationMember(organization_id=org.id, user_id=owner_user.id, role="owner", is_active=True))
            await db.commit()
            org_id = org.id

        admin_stub = Admin(
            id=1,
            organization_id=org_id,
            telegram_user_id=919191,
            name="Market Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )
        app.dependency_overrides[get_current_admin] = lambda: admin_stub
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_id

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 1. Email-only forgot-password fallback sends OTP over SMTP email
            r_fp = await client.post("/api/v1/auth/forgot-password", json={"email": "emailonly@example.uz"})
            assert r_fp.status_code == 200
            assert len(sent_emails) == 1
            import re
            code = re.search(r"\b(\d{6})\b", sent_emails[0]["text"]).group(1)

            r_rp = await client.post(
                "/api/v1/auth/reset-password",
                json={"email": "emailonly@example.uz", "code": code, "new_password": "ResetByEmail99"},
            )
            assert r_rp.status_code == 200

            # 2. Invite teammate via email
            r_inv = await client.post(
                "/admin/team/invites",
                json={"email": "operator@olmazor.uz", "role": "operator"},
            )
            assert r_inv.status_code == 200
            inv_data = r_inv.json()
            assert inv_data["email_sent"] is True
            assert len(sent_emails) == 2
            invite_url = inv_data["invite_url"]
            token = invite_url.split("token=")[1]

            # 3. Inspect & accept invite -> creates new User + active OrganizationMember
            r_info = await client.get(f"/api/v1/auth/invite-info?token={token}")
            assert r_info.status_code == 200
            assert r_info.json()["organization_name"] == "Olmazor Market"
            assert r_info.json()["requires_registration"] is True

            r_acc = await client.post(
                "/api/v1/auth/accept-invite",
                json={"token": token, "full_name": "Madina Operator", "password": "OperatorPass123"},
            )
            assert r_acc.status_code == 200
            acc_json = r_acc.json()
            assert acc_json["email"] == "operator@olmazor.uz"
            assert acc_json["organization_id"] == org_id
            assert acc_json["access_token"]

            # 4. Invited member appears in /admin/team/invites and token cannot be reused
            r_list = await client.get("/admin/team/invites")
            assert r_list.status_code == 200
            assert any(m["email"] == "operator@olmazor.uz" for m in r_list.json()["members"])
            assert (await client.post("/api/v1/auth/accept-invite", json={"token": token, "password": "OperatorPass123"})).status_code == 404
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)
        await engine.dispose()
