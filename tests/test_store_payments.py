"""Tests for per-store customer payment config, Telegram inline pay links, and webhook settlement."""

import json
import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.permissions import ROLE_DEFAULTS
from app.dependencies.auth import get_current_admin
from app.dependencies.tenant import get_admin_tenant_id
from app.main import app
from app.models import Admin, Base, BusinessConnection, Conversation, Order, Organization, StoreOrderPayment
from app.services.store_payment_service import (
    build_click_checkout_url,
    build_payme_checkout_url,
    parse_amount_uzs,
)


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def test_checkout_url_builders_and_amount_parser():
    assert parse_amount_uzs("150,000 so'm") == 150000
    assert parse_amount_uzs("250 000 UZS") == 250000
    assert parse_amount_uzs("$850") == 0

    click_url = build_click_checkout_url(
        service_id="31452",
        merchant_id="18421",
        amount_uzs=150000,
        transaction_param="ord_1_5_abcd",
    )
    assert click_url.startswith("https://my.click.uz/services/pay?")
    assert "service_id=31452" in click_url
    assert "merchant_id=18421" in click_url
    assert "amount=150000" in click_url
    assert "transaction_param=ord_1_5_abcd" in click_url

    payme_url = build_payme_checkout_url(
        merchant_id="650a9999",
        amount_uzs=150000,
        order_ref="ord_1_5_abcd",
    )
    assert payme_url.startswith("https://checkout.paycom.uz/")


@pytest.mark.asyncio
async def test_store_payment_config_send_link_and_webhook_settlement(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "store_pay.db")
    try:
        async with SessionFactory() as db:
            org_a = Organization(name="Pay Store A", slug="pay-store-a")
            org_b = Organization(name="Pay Store B", slug="pay-store-b")
            db.add_all([org_a, org_b])
            await db.flush()

            bc_a = BusinessConnection(id="bc-pay-a", organization_id=org_a.id)
            db.add(bc_a)
            await db.flush()

            conv_a = Conversation(
                organization_id=org_a.id,
                business_connection_id=bc_a.id,
                chat_id=555001,
                customer_name="Aziz",
                username="aziz_uz",
                status="ai_active",
            )
            db.add(conv_a)
            await db.flush()

            order_a = Order(
                organization_id=org_a.id,
                conversation_id=conv_a.id,
                customer_name="Aziz",
                product_summary="Smartfon Xiaomi 14",
                amount="5 500 000 so'm",
                status="new",
            )
            order_b = Order(
                organization_id=org_b.id,
                customer_name="Boshqa mijoz",
                product_summary="Noutbuk",
                amount="8 000 000 so'm",
                status="new",
            )
            db.add_all([order_a, order_b])
            await db.commit()
            await db.refresh(order_a)
            await db.refresh(order_b)
            org_a_id = org_a.id
            org_b_id = org_b.id
            conv_a_id = conv_a.id
            order_a_id = order_a.id
            order_b_id = order_b.id

        sent_telegram_calls = []

        class FakeTelegramService:
            async def send_business_text(self, business_connection_id, chat_id, text, *, reply_markup=None):
                sent_telegram_calls.append({
                    "bc": business_connection_id,
                    "chat_id": chat_id,
                    "text": text,
                    "reply_markup": reply_markup,
                })
                return {"message_id": 8801 + len(sent_telegram_calls)}

        from app.services import store_payment_service
        monkeypatch.setattr(store_payment_service, "_get_org_telegram_service", lambda _org: FakeTelegramService())

        fake_admin = Admin(
            id=1,
            organization_id=org_a_id,
            telegram_user_id=991100,
            name="Owner A",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        prev_overrides = dict(app.dependency_overrides)
        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: fake_admin
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_a_id
        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Configure Click payment for org A (also test TezCheck key masking on PUT/GET)
                cfg_resp = await client.put(
                    "/admin/payments/config",
                    json={
                        "provider": "click",
                        "is_enabled": True,
                        "tezcheck_api_key": "aps_secret_sample",
                        "tezcheck_secret_key": "whsec_secret_sample",
                        "click_service_id": "31452",
                        "click_merchant_id": "18421",
                    },
                )
                assert cfg_resp.status_code == 200
                cfg_data = cfg_resp.json()["config"]
                assert cfg_data["provider"] == "click"
                assert cfg_data["is_enabled"] is True
                assert cfg_data["tezcheck_api_key_set"] is True
                assert "aps_secret_sample" not in json.dumps(cfg_data)

                # 2. Cross-tenant order isolation -> 404
                cross_resp = await client.post(
                    f"/admin/orders/{order_b_id}/send-payment",
                    json={"amount_uzs": 150000},
                )
                assert cross_resp.status_code == 404

                # 3. Send payment link for org A order -> sends inline Telegram button
                pay_resp = await client.post(
                    f"/admin/orders/{order_a_id}/send-payment",
                    json={"amount_uzs": 5500000, "description": "Xiaomi 14 256GB"},
                )
                assert pay_resp.status_code == 200
                pay_data = pay_resp.json()
                assert pay_data["ok"] is True
                assert pay_data["telegram_sent"] is True
                assert pay_data["payment"]["payment_url"].startswith("https://my.click.uz/services/pay?")
                bill_id = pay_data["payment"]["bill_id"]

                assert len(sent_telegram_calls) == 1
                assert sent_telegram_calls[0]["chat_id"] == 555001
                btn = sent_telegram_calls[0]["reply_markup"]["inline_keyboard"][0][0]
                assert "5 500 000 so'm" in btn["text"]
                assert btn["url"] == pay_data["payment"]["payment_url"]

                # 4. Also create payment link from Inbox conversation
                conv_pay_resp = await client.post(
                    f"/admin/conversations/{conv_a_id}/send-payment",
                    json={"amount_uzs": 250000, "product_summary": "Aksessuar to'plami"},
                )
                assert conv_pay_resp.status_code == 200
                assert conv_pay_resp.json()["telegram_sent"] is True

                # 5. Simulate store webhook confirmation -> marks Order Paid & skips duplicate idempotently
                wh_payload = {"id": "evt_store_1", "data": {"bill_id": bill_id, "state": "succeeded"}}
                wh_resp_1 = await client.post(
                    f"/api/store-payments/tezcheck/webhook/{org_a_id}",
                    json=wh_payload,
                )
                assert wh_resp_1.status_code == 200
                assert wh_resp_1.json()["result"]["status"] == "paid"

                wh_resp_2 = await client.post(
                    f"/api/store-payments/tezcheck/webhook/{org_a_id}",
                    json=wh_payload,
                )
                assert wh_resp_2.status_code == 200
                assert wh_resp_2.json()["idempotent"] is True

                # 6. Verify GET /admin/orders reflects Paid status and latest_payment
                orders_resp = await client.get("/admin/orders")
                assert orders_resp.status_code == 200
                matched = next(o for o in orders_resp.json() if o["db_id"] == order_a_id)
                assert matched["status"] == "Paid"
                assert matched["latest_payment"]["status"] == "paid"
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(prev_overrides)
    finally:
        await engine.dispose()
