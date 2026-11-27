"""Organization onboarding, configuration, and authentication endpoints."""

import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import secrets
import time
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.rate_limit import get_trustworthy_client_ip
from app.core.security import (
    decrypt_secret,
    encrypt_secret,
    get_rate_limit_retry_after,
    hash_password,
    is_rate_limited,
    mask_secret,
    record_attempt,
    reset_rate_limit,
    revoke_token,
    revoke_user_sessions,
    verify_password,
)
from app.dependencies.auth import (
    create_access_token,
    decode_access_token,
    get_current_user,
    get_missing_verification_steps,
    get_verified_user,
    is_real_email,
    is_user_fully_verified,
    security,
)
from app.core.permissions import ROLE_DEFAULTS
from app.models import (
    AuditLog,
    EmailVerificationToken,
    Organization,
    OrganizationInvite,
    OrganizationMember,
    PasswordResetToken,
    User,
)
from app.schemas import (
    BindEmailConfirmRequest,
    BindEmailInitRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TelegramAuthRequest,
    TokenRequest,
    TokenResponse,
    VerifyEmailRequest,
    VerifyResetOtpRequest,
)

router = APIRouter(prefix="/api/v1", tags=["onboarding"])
logger = logging.getLogger(__name__)
PASSWORD_RESET_TTL_MINUTES = 10
PASSWORD_RESET_COOLDOWN_SECONDS = 60
EMAIL_VERIFY_TTL_MINUTES = 15


def _hash_password_reset_code(user_id: int, code: str) -> str:
    """Compute keyed HMAC-SHA256 digest for a password reset OTP."""
    secret = (get_settings().jwt_secret or "selloi-pwreset-dev-fallback").encode("utf-8")
    msg = f"pwreset:{user_id}:{code.strip()}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _hash_email_verification_code(user_id: int, email: str, code: str) -> str:
    """Compute keyed HMAC-SHA256 digest for an email verification OTP."""
    secret = (get_settings().jwt_secret or "selloi-pwreset-dev-fallback").encode("utf-8")
    msg = f"emailverify:{user_id}:{email.strip().lower()}:{code.strip()}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _rate_limit_response(detail: str, retry_after_seconds: int) -> JSONResponse:
    """Build a consistent HTTP 429 response with retry_after_seconds metadata."""
    wait_seconds = max(1, int(retry_after_seconds))
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": detail, "retry_after_seconds": wait_seconds},
        headers={"Retry-After": str(wait_seconds)},
    )


async def _verify_otp_row(
    db: AsyncSession,
    *,
    row: PasswordResetToken | EmailVerificationToken | None,
    expected_hash: str,
    rate_key: str,
    consume: bool = True,
    cooldown_reset_key: str | None = None,
) -> tuple[datetime, int]:
    """Validate OTP expiry, attempt lockouts, and hash; returns (now, remaining_seconds)."""
    if row is None:
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi noto'g'ri yoki muddati tugagan")

    now = datetime.now(timezone.utc)
    expires_at = row.expires_at if row.expires_at.tzinfo is not None else row.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        row.used_at = now
        await db.commit()
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi muddati tugagan. Yangi kod so'rang.")

    if row.attempts >= row.max_attempts:
        row.used_at = now
        if cooldown_reset_key:
            reset_rate_limit(cooldown_reset_key)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Urinishlar soni tugadi. Yangi tasdiqlash kodi so'rang.",
        )

    if not hmac.compare_digest(row.code_hash, expected_hash):
        row.attempts += 1
        exhausted = row.attempts >= row.max_attempts
        if exhausted:
            row.used_at = now
            if cooldown_reset_key:
                reset_rate_limit(cooldown_reset_key)
        record_attempt(rate_key)
        await db.commit()
        if exhausted:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Urinishlar soni tugadi. Yangi tasdiqlash kodi so'rang.",
            )
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi noto'g'ri")

    if consume:
        row.used_at = now
    remaining_seconds = max(1, int((expires_at - now).total_seconds()))
    return now, remaining_seconds


async def _verify_and_consume_otp_row(
    db: AsyncSession,
    *,
    row: PasswordResetToken | EmailVerificationToken | None,
    expected_hash: str,
    rate_key: str,
) -> datetime:
    """Validate OTP expiry, attempt lockouts, and constant-time hash match; consumes row on success."""
    now, _ = await _verify_otp_row(
        db,
        row=row,
        expected_hash=expected_hash,
        rate_key=rate_key,
        consume=True,
    )
    return now


async def _issue_email_verification_otp(
    db: AsyncSession,
    user: User,
    *,
    target_email: str | None = None,
) -> tuple[EmailVerificationToken, bool]:
    """Create a 6-digit email verification token (hashed) and email it via SMTP."""
    from app.services import email_service

    now = datetime.now(timezone.utc)
    clean_email = (target_email or user.email).strip().lower()
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    code = f"{secrets.randbelow(900000) + 100000}"
    token_row = EmailVerificationToken(
        user_id=user.id,
        email=clean_email,
        code_hash=_hash_email_verification_code(user.id, clean_email, code),
        expires_at=now + timedelta(minutes=EMAIL_VERIFY_TTL_MINUTES),
    )
    db.add(token_row)
    db.add(
        AuditLog(
            user_id=user.id,
            action="email_verification_requested",
            resource="user",
            resource_id=str(user.id),
            metadata_json={"email": clean_email},
        )
    )
    await db.flush()

    sent = await email_service.send_email_verification_code(clean_email, code, user.full_name or "")
    if not sent:
        token_row.used_at = now
    return token_row, sent


def _build_token_response(
    user: User,
    *,
    access_token: str = "",
    verification_required: bool = False,
    detail: str | None = None,
) -> TokenResponse:
    """Build a consistent TokenResponse reporting exact 2-factor verification progress."""
    real_email = is_real_email(getattr(user, "email", ""))
    missing = get_missing_verification_steps(user)
    return TokenResponse(
        access_token=access_token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        telegram_user_id=user.telegram_user_id,
        email_verified=bool(getattr(user, "email_verified", False)) and real_email,
        has_real_email=real_email,
        fully_verified=len(missing) == 0,
        missing_steps=missing,
        verification_required=verification_required,
        detail=detail,
    )


async def _merge_email_and_telegram_users(
    db: AsyncSession,
    *,
    email_user: User,
    tg_user: User,
    preferred_password: str | None = None,
) -> User:
    """Safely unify a verified real-email account with a placeholder Telegram account (1 TG <-> 1 Email)."""
    if email_user.id == tg_user.id:
        return email_user

    tg_mems = (
        await db.execute(
            select(OrganizationMember).where(OrganizationMember.user_id == tg_user.id)
        )
    ).scalars().all()
    email_mems = (
        await db.execute(
            select(OrganizationMember).where(OrganizationMember.user_id == email_user.id)
        )
    ).scalars().all()

    keep_tg = len(tg_mems) > 0 and len(email_mems) == 0
    primary = tg_user if keep_tg else email_user
    secondary = email_user if keep_tg else tg_user

    real_email = email_user.email.strip().lower()
    real_hash = (email_user.hashed_password or "").strip()
    tg_id = tg_user.telegram_user_id
    merged_owner = bool(email_user.is_platform_owner or tg_user.is_platform_owner or _is_configured_admin_email(real_email))
    merged_admin = bool(getattr(email_user, "is_platform_admin", False) or getattr(tg_user, "is_platform_admin", False))
    verified_at = email_user.email_verified_at or datetime.now(timezone.utc)
    best_name = (
        email_user.full_name.strip()
        if (email_user.full_name or "").strip()
        else (tg_user.full_name or "").strip()
    )

    primary_org_ids = {
        m.organization_id
        for m in (tg_mems if keep_tg else email_mems)
    }
    secondary_mems = email_mems if keep_tg else tg_mems
    for m in secondary_mems:
        if m.organization_id not in primary_org_ids:
            m.user_id = primary.id
            primary_org_ids.add(m.organization_id)
        else:
            m.is_active = False

    secondary.telegram_user_id = None
    secondary.is_active = False
    secondary.email = f"merged_{secondary.id}_{int(time.time())}@merged.selloi.uz"
    secondary.token_version = (getattr(secondary, "token_version", 1) or 1) + 1
    await db.flush()

    primary.email = real_email
    primary.email_verified = True
    primary.email_verified_at = verified_at
    primary.telegram_user_id = tg_id
    primary.is_platform_owner = merged_owner
    primary.is_platform_admin = merged_admin
    primary.is_active = True
    if preferred_password and len(preferred_password.strip()) >= 6:
        primary.hashed_password = hash_password(preferred_password.strip())
    elif not (primary.hashed_password or "").strip() and real_hash:
        primary.hashed_password = real_hash
    if best_name and (
        not (primary.full_name or "").strip()
        or primary.full_name.startswith("User ")
        or primary.full_name.startswith("@")
    ):
        primary.full_name = best_name
    primary.token_version = (getattr(primary, "token_version", 1) or 1) + 1

    db.add(
        AuditLog(
            user_id=primary.id,
            action="accounts_unified",
            resource="user",
            resource_id=str(primary.id),
            metadata_json={"merged_from_user_id": secondary.id, "email": real_email, "telegram_user_id": tg_id},
        )
    )
    await db.flush()
    return primary


def _is_configured_admin_email(email: str) -> bool:
    """Return True if the verified email matches ADMIN_EMAIL in settings."""
    configured = (get_settings().admin_email or "").strip()
    if not configured:
        return False
    allowed = {part.strip().lower() for part in configured.split(",") if part.strip()}
    return email.strip().lower() in allowed


def _verify_internal_google_signature(
    sig_header: str,
    email: str,
    google_id: str,
    link_user_id: int | None = None,
) -> bool:
    """Verify short-lived HMAC signature generated by the Next.js OAuth BFF."""
    jwt_secret = (get_settings().jwt_secret or "").strip()
    if not jwt_secret or "." not in sig_header:
        return False
    ts_str, provided_sig = sig_header.split(".", 1)
    try:
        ts = int(ts_str)
    except ValueError:
        return False
    if abs(int(time.time()) - ts) > 120:
        return False
    clean_email = email.strip().lower()
    clean_gid = (google_id or "").strip()
    if link_user_id is not None:
        msg = f"google-auth:{ts}:{clean_email}:{clean_gid}:{int(link_user_id)}".encode("utf-8")
    else:
        msg = f"google-auth:{ts}:{clean_email}:{clean_gid}".encode("utf-8")
    expected_sig = hmac.new(jwt_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, provided_sig.strip())


async def _verify_google_id_token_email(id_token: str, claimed_email: str) -> bool:
    """Verify a Google Sign-In id_token directly with Google's tokeninfo endpoint."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
            if resp.status_code != 200:
                return False
            data = resp.json()
            verified_email = str(data.get("email") or "").strip().lower()
            email_verified = str(data.get("email_verified") or "").lower() in ("true", "1")
            return bool(verified_email and email_verified and verified_email == claimed_email)
    except Exception:
        return False


def _org_to_out(org: Organization) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "category": org.category,
        "status": org.status,
        "ai_language": org.ai_language,
        "ai_personality": org.ai_personality,
        "custom_system_prompt": org.custom_system_prompt,
        "telegram_bot_token_set": bool(org.telegram_bot_token),
        "openai_api_key_set": bool(org.openai_api_key),
        "gemini_api_key_set": bool(org.gemini_api_key),
        "created_at": org.created_at.isoformat() if org.created_at else None,
    }


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Register a new platform user. Requires 6-digit email verification when SMTP is configured."""
    from app.services import email_service

    clean_email = payload.email.strip().lower()
    if not is_real_email(clean_email):
        raise HTTPException(status_code=400, detail="Haqiqiy email manzilini kiriting (masalan: name@gmail.com)")

    client_ip = get_trustworthy_client_ip(request)
    ip_rate_key = f"register_ip:{client_ip}"
    if is_rate_limited(ip_rate_key, max_attempts=60, window_seconds=300):
        wait_s = get_rate_limit_retry_after(ip_rate_key, max_attempts=60, window_seconds=300)
        return _rate_limit_response(
            f"Juda ko'p so'rov yuborildi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )

    rate_key = f"register:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Ro'yxatdan o'tish uchun juda ko'p urinish. 1 daqiqadan so'ng qayta urinib ko'ring.",
        )
    record_attempt(rate_key)
    record_attempt(ip_rate_key)

    existing_user = (await db.execute(select(User).where(User.email == clean_email))).scalar_one_or_none()
    if existing_user is not None:
        can_reuse_unverified = (
            not bool(getattr(existing_user, "email_verified", False))
            and existing_user.telegram_user_id is None
            and not existing_user.is_platform_owner
            and not getattr(existing_user, "is_platform_admin", False)
            and email_service.is_smtp_configured()
        )
        if not can_reuse_unverified:
            raise HTTPException(status_code=400, detail="Bu email allaqachon ro'yxatdan o'tgan")
        existing_user.hashed_password = hash_password(payload.password)
        if payload.full_name.strip():
            existing_user.full_name = payload.full_name.strip()
        existing_user.is_active = True
        user = existing_user
        await db.flush()
    else:
        user = User(
            email=clean_email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name.strip(),
            email_verified=False,
        )
        db.add(user)
        await db.flush()

    should_verify = (
        email_service.is_smtp_configured()
        and email_service.is_deliverable_email(clean_email)
    )
    if should_verify:
        _row, sent = await _issue_email_verification_otp(db, user)
        if not sent:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Tasdiqlash xatini yuborib bo'lmadi. Keyinroq qayta urinib ko'ring.",
            )
        await db.commit()
        return _build_token_response(
            user,
            access_token="",
            verification_required=True,
            detail="Email manzilingizga 6 xonali tasdiqlash kodi yuborildi.",
        )

    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
    return _build_token_response(
        user,
        access_token=token,
        verification_required=False,
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: TokenRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate with email & password to receive a JWT access token."""
    from app.services import email_service

    clean_email = payload.email.strip().lower()
    client_ip = get_trustworthy_client_ip(request)
    ip_rate_key = f"login_ip:{client_ip}"
    if is_rate_limited(ip_rate_key, max_attempts=60, window_seconds=60):
        wait_s = get_rate_limit_retry_after(ip_rate_key, max_attempts=60, window_seconds=60)
        return _rate_limit_response(
            f"Juda ko'p kirish urinishi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )

    rate_key = f"login:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p urinishlar qilindi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring.",
        )

    result = await db.execute(select(User).where(User.email == clean_email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        record_attempt(rate_key)
        record_attempt(ip_rate_key)
        raise HTTPException(status_code=401, detail="Email yoki parol noto'g'ri")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Foydalanuvchi faol emas")

    reset_rate_limit(rate_key)

    if (
        email_service.is_smtp_configured()
        and not getattr(user, "email_verified", False)
        and email_service.is_deliverable_email(clean_email)
    ):
        _row, sent = await _issue_email_verification_otp(db, user)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "EMAIL_NOT_VERIFIED",
                "email": user.email,
                "sent": sent,
                "message": "Email manzilingiz hali tasdiqlanmagan. Pochtangizga 6 xonali tasdiqlash kodi yuborildi.",
            },
        )

    if _is_configured_admin_email(clean_email) and not user.is_platform_owner:
        user.is_platform_owner = True
        if not email_service.is_smtp_configured() and not getattr(user, "email_verified", False):
            user.email_verified = True
            user.email_verified_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
    return _build_token_response(
        user,
        access_token=token,
        verification_required=False,
    )


@router.post("/auth/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthRequest,
    x_internal_google_auth: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate, register, or unify a user via verified Google OAuth BFF exchange or ID token."""
    clean_email = payload.email.strip().lower()
    if not is_real_email(clean_email):
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    verified = False
    if x_internal_google_auth:
        if not _verify_internal_google_signature(
            x_internal_google_auth,
            clean_email,
            payload.google_id or "",
            link_user_id=payload.link_user_id,
        ):
            raise HTTPException(status_code=401, detail="Google autentifikatsiya imzosi yaroqsiz")
        verified = True
    elif payload.id_token and payload.link_user_id is None:
        if not await _verify_google_id_token_email(payload.id_token, clean_email):
            raise HTTPException(status_code=401, detail="Google ID tokeni tasdiqlanmadi")
        verified = True

    if get_settings().is_production and not verified:
        raise HTTPException(
            status_code=401,
            detail="Production muhitida Google autentifikatsiyasi tasdiqlangan imzo yoki ID token talab qiladi",
        )

    rate_key = f"google_auth:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=10, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p urinishlar qilindi. 1 daqiqadan so'ng qayta urinib ko'ring.",
        )

    is_owner_email = _is_configured_admin_email(clean_email)
    existing_email_user = (await db.execute(select(User).where(User.email == clean_email))).scalar_one_or_none()

    # Account Unification Path: signed-in Telegram-only user connecting their Gmail
    if payload.link_user_id is not None:
        link_target = await db.get(User, int(payload.link_user_id))
        if link_target is None or not link_target.is_active:
            raise HTTPException(status_code=404, detail="Bog'lanadigan foydalanuvchi topilmadi")

        if existing_email_user is not None and existing_email_user.id != link_target.id:
            if (
                existing_email_user.telegram_user_id is not None
                and link_target.telegram_user_id is not None
                and int(existing_email_user.telegram_user_id) != int(link_target.telegram_user_id)
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Ushbu Gmail boshqa Telegram hisobiga allaqachon ulangan. 1 ta Telegramga faqat 1 ta email ulanishi mumkin.",
                )
            if not existing_email_user.is_active:
                raise HTTPException(status_code=403, detail="Ushbu email hisobi bloklangan")
            existing_email_user.email_verified = True
            existing_email_user.email_verified_at = existing_email_user.email_verified_at or datetime.now(timezone.utc)
            user = await _merge_email_and_telegram_users(
                db,
                email_user=existing_email_user,
                tg_user=link_target,
            )
            await db.commit()
            await db.refresh(user)
        else:
            if is_real_email(link_target.email) and link_target.email.strip().lower() != clean_email:
                raise HTTPException(
                    status_code=409,
                    detail="Bu Telegram hisobiga boshqa email allaqachon bog'langan.",
                )
            link_target.email = clean_email
            link_target.email_verified = True
            link_target.email_verified_at = datetime.now(timezone.utc)
            if is_owner_email:
                link_target.is_platform_owner = True
            if payload.full_name.strip() and (not link_target.full_name or link_target.full_name.startswith("User ") or link_target.full_name.startswith("@")):
                link_target.full_name = payload.full_name.strip()
            link_target.token_version = (getattr(link_target, "token_version", 1) or 1) + 1
            await db.commit()
            await db.refresh(link_target)
            user = link_target

        token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
        return _build_token_response(user, access_token=token, verification_required=False)

    user = existing_email_user
    if user is None:
        display_name = payload.full_name.strip() or clean_email.split("@")[0]
        user = User(
            email=clean_email,
            full_name=display_name,
            hashed_password="",
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            is_platform_owner=is_owner_email,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Foydalanuvchi hisobi faol emas")
        dirty = False
        if not getattr(user, "email_verified", False):
            user.email_verified = True
            user.email_verified_at = datetime.now(timezone.utc)
            dirty = True
        if is_owner_email and not user.is_platform_owner:
            user.is_platform_owner = True
            dirty = True
        if not user.full_name and payload.full_name.strip():
            user.full_name = payload.full_name.strip()
            dirty = True
        if dirty:
            await db.commit()
            await db.refresh(user)

    token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
    return _build_token_response(user, access_token=token, verification_required=False)


@router.post("/auth/telegram/init")
async def telegram_auth_init():
    """Generate a secure verification session for Telegram bot authentication."""
    from app.services.telegram_auth import create_auth_session
    session = await create_auth_session()
    return session


@router.post("/auth/telegram/poll")
async def telegram_auth_poll(payload: dict, db: AsyncSession = Depends(get_db)):
    """Check and finalize Telegram bot authentication."""
    from app.services.telegram_auth import check_auth_session, consume_auth_session
    code = (payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Kod ko'rsatilmagan")

    auth_data = consume_auth_session(code, expected_purpose="login")
    if not auth_data:
        pending = check_auth_session(code)
        if pending and pending.get("purpose", "login") == "login":
            return {"status": "pending"}
        raise HTTPException(status_code=404, detail="Sessiya topilmadi yoki muddati tugagan")

    clean_id = auth_data["telegram_id"]
    clean_username = auth_data.get("username", "")
    full_name = auth_data.get("full_name", "")

    if clean_username:
        email = f"{clean_username}@telegram.selloi.uz"
    else:
        email = f"tg_{clean_id}@telegram.selloi.uz"

    stmt = select(User).where(User.telegram_user_id == clean_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        stmt_email = select(User).where(User.email == email)
        user = (await db.execute(stmt_email)).scalar_one_or_none()

    settings = get_settings()
    is_owner_tg = bool(settings.admin_telegram_id and int(clean_id) == int(settings.admin_telegram_id))

    if user is None:
        user = User(
            email=email,
            full_name=full_name or (f"@{clean_username}" if clean_username else f"User {clean_id}"),
            telegram_user_id=clean_id,
            hashed_password="",
            email_verified=False,
            email_verified_at=None,
            is_platform_owner=is_owner_tg,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Foydalanuvchi hisobi faol emas")
        dirty = False
        if user.telegram_user_id != clean_id:
            user.telegram_user_id = clean_id
            dirty = True
        if not is_real_email(user.email) and getattr(user, "email_verified", False):
            # Synthetic @telegram.selloi.uz placeholder is never a verified real email
            user.email_verified = False
            user.email_verified_at = None
            dirty = True
        if is_owner_tg and not user.is_platform_owner:
            user.is_platform_owner = True
            dirty = True
        if full_name and not (user.full_name or "").strip():
            user.full_name = full_name
            dirty = True
        if dirty:
            await db.commit()
            await db.refresh(user)

    token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
    real_email = is_real_email(user.email)
    missing = get_missing_verification_steps(user)
    return {
        "status": "verified",
        "access_token": token,
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "telegram_user_id": user.telegram_user_id,
        "username": clean_username,
        "email_verified": bool(getattr(user, "email_verified", False)) and real_email,
        "has_real_email": real_email,
        "fully_verified": len(missing) == 0,
        "missing_steps": missing,
    }


@router.post("/auth/telegram", response_model=TokenResponse)
async def telegram_auth(payload: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate or register a user via Telegram handle or ID (protected)."""
    raise HTTPException(
        status_code=400,
        detail="Xavfsizlik yuzasidan Telegram orqali kirish bot tasdig'i orqali amalga oshirilishi shart.",
    )


@router.post("/auth/telegram/link/init")
async def telegram_link_init(current_user: User = Depends(get_current_user)):
    """Generate a Telegram deep-link session to connect @Selloi_ai_bot to the signed-in user."""
    from app.services.telegram_auth import create_auth_session

    rate_key = f"tg_link_init:{current_user.id}"
    if is_rate_limited(rate_key, max_attempts=12, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p urinishlar qilindi. Birozdan so'ng qayta urinib ko'ring.",
        )
    record_attempt(rate_key)
    return await create_auth_session(purpose="link", user_id=current_user.id)


@router.post("/auth/telegram/link/poll")
async def telegram_link_poll(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check and finalize Telegram account linking for the signed-in user."""
    from app.services.telegram_auth import check_auth_session, consume_auth_session

    code = (payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Kod ko'rsatilmagan")

    auth_data = consume_auth_session(code, expected_purpose="link", expected_user_id=current_user.id)
    if not auth_data:
        pending = check_auth_session(code)
        if pending and pending.get("purpose") == "link" and pending.get("user_id") == current_user.id:
            return {"status": "pending"}
        raise HTTPException(status_code=404, detail="Ulash sessiyasi topilmadi yoki muddati tugagan")

    clean_tg_id = int(auth_data["telegram_id"])
    clean_username = (auth_data.get("username") or "").strip().lstrip("@")
    full_name = (auth_data.get("full_name") or "").strip()

    existing_holder = (
        await db.execute(
            select(User).where(User.telegram_user_id == clean_tg_id, User.id != current_user.id)
        )
    ).scalar_one_or_none()
    if existing_holder is not None:
        has_real_holder_email = is_real_email(existing_holder.email)
        if has_real_holder_email:
            raise HTTPException(
                status_code=409,
                detail="Bu Telegram hisobi boshqa Selloi foydalanuvchisiga allaqachon ulangan. 1 ta Telegramga faqat 1 ta email ruxsat etiladi.",
            )
        has_membership = (
            await db.execute(
                select(OrganizationMember.id)
                .where(OrganizationMember.user_id == existing_holder.id, OrganizationMember.is_active == True)
                .limit(1)
            )
        ).scalar_one_or_none()
        is_empty_tg_stub = (
            (existing_holder.email or "").lower().endswith("@telegram.selloi.uz")
            and not (existing_holder.hashed_password or "").strip()
            and not existing_holder.is_platform_owner
            and not getattr(existing_holder, "is_platform_admin", False)
            and has_membership is None
        )
        if is_empty_tg_stub:
            existing_holder.telegram_user_id = None
            existing_holder.is_active = False
            existing_holder.email = f"merged_{existing_holder.id}_{int(time.time())}@merged.selloi.uz"
            await db.flush()
        elif is_real_email(current_user.email) and getattr(current_user, "email_verified", False):
            # Both accounts belong to the user: merge synthetic TG account into unified account
            prev_tv = max(1, getattr(current_user, "token_version", 1) or 1)
            unified = await _merge_email_and_telegram_users(
                db,
                email_user=current_user,
                tg_user=existing_holder,
            )
            unified.token_version = prev_tv
            await db.commit()
            await db.refresh(unified)
            token = create_access_token(
                unified.id,
                unified.email,
                token_version=getattr(unified, "token_version", 1) or 1,
            )
            missing = get_missing_verification_steps(unified)
            return {
                "ok": True,
                "status": "verified",
                "access_token": token,
                "user_id": unified.id,
                "email": unified.email,
                "telegram_user_id": unified.telegram_user_id,
                "username": clean_username,
                "full_name": unified.full_name,
                "email_verified": bool(getattr(unified, "email_verified", False)),
                "has_real_email": is_real_email(unified.email),
                "fully_verified": len(missing) == 0,
                "missing_steps": missing,
            }
        else:
            raise HTTPException(
                status_code=409,
                detail="Bu Telegram hisobiga boshqa ma'lumotlar biriktirilgan. Avval emailingizni tasdiqlang.",
            )

    settings = get_settings()
    if settings.admin_telegram_id and clean_tg_id == int(settings.admin_telegram_id):
        current_user.is_platform_owner = True

    current_user.telegram_user_id = clean_tg_id
    if not current_user.full_name and full_name:
        current_user.full_name = full_name

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="telegram_linked",
            resource="user",
            resource_id=str(current_user.id),
            metadata_json={"telegram_user_id": clean_tg_id, "username": clean_username or None},
        )
    )
    await db.commit()
    await db.refresh(current_user)
    token = create_access_token(
        current_user.id,
        current_user.email,
        token_version=getattr(current_user, "token_version", 1) or 1,
    )
    missing = get_missing_verification_steps(current_user)
    return {
        "ok": True,
        "status": "verified",
        "access_token": token,
        "user_id": current_user.id,
        "email": current_user.email,
        "telegram_user_id": current_user.telegram_user_id,
        "username": clean_username,
        "full_name": current_user.full_name,
        "email_verified": bool(getattr(current_user, "email_verified", False)) and is_real_email(current_user.email),
        "has_real_email": is_real_email(current_user.email),
        "fully_verified": len(missing) == 0,
        "missing_steps": missing,
    }


@router.post("/auth/telegram/unlink")
async def telegram_unlink(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect linked Telegram ID when another login method exists."""
    if not current_user.telegram_user_id:
        return {"ok": True, "telegram_user_id": None}

    is_tg_only_account = (current_user.email or "").lower().endswith("@telegram.selloi.uz") and not (
        current_user.hashed_password or ""
    ).strip()
    if is_tg_only_account:
        raise HTTPException(
            status_code=400,
            detail="Bu hisob faqat Telegram orqali kirishga bog'langan. Telegramni uzish uchun avval haqiqiy email va parol o'rnating.",
        )

    old_tg_id = current_user.telegram_user_id
    current_user.telegram_user_id = None
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="telegram_unlinked",
            resource="user",
            resource_id=str(current_user.id),
            metadata_json={"telegram_user_id": old_tg_id},
        )
    )
    await db.commit()
    await db.refresh(current_user)
    return {"ok": True, "telegram_user_id": None}


@router.get("/auth/me")
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get profile of current logged-in user."""
    from app.services import email_service
    from app.services.telegram_auth import get_bot_username

    is_owner = bool(current_user.is_platform_owner)
    is_site_admin = bool(getattr(current_user, "is_platform_admin", False))
    real_email = is_real_email(current_user.email)
    missing = get_missing_verification_steps(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "telegram_user_id": current_user.telegram_user_id,
        "email_verified": bool(getattr(current_user, "email_verified", False)) and real_email,
        "has_real_email": real_email,
        "fully_verified": len(missing) == 0,
        "missing_steps": missing,
        "smtp_configured": email_service.is_smtp_configured(),
        "bot_username": await get_bot_username(),
        "has_password": bool((current_user.hashed_password or "").strip()),
        "is_platform_owner": is_owner,
        "is_platform_admin": is_site_admin,
        "has_platform_access": is_owner or is_site_admin,
        "token_version": getattr(current_user, "token_version", 1) or 1,
    }


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    telegram_user_id: int | None = None


@router.patch("/auth/profile")
async def update_profile(
    payload: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user display name. Telegram linking must use verified bot flow."""
    if payload.telegram_user_id is not None and payload.telegram_user_id != current_user.telegram_user_id:
        raise HTTPException(
            status_code=400,
            detail="Telegram hisobini ulash faqat @Selloi_ai_bot tasdig'i orqali amalga oshiriladi.",
        )
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    await db.commit()
    await db.refresh(current_user)
    return {
        "ok": True,
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "telegram_user_id": current_user.telegram_user_id,
    }


class ChangePasswordRequest(BaseModel):
    current_password: str = ""
    new_password: str = Field(min_length=6, max_length=128)


async def _invalidate_user_sessions_db(
    raw_token: str | None,
    user: User,
    db: AsyncSession,
    *,
    audit_action: str | None = None,
) -> None:
    """Revoke current token (if supplied) and bump token_version for durable session revocation."""
    if raw_token:
        try:
            payload = decode_access_token(raw_token)
            jti = payload.get("jti")
            if jti:
                revoke_token(jti)
        except Exception:
            pass
        revoke_token(raw_token[-32:])

    user.token_version = (getattr(user, "token_version", 1) or 1) + 1
    user.updated_at = datetime.now(timezone.utc)
    if audit_action:
        db.add(
            AuditLog(
                user_id=user.id,
                action=audit_action,
                resource="user",
                resource_id=str(user.id),
            )
        )
    await db.commit()
    revoke_user_sessions(user.id)


async def _apply_password_update(
    payload: ChangePasswordRequest,
    db: AsyncSession,
    current_user: User,
) -> dict:
    """Set initial password (for OAuth/Telegram users) or change existing password and rotate session."""
    clean_new = payload.new_password.strip()
    if len(clean_new) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak",
        )

    has_existing_password = bool((current_user.hashed_password or "").strip())
    if has_existing_password and not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hozirgi parol noto'g'ri",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1
    current_user.updated_at = datetime.now(timezone.utc)
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="PASSWORD_CHANGED" if has_existing_password else "PASSWORD_SET",
            resource="user",
            resource_id=str(current_user.id),
            metadata_json={"had_password": has_existing_password},
        )
    )
    await db.commit()
    await db.refresh(current_user)

    # Invalidate all active tokens issued before this moment, then issue a fresh token for this browser
    revoke_user_sessions(current_user.id)
    await asyncio.sleep(0.005)
    fresh_token = create_access_token(
        current_user.id,
        current_user.email,
        token_version=current_user.token_version,
    )
    return {
        "ok": True,
        "has_password": True,
        "token_version": current_user.token_version,
        "access_token": fresh_token,
        "detail": (
            "Parol muvaffaqiyatli o'zgartirildi va barcha eski sessiyalar bekor qilindi"
            if has_existing_password
            else "Parol muvaffaqiyatli o'rnatildi va eski sessiyalar yangilandi"
        ),
    }


@router.post("/auth/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke current JWT access token and invalidate user session durably."""
    await _invalidate_user_sessions_db(credentials.credentials, current_user, db)
    return {"ok": True, "detail": "Sessiya muvaffaqiyatli yakunlandi"}


@router.post("/auth/revoke-sessions")
async def revoke_all_sessions(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all active JWT/browser sessions across every device for the current user."""
    await _invalidate_user_sessions_db(
        credentials.credentials,
        current_user,
        db,
        audit_action="SESSIONS_REVOKED_ALL",
    )
    return {"ok": True, "detail": "Barcha qurilmalardagi faol sessiyalar bekor qilindi"}


@router.post("/auth/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set initial password or change existing password, revoking all previous active sessions."""
    return await _apply_password_update(payload, db, current_user)


@router.post("/auth/set-password")
async def set_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alias for setting or updating account password from the Profile security panel."""
    return await _apply_password_update(payload, db, current_user)


@router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Send a 6-digit password reset OTP via Telegram and/or SMTP Email fallback."""
    from app.services import email_service

    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    client_ip = get_trustworthy_client_ip(request)
    ip_rate_key = f"forgot_ip:{client_ip}"
    if is_rate_limited(ip_rate_key, max_attempts=60, window_seconds=300):
        wait_s = get_rate_limit_retry_after(ip_rate_key, max_attempts=60, window_seconds=300)
        return _rate_limit_response(
            f"Juda ko'p so'rov yuborildi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )

    cooldown_key = f"forgot_pw_cooldown:{clean_email}"
    if is_rate_limited(cooldown_key, max_attempts=1, window_seconds=PASSWORD_RESET_COOLDOWN_SECONDS):
        wait_s = get_rate_limit_retry_after(
            cooldown_key,
            max_attempts=1,
            window_seconds=PASSWORD_RESET_COOLDOWN_SECONDS,
        )
        return _rate_limit_response(
            f"Yangi kod so'rash uchun {wait_s} soniya kuting.",
            wait_s,
        )

    rate_key = f"forgot_pw:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=300):
        wait_s = get_rate_limit_retry_after(rate_key, max_attempts=5, window_seconds=300)
        return _rate_limit_response(
            f"Juda ko'p so'rov yuborildi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )
    record_attempt(rate_key)
    record_attempt(cooldown_key)
    record_attempt(ip_rate_key)

    result = await db.execute(
        select(User).where(User.email == clean_email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if user is not None:
        from app.services.telegram import telegram as default_telegram

        can_send_tg = bool(user.telegram_user_id and default_telegram is not None)
        can_send_email = bool(
            email_service.is_deliverable_email(user.email) and email_service.is_smtp_configured()
        )
        if can_send_tg or can_send_email:
            now = datetime.now(timezone.utc)
            await db.execute(
                update(PasswordResetToken)
                .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
                .values(used_at=now)
            )
            code = f"{secrets.randbelow(900000) + 100000}"
            channels: list[str] = []
            if can_send_tg:
                channels.append("telegram")
            if can_send_email:
                channels.append("email")

            reset_row = PasswordResetToken(
                user_id=user.id,
                code_hash=_hash_password_reset_code(user.id, code),
                expires_at=now + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES),
            )
            db.add(reset_row)
            db.add(
                AuditLog(
                    user_id=user.id,
                    action="password_reset_requested",
                    resource="user",
                    resource_id=str(user.id),
                    metadata_json={"channels": channels},
                )
            )
            await db.commit()

            sent_any = False
            if can_send_tg:
                try:
                    await default_telegram.send_message(
                        user.telegram_user_id,
                        (
                            "Selloi hisobingiz uchun parolni tiklash kodi:\n\n"
                            f"Kod: {code}\n\n"
                            f"Ushbu kod {PASSWORD_RESET_TTL_MINUTES} daqiqa davomida amal qiladi. "
                            "Agar bu so'rovni siz yubormagan bo'lsangiz, xabarni e'tiborsiz qoldiring."
                        ),
                    )
                    sent_any = True
                except Exception as exc:
                    logger.warning("Telegram parol tiklash kodini yuborishda xatolik user_id=%s: %s", user.id, exc)

            if can_send_email:
                try:
                    if await email_service.send_password_reset_email(user.email, code, user.full_name or ""):
                        sent_any = True
                except Exception as exc:
                    logger.warning("Email parol tiklash kodini yuborishda xatolik user_id=%s: %s", user.id, exc)

            if not sent_any:
                reset_row.used_at = datetime.now(timezone.utc)
                await db.commit()

    return {
        "ok": True,
        "detail": "Agar akkauntingiz Telegramga yoki email pochtangizga ulangan bo'lsa, 6 xonali tasdiqlash kodi yuborildi.",
        "expires_in_seconds": PASSWORD_RESET_TTL_MINUTES * 60,
        "resend_cooldown_seconds": PASSWORD_RESET_COOLDOWN_SECONDS,
    }


async def _verify_password_reset_otp(
    db: AsyncSession,
    *,
    clean_email: str,
    clean_code: str,
    rate_key: str,
    consume: bool,
) -> tuple[User, PasswordResetToken, datetime, int]:
    """Validate an active 6-digit password reset OTP for verify-only or final password update."""
    if not (clean_code.isdigit() and len(clean_code) == 6):
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi 6 xonali raqam bo'lishi kerak")

    user_res = await db.execute(
        select(User).where(User.email == clean_email, User.is_active.is_(True))
    )
    user = user_res.scalar_one_or_none()
    if user is None:
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi noto'g'ri yoki muddati tugagan")

    token_res = await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .order_by(PasswordResetToken.id.desc())
        .limit(1)
    )
    reset_row = token_res.scalar_one_or_none()
    if reset_row is None:
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi noto'g'ri yoki muddati tugagan")

    expected_hash = _hash_password_reset_code(user.id, clean_code)
    now, remaining_seconds = await _verify_otp_row(
        db,
        row=reset_row,
        expected_hash=expected_hash,
        rate_key=rate_key,
        consume=consume,
        cooldown_reset_key=f"forgot_pw_cooldown:{clean_email}",
    )
    return user, reset_row, now, remaining_seconds


@router.post("/auth/verify-reset-otp")
async def verify_reset_otp(payload: VerifyResetOtpRequest, db: AsyncSession = Depends(get_db)):
    """Verify the 6-digit reset OTP before advancing to the new password step."""
    clean_email = payload.email.strip().lower()
    clean_code = payload.code.strip()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"verify_reset_otp:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=300):
        wait_s = get_rate_limit_retry_after(rate_key, max_attempts=5, window_seconds=300)
        return _rate_limit_response(
            f"Juda ko'p noto'g'ri urinish qilindi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )

    _, _, _, remaining_seconds = await _verify_password_reset_otp(
        db,
        clean_email=clean_email,
        clean_code=clean_code,
        rate_key=rate_key,
        consume=False,
    )
    reset_rate_limit(rate_key)
    return {
        "ok": True,
        "verified": True,
        "detail": "Tasdiqlash kodi to'g'ri. Endi yangi parol o'rnating.",
        "expires_in_seconds": remaining_seconds,
    }


@router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Verify 6-digit Telegram/Email OTP and reset password, invalidating prior sessions."""
    clean_email = payload.email.strip().lower()
    clean_code = payload.code.strip()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"reset_pw:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=10, window_seconds=300):
        wait_s = get_rate_limit_retry_after(rate_key, max_attempts=10, window_seconds=300)
        return _rate_limit_response(
            f"Juda ko'p urinishlar qilindi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )

    user, reset_row, now, _ = await _verify_password_reset_otp(
        db,
        clean_email=clean_email,
        clean_code=clean_code,
        rate_key=rate_key,
        consume=True,
    )

    user.hashed_password = hash_password(payload.new_password)
    user.token_version = (getattr(user, "token_version", 1) or 1) + 1
    user.updated_at = now
    await db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.id != reset_row.id,
        )
        .values(used_at=now)
    )
    db.add(
        AuditLog(
            user_id=user.id,
            action="password_reset_completed",
            resource="user",
            resource_id=str(user.id),
            metadata_json={"token_id": reset_row.id},
        )
    )
    await db.commit()

    revoke_user_sessions(user.id)
    reset_rate_limit(f"login:{clean_email}")
    reset_rate_limit(f"forgot_pw:{clean_email}")
    reset_rate_limit(f"forgot_pw_cooldown:{clean_email}")
    reset_rate_limit(f"verify_reset_otp:{clean_email}")
    reset_rate_limit(rate_key)
    return {
        "ok": True,
        "detail": "Parol muvaffaqiyatli yangilandi. Endi yangi parol bilan tizimga kirishingiz mumkin.",
    }


@router.post("/auth/resend-verification")
async def resend_email_verification(payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    """Send or resend a 6-digit email verification code via SMTP (non-enumerating)."""
    from app.services import email_service

    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"resend_verify:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p so'rov yuborildi. 5 daqiqadan so'ng qayta urinib ko'ring.",
        )
    record_attempt(rate_key)

    user = (
        await db.execute(select(User).where(User.email == clean_email, User.is_active.is_(True)))
    ).scalar_one_or_none()
    if (
        user is not None
        and not getattr(user, "email_verified", False)
        and email_service.is_smtp_configured()
        and email_service.is_deliverable_email(clean_email)
    ):
        _row, _sent = await _issue_email_verification_otp(db, user)
        await db.commit()

    return {
        "ok": True,
        "detail": "Agar hisobingiz mavjud va tasdiqlanmagan bo'lsa, 6 xonali tasdiqlash kodi emailingizga yuborildi.",
    }


@router.post("/auth/bind-email/init")
async def bind_email_init(
    payload: BindEmailInitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a 6-digit OTP to bind & verify a real email address for the signed-in account."""
    from app.services import email_service

    clean_email = payload.email.strip().lower()
    if not is_real_email(clean_email) or not email_service.is_deliverable_email(clean_email):
        raise HTTPException(status_code=400, detail="Haqiqiy email manzilini kiriting (masalan: name@gmail.com)")

    if is_real_email(current_user.email) and current_user.email.strip().lower() != clean_email:
        raise HTTPException(
            status_code=409,
            detail="Bu hisobga boshqa email manzili allaqachon bog'langan.",
        )

    cooldown_key = f"bind_email_cooldown:{current_user.id}"
    if is_rate_limited(cooldown_key, max_attempts=1, window_seconds=PASSWORD_RESET_COOLDOWN_SECONDS):
        wait_s = get_rate_limit_retry_after(
            cooldown_key,
            max_attempts=1,
            window_seconds=PASSWORD_RESET_COOLDOWN_SECONDS,
        )
        return _rate_limit_response(
            f"Yangi kod so'rash uchun {wait_s} soniya kuting.",
            wait_s,
        )

    rate_key = f"bind_email_init:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=300):
        wait_s = get_rate_limit_retry_after(rate_key, max_attempts=5, window_seconds=300)
        return _rate_limit_response(
            f"Juda ko'p so'rov yuborildi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )

    existing_holder = (
        await db.execute(select(User).where(User.email == clean_email, User.id != current_user.id))
    ).scalar_one_or_none()
    if existing_holder is not None:
        if not existing_holder.is_active:
            raise HTTPException(status_code=403, detail="Ushbu email hisobi bloklangan.")
        if (
            existing_holder.telegram_user_id is not None
            and current_user.telegram_user_id is not None
            and int(existing_holder.telegram_user_id) != int(current_user.telegram_user_id)
        ):
            raise HTTPException(
                status_code=409,
                detail="Ushbu email manzili boshqa Telegram hisobiga allaqachon ulangan. 1 ta Telegramga faqat 1 ta email ruxsat etiladi.",
            )

    record_attempt(rate_key)
    record_attempt(cooldown_key)

    _row, sent = await _issue_email_verification_otp(db, current_user, target_email=clean_email)
    if not sent and email_service.is_smtp_configured():
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tasdiqlash xatini yuborib bo'lmadi. Email manzilingizni tekshiring yoki Google orqali kiring.",
        )
    await db.commit()
    return {
        "ok": True,
        "detail": f"{clean_email} manziliga 6 xonali tasdiqlash kodi yuborildi.",
        "expires_in_seconds": EMAIL_VERIFY_TTL_MINUTES * 60,
        "resend_cooldown_seconds": PASSWORD_RESET_COOLDOWN_SECONDS,
    }


@router.post("/auth/bind-email/confirm", response_model=TokenResponse)
async def bind_email_confirm(
    payload: BindEmailConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm 6-digit OTP to verify & bind a real email onto the signed-in Telegram account."""
    clean_email = payload.email.strip().lower()
    clean_code = payload.code.strip()

    if not is_real_email(clean_email):
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"bind_email_confirm:{current_user.id}:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=10, window_seconds=300):
        wait_s = get_rate_limit_retry_after(rate_key, max_attempts=10, window_seconds=300)
        return _rate_limit_response(
            f"Juda ko'p urinishlar qilindi. {wait_s} soniyadan so'ng qayta urinib ko'ring.",
            wait_s,
        )

    if not (clean_code.isdigit() and len(clean_code) == 6):
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi 6 xonali raqam bo'lishi kerak")

    token_row = (
        await db.execute(
            select(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == current_user.id,
                EmailVerificationToken.email == clean_email,
                EmailVerificationToken.used_at.is_(None),
            )
            .order_by(EmailVerificationToken.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    expected_hash = _hash_email_verification_code(current_user.id, clean_email, clean_code)
    now = await _verify_and_consume_otp_row(
        db,
        row=token_row,
        expected_hash=expected_hash,
        rate_key=rate_key,
    )

    if payload.password and len(payload.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Parol kamida 6 belgidan iborat bo'lishi kerak")

    existing_holder = (
        await db.execute(select(User).where(User.email == clean_email, User.id != current_user.id))
    ).scalar_one_or_none()

    if existing_holder is not None:
        if (
            existing_holder.telegram_user_id is not None
            and current_user.telegram_user_id is not None
            and int(existing_holder.telegram_user_id) != int(current_user.telegram_user_id)
        ):
            raise HTTPException(
                status_code=409,
                detail="Ushbu email manzili boshqa Telegram hisobiga allaqachon ulangan.",
            )
        existing_holder.email_verified = True
        existing_holder.email_verified_at = existing_holder.email_verified_at or now
        final_user = await _merge_email_and_telegram_users(
            db,
            email_user=existing_holder,
            tg_user=current_user,
            preferred_password=payload.password,
        )
    else:
        if is_real_email(current_user.email) and current_user.email.strip().lower() != clean_email:
            raise HTTPException(status_code=409, detail="Bu hisobga boshqa email allaqachon ulangan.")
        current_user.email = clean_email
        current_user.email_verified = True
        current_user.email_verified_at = now
        current_user.updated_at = now
        if _is_configured_admin_email(clean_email):
            current_user.is_platform_owner = True
        if payload.password and payload.password.strip():
            current_user.hashed_password = hash_password(payload.password.strip())
        final_user = current_user

    db.add(
        AuditLog(
            user_id=final_user.id,
            action="email_bound_and_verified",
            resource="user",
            resource_id=str(final_user.id),
            metadata_json={"email": clean_email, "telegram_user_id": final_user.telegram_user_id},
        )
    )
    await db.commit()
    await db.refresh(final_user)

    reset_rate_limit(rate_key)
    reset_rate_limit(f"bind_email_cooldown:{current_user.id}")
    reset_rate_limit(f"bind_email_init:{clean_email}")

    access_token = create_access_token(
        final_user.id,
        final_user.email,
        token_version=getattr(final_user, "token_version", 1) or 1,
    )
    return _build_token_response(
        final_user,
        access_token=access_token,
        verification_required=False,
        detail="Email manzilingiz muvaffaqiyatli tasdiqlandi va hisoblar birlashtirildi!",
    )


@router.post("/auth/verify-email", response_model=TokenResponse)
async def verify_email_otp(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Verify a user's email address with a 6-digit OTP and issue an active JWT."""
    clean_email = payload.email.strip().lower()
    clean_code = payload.code.strip()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"verify_email:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=10, window_seconds=300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p urinishlar qilindi. 5 daqiqadan so'ng qayta urinib ko'ring.",
        )

    if not (clean_code.isdigit() and len(clean_code) == 6):
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi 6 xonali raqam bo'lishi kerak")

    user = (
        await db.execute(select(User).where(User.email == clean_email, User.is_active.is_(True)))
    ).scalar_one_or_none()
    if user is None:
        record_attempt(rate_key)
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi noto'g'ri yoki muddati tugagan")

    token_row = (
        await db.execute(
            select(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user.id,
                EmailVerificationToken.email == clean_email,
                EmailVerificationToken.used_at.is_(None),
            )
            .order_by(EmailVerificationToken.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    expected_hash = _hash_email_verification_code(user.id, clean_email, clean_code)
    now = await _verify_and_consume_otp_row(
        db,
        row=token_row,
        expected_hash=expected_hash,
        rate_key=rate_key,
    )

    user.email_verified = True
    user.email_verified_at = now
    user.updated_at = now
    if _is_configured_admin_email(clean_email):
        user.is_platform_owner = True
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.id != token_row.id,
        )
        .values(used_at=now)
    )
    db.add(
        AuditLog(
            user_id=user.id,
            action="email_verified",
            resource="user",
            resource_id=str(user.id),
            metadata_json={"email": clean_email},
        )
    )
    await db.commit()
    await db.refresh(user)

    reset_rate_limit(rate_key)
    reset_rate_limit(f"resend_verify:{clean_email}")
    reset_rate_limit(f"login:{clean_email}")

    access_token = create_access_token(
        user.id,
        user.email,
        token_version=getattr(user, "token_version", 1) or 1,
    )
    return _build_token_response(
        user,
        access_token=access_token,
        verification_required=False,
        detail="Email manzilingiz muvaffaqiyatli tasdiqlandi!",
    )


def _hash_invite_token(raw_token: str) -> str:
    return hashlib.sha256((raw_token or "").strip().encode("utf-8")).hexdigest()


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class AcceptInviteRequest(BaseModel):
    token: str = Field(min_length=8, max_length=256)
    full_name: str = ""
    password: str | None = None


@router.get("/auth/invite-info")
async def get_team_invite_info(token: str, db: AsyncSession = Depends(get_db)):
    """Inspect a team email invitation token without modifying state."""
    token_hash = _hash_invite_token(token)
    invite = (
        await db.execute(select(OrganizationInvite).where(OrganizationInvite.token_hash == token_hash))
    ).scalar_one_or_none()
    if invite is None or invite.status != "pending":
        raise HTTPException(status_code=404, detail="Taklifnoma topilmadi yoki allaqachon ishlatilgan")

    exp = _as_utc(invite.expires_at)
    if exp and datetime.now(timezone.utc) >= exp:
        raise HTTPException(status_code=400, detail="Taklifnoma muddati tugagan")

    org = await db.get(Organization, invite.organization_id)
    existing_user = (
        await db.execute(select(User).where(User.email == invite.email.lower()))
    ).scalar_one_or_none()
    return {
        "valid": True,
        "email": invite.email,
        "role": invite.role,
        "organization_id": invite.organization_id,
        "organization_name": org.name if org else "Selloi Do'kon",
        "requires_registration": existing_user is None,
        "expires_at": invite.expires_at.isoformat() if invite.expires_at else None,
    }


@router.post("/auth/accept-invite")
async def accept_team_invite(payload: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    """Accept an email team invitation, register/verify the user, and activate membership."""
    token_hash = _hash_invite_token(payload.token)
    invite = (
        await db.execute(select(OrganizationInvite).where(OrganizationInvite.token_hash == token_hash))
    ).scalar_one_or_none()
    if invite is None or invite.status != "pending":
        raise HTTPException(status_code=404, detail="Taklifnoma topilmadi yoki allaqachon ishlatilgan")

    now = datetime.now(timezone.utc)
    exp = _as_utc(invite.expires_at)
    if exp and now >= exp:
        invite.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Taklifnoma muddati tugagan")

    clean_email = invite.email.strip().lower()
    user = (await db.execute(select(User).where(User.email == clean_email))).scalar_one_or_none()
    if user is None:
        pwd = (payload.password or "").strip()
        if len(pwd) < 6:
            raise HTTPException(
                status_code=400,
                detail="Yangi hisob yaratish uchun kamida 6 belgidan iborat parol kiriting",
            )
        user = User(
            email=clean_email,
            hashed_password=hash_password(pwd),
            full_name=(payload.full_name or clean_email.split("@")[0]).strip()[:120],
            email_verified=True,
            email_verified_at=now,
            is_active=True,
        )
        db.add(user)
        await db.flush()
    else:
        if payload.password:
            if not verify_password(payload.password, user.hashed_password):
                raise HTTPException(status_code=401, detail="Bu email uchun kiritilgan parol noto'g'ri")
        user.is_active = True
        user.email_verified = True
        user.email_verified_at = user.email_verified_at or now
        if payload.full_name and payload.full_name.strip():
            user.full_name = payload.full_name.strip()[:120]

    perms = invite.permissions or ROLE_DEFAULTS.get(invite.role, ROLE_DEFAULTS["operator"])
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == invite.organization_id,
                OrganizationMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        member = OrganizationMember(
            organization_id=invite.organization_id,
            user_id=user.id,
            role=invite.role,
            permissions=dict(perms),
            is_active=True,
        )
        db.add(member)
    else:
        member.role = invite.role
        member.permissions = dict(perms)
        member.is_active = True

    invite.status = "accepted"
    invite.accepted_at = now
    db.add(
        AuditLog(
            organization_id=invite.organization_id,
            user_id=user.id,
            action="team.invite_accepted",
            resource="organization_invite",
            resource_id=str(invite.id),
            metadata_json={"email": clean_email, "role": invite.role},
        )
    )
    await db.commit()
    await db.refresh(user)

    token = create_access_token(
        user.id,
        user.email,
        token_version=getattr(user, "token_version", 1) or 1,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "organization_id": invite.organization_id,
        "role": invite.role,
    }


# ---------------------------------------------------------------------------
# Organization CRUD & Credentials Management (JWT Protected)
# ---------------------------------------------------------------------------

@router.post("/organizations", response_model=OrganizationOut, status_code=201)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Create a new organization. The creator automatically becomes the owner."""
    clean_slug = payload.slug.strip().lower()

    # Check slug uniqueness
    existing_slug = await db.execute(select(Organization).where(Organization.slug == clean_slug))
    if existing_slug.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Bu slug allaqachon band")

    # Check bot token uniqueness if provided
    token = payload.telegram_bot_token.strip() if payload.telegram_bot_token else None
    if token:
        all_orgs = (await db.execute(select(Organization).where(Organization.telegram_bot_token.isnot(None)))).scalars().all()
        if any(o.decrypted_bot_token == token for o in all_orgs):
            raise HTTPException(status_code=400, detail="Bu Telegram bot token boshqa tashkilotda ishlatilmoqda")

    org = Organization(
        name=payload.name.strip(),
        slug=clean_slug,
        category=payload.category,
        ai_language=payload.ai_language,
        ai_personality=payload.ai_personality,
        custom_system_prompt=payload.custom_system_prompt,
        telegram_bot_token=encrypt_secret(token) if token else None,
        openai_api_key=encrypt_secret(payload.openai_api_key.strip()) if payload.openai_api_key else None,
        gemini_api_key=encrypt_secret(payload.gemini_api_key.strip()) if payload.gemini_api_key else None,
    )
    db.add(org)
    await db.flush()

    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role="owner",
        permissions={},
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)

    return _org_to_out(org)


@router.get("/organizations", response_model=list[OrganizationOut])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """List all organizations that current user belongs to."""
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.user_id == current_user.id, OrganizationMember.is_active == True)
        .order_by(Organization.created_at.desc())
    )
    orgs = result.scalars().all()
    return [_org_to_out(org) for org in orgs]


@router.get("/organizations/{org_id}", response_model=OrganizationOut)
async def get_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Get details of an organization."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    # Verify membership
    member = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.is_active == True,
        )
    )
    if member.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Siz bu tashkilot a'zosi emassiz")

    return _org_to_out(org)


@router.patch("/organizations/{org_id}", response_model=OrganizationOut)
async def update_organization(
    org_id: int,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Update organization settings, bot token, or AI keys from dashboard."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    # Verify owner or admin permission
    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["owner", "admin"]),
            OrganizationMember.is_active == True,
        )
    )
    if member_res.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Faqat owner yoki admin tashkilot sozlamalarini o'zgartira oladi")

    # Check bot token uniqueness if being updated
    if payload.telegram_bot_token is not None:
        new_token = payload.telegram_bot_token.strip() or None
        if new_token:
            all_orgs = (await db.execute(select(Organization).where(Organization.telegram_bot_token.isnot(None)))).scalars().all()
            if any(o.decrypted_bot_token == new_token and o.id != org_id for o in all_orgs):
                raise HTTPException(status_code=400, detail="Bu Telegram bot token boshqa tashkilotda ishlatilmoqda")
        org.telegram_bot_token = encrypt_secret(new_token) if new_token else None

    if payload.name is not None:
        org.name = payload.name.strip()
    if payload.category is not None:
        org.category = payload.category
    if payload.ai_language is not None:
        org.ai_language = payload.ai_language
    if payload.ai_personality is not None:
        org.ai_personality = payload.ai_personality
    if payload.custom_system_prompt is not None:
        org.custom_system_prompt = payload.custom_system_prompt
    if payload.openai_api_key is not None:
        raw_key = payload.openai_api_key.strip() or None
        org.openai_api_key = encrypt_secret(raw_key) if raw_key else None
    if payload.gemini_api_key is not None:
        raw_key = payload.gemini_api_key.strip() or None
        org.gemini_api_key = encrypt_secret(raw_key) if raw_key else None

    await db.commit()
    await db.refresh(org)
    return _org_to_out(org)


@router.post("/organizations/{org_id}/verify-bot")
async def verify_organization_bot(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Test and verify the organization's Telegram bot token with Telegram getMe API."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    # Verify membership
    member = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.is_active == True,
        )
    )
    if member.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Siz bu tashkilot a'zosi emassiz")

    if not org.decrypted_bot_token:
        raise HTTPException(status_code=400, detail="Tashkilotda Telegram bot token kiritilmagan")

    retries = 2
    last_exc: Optional[Exception] = None
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(f"https://api.telegram.org/bot{org.decrypted_bot_token}/getMe")
                data = resp.json()
                if not data.get("ok"):
                    desc = data.get("description", "Noto'g'ri bot token")
                    return {
                        "valid": False,
                        "error": f"Telegram xatosi: {desc}",
                    }
                bot_info = data.get("result", {})
                return {
                    "valid": True,
                    "bot_id": bot_info.get("id"),
                    "bot_name": bot_info.get("first_name"),
                    "bot_username": bot_info.get("username"),
                }
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_exc = exc
            if attempt < retries - 1:
                await asyncio.sleep(1.0)
                continue
        except Exception as exc:
            last_exc = exc
            break

    if isinstance(last_exc, httpx.TimeoutException):
        err_msg = "Telegram serveridan javob kelmadi (Vaqt tugadi / Timeout). Iltimos, qayta urinib ko'ring."
    elif isinstance(last_exc, httpx.ConnectError):
        err_msg = "Telegram serveriga ulanishda tarmoq xatosi yuz berdi. Internet aloqasini tekshirib, qayta urinib ko'ring."
    else:
        detail = str(last_exc).strip() or (last_exc.__class__.__name__ if last_exc else "Noma'lum xatolik")
        err_msg = f"Telegram API bilan bog'lanib bo'lmadi ({detail})"

    return {"valid": False, "error": err_msg}
