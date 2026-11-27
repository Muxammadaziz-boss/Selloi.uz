"""Public interactive live demo endpoints (/api/v1/demo/*)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.security import is_rate_limited, record_attempt
from app.services.demo_catalog import DEMO_PRODUCTS
from app.services.demo_service import (
    _public_session_payload,
    create_or_resume_session,
    get_demo_session,
    place_demo_order,
    process_demo_chat,
    subscribe_demo_events,
)
from app.services.telegram_auth import get_bot_username

router = APIRouter(tags=["demo"])


def _client_key(request: Request, prefix: str, sid: str = "") -> str:
    ip = (
        request.headers.get("x-real-ip")
        or (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    return f"{prefix}:{ip}:{sid}"


class DemoSessionRequest(BaseModel):
    session_id: str | None = None
    language: str = "uz"


class DemoChatRequest(BaseModel):
    session_id: str = Field(min_length=6, max_length=64)
    text: str = Field(min_length=1, max_length=1200)
    product_id: str | None = None
    language: str | None = None


class DemoOrderRequest(BaseModel):
    session_id: str = Field(min_length=6, max_length=64)
    product_id: str = Field(min_length=2, max_length=32)
    customer_name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=7, max_length=32)
    address: str = Field(default="Toshkent", max_length=120)


@router.get("/catalog")
async def get_demo_catalog():
    return {
        "channel_title": "TechZone UZ",
        "channel_username": "Test_pcssss",
        "total": len(DEMO_PRODUCTS),
        "products": DEMO_PRODUCTS,
    }


@router.post("/session")
async def init_demo_session(payload: DemoSessionRequest):
    return await create_or_resume_session(
        payload.session_id,
        language=payload.language,
    )


@router.get("/session")
async def fetch_demo_session_query(session_id: str, after_seq: int = 0):
    return await fetch_demo_session(session_id=session_id, after_seq=after_seq)


@router.get("/session/{session_id}")
async def fetch_demo_session(session_id: str, after_seq: int = 0):
    session = get_demo_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Demo sessiyasi topilmadi")
    bot_username = await get_bot_username()
    return _public_session_payload(session, bot_username, after_seq=after_seq)


@router.get("/events")
async def stream_demo_events_query(session_id: str):
    return await stream_demo_events(session_id=session_id)


@router.get("/events/{session_id}")
async def stream_demo_events(session_id: str):
    session = get_demo_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Demo sessiyasi topilmadi")
    return StreamingResponse(
        subscribe_demo_events(session["session_id"]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat")
async def demo_chat(payload: DemoChatRequest, request: Request):
    rkey = _client_key(request, "demo_chat", payload.session_id)
    if is_rate_limited(rkey, max_attempts=25, window_seconds=60):
        raise HTTPException(status_code=429, detail="Juda ko'p xabar yuborildi. Biroz kutib qayta yozing.")
    record_attempt(rkey)
    try:
        return await process_demo_chat(
            payload.session_id,
            payload.text,
            product_id=payload.product_id,
            language=payload.language,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Demo sessiyasi topilmadi")


@router.post("/order")
async def demo_order(payload: DemoOrderRequest, request: Request):
    rkey = _client_key(request, "demo_order", payload.session_id)
    if is_rate_limited(rkey, max_attempts=8, window_seconds=60):
        raise HTTPException(status_code=429, detail="Buyurtma urinishlari ko'payib ketdi. 1 daqiqa kuting.")
    record_attempt(rkey)
    try:
        return await place_demo_order(
            payload.session_id,
            product_id=payload.product_id,
            customer_name=payload.customer_name,
            phone=payload.phone,
            address=payload.address,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Demo sessiyasi topilmadi")
