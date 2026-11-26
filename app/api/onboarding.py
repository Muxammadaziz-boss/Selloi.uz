"""Organization onboarding, configuration, and authentication endpoints."""

import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import secrets
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import (
    decrypt_secret,
    encrypt_secret,
    hash_password,
    is_rate_limited,
    mask_secret,
    record_attempt,
    reset_rate_limit,
    revoke_token,
    revoke_user_sessions,
    verify_password,
)
from app.dependencies.auth import create_access_token, decode_access_token, get_current_user, security
from app.models import AuditLog, Organization, OrganizationMember, PasswordResetToken, User
from app.schemas import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
    RegisterRequest,
    ResetPasswordRequest,
    TelegramAuthRequest,
    TokenRequest,
    TokenResponse,
)

router = APIRouter(prefix="/api/v1", tags=["onboarding"])
logger = logging.getLogger(__name__)
PASSWORD_RESET_TTL_MINUTES = 10


def _hash_password_reset_code(user_id: int, code: str) -> str:
    """Compute keyed HMAC-SHA256 digest for a password reset OTP."""
    secret = (get_settings().jwt_secret or "selloi-pwreset-dev-fallback").encode("utf-8")
    msg = f"pwreset:{user_id}:{code.strip()}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _is_configured_admin_email(email: str) -> bool:
    """Return True if the verified email matches ADMIN_EMAIL in settings."""
    configured = (get_settings().admin_email or "").strip()
    if not configured:
        return False
    allowed = {part.strip().lower() for part in configured.split(",") if part.strip()}
    return email.strip().lower() in allowed


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
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new platform user."""
    clean_email = payload.email.strip().lower()

    rate_key = f"register:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Ro'yxatdan o'tish uchun juda ko'p urinish. 1 daqiqadan so'ng qayta urinib ko'ring.",
        )
    record_attempt(rate_key)

    existing = await db.execute(select(User).where(User.email == clean_email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Bu email allaqachon ro'yxatdan o'tgan")

    user = User(
        email=clean_email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        telegram_user_id=user.telegram_user_id,
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: TokenRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email & password to receive a JWT access token."""
    clean_email = payload.email.strip().lower()

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
        raise HTTPException(status_code=401, detail="Email yoki parol noto'g'ri")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Foydalanuvchi faol emas")

    reset_rate_limit(rate_key)
    if _is_configured_admin_email(clean_email) and not user.is_platform_owner:
        user.is_platform_owner = True
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        telegram_user_id=user.telegram_user_id,
    )


@router.post("/auth/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate or register a user via Google OAuth."""
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"google_auth:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=10, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p urinishlar qilindi. 1 daqiqadan so'ng qayta urinib ko'ring.",
        )

    result = await db.execute(select(User).where(User.email == clean_email))
    user = result.scalar_one_or_none()

    is_owner_email = _is_configured_admin_email(clean_email)

    if user is None:
        display_name = payload.full_name.strip() or clean_email.split("@")[0]
        user = User(
            email=clean_email,
            full_name=display_name,
            hashed_password="",
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
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        telegram_user_id=user.telegram_user_id,
    )


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

    auth_data = consume_auth_session(code)
    if not auth_data:
        pending = check_auth_session(code)
        if pending:
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
            is_platform_owner=is_owner_tg,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Foydalanuvchi hisobi faol emas")
        user.telegram_user_id = clean_id
        if is_owner_tg and not user.is_platform_owner:
            user.is_platform_owner = True
        if full_name:
            user.full_name = full_name
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id, user.email, token_version=getattr(user, "token_version", 1) or 1)
    return {
        "status": "verified",
        "access_token": token,
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "telegram_user_id": user.telegram_user_id,
        "username": clean_username,
    }


@router.post("/auth/telegram", response_model=TokenResponse)
async def telegram_auth(payload: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate or register a user via Telegram handle or ID (protected)."""
    raise HTTPException(
        status_code=400,
        detail="Xavfsizlik yuzasidan Telegram orqali kirish bot tasdig'i orqali amalga oshirilishi shart.",
    )


@router.get("/auth/me")
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get profile of current logged-in user."""
    is_owner = bool(current_user.is_platform_owner)
    is_site_admin = bool(getattr(current_user, "is_platform_admin", False))
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "telegram_user_id": current_user.telegram_user_id,
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
    """Update user profile. Unrelated profile changes must not invalidate active sessions."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.telegram_user_id is not None:
        current_user.telegram_user_id = payload.telegram_user_id
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
    current_password: str
    new_password: str = Field(min_length=6)


@router.post("/auth/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke current JWT access token and invalidate user session durably."""
    raw_token = credentials.credentials
    try:
        payload = decode_access_token(raw_token)
        jti = payload.get("jti")
        if jti:
            revoke_token(jti)
    except Exception:
        pass
    revoke_token(raw_token[-32:])

    # Durable database-backed invalidation across all processes and restarts via token_version
    current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1
    current_user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    revoke_user_sessions(current_user.id)
    return {"ok": True, "detail": "Sessiya muvaffaqiyatli yakunlandi"}


@router.post("/auth/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change user password, automatically revoking all previous active sessions."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hozirgi parol noto'g'ri",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1
    current_user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Invalidate all active tokens issued before this moment
    revoke_user_sessions(current_user.id)
    return {"ok": True, "detail": "Parol muvaffaqiyatli o'zgartirildi va barcha eski sessiyalar bekor qilindi"}


@router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a 6-digit password reset OTP via Telegram if account has a linked Telegram ID."""
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"forgot_pw:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=5, window_seconds=300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p so'rov yuborildi. 5 daqiqadan so'ng qayta urinib ko'ring.",
        )
    record_attempt(rate_key)

    result = await db.execute(
        select(User).where(User.email == clean_email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if user is not None and user.telegram_user_id:
        from app.services.telegram import telegram as default_telegram

        if default_telegram is not None:
            now = datetime.now(timezone.utc)
            await db.execute(
                update(PasswordResetToken)
                .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
                .values(used_at=now)
            )
            code = f"{secrets.randbelow(900000) + 100000}"
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
                    metadata_json={"channel": "telegram"},
                )
            )
            await db.commit()
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
            except Exception as exc:
                logger.warning("Telegram parol tiklash kodini yuborishda xatolik user_id=%s: %s", user.id, exc)
                reset_row.used_at = datetime.now(timezone.utc)
                await db.commit()

    return {
        "ok": True,
        "detail": "Agar akkauntingiz Telegramga ulangan bo'lsa, 6 xonali tasdiqlash kodi Telegram bot orqali yuborildi.",
    }


@router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Verify 6-digit Telegram OTP and reset password, invalidating prior sessions."""
    clean_email = payload.email.strip().lower()
    clean_code = payload.code.strip()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")

    rate_key = f"reset_pw:{clean_email}"
    if is_rate_limited(rate_key, max_attempts=10, window_seconds=300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p urinishlar qilindi. 5 daqiqadan so'ng qayta urinib ko'ring.",
        )

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

    now = datetime.now(timezone.utc)
    expires_at = (
        reset_row.expires_at
        if reset_row.expires_at.tzinfo is not None
        else reset_row.expires_at.replace(tzinfo=timezone.utc)
    )
    if expires_at <= now:
        reset_row.used_at = now
        await db.commit()
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi muddati tugagan. Yangi kod so'rang.")

    if reset_row.attempts >= reset_row.max_attempts:
        reset_row.used_at = now
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Urinishlar soni tugadi. Yangi tasdiqlash kodi so'rang.",
        )

    expected_hash = _hash_password_reset_code(user.id, clean_code)
    if not hmac.compare_digest(reset_row.code_hash, expected_hash):
        reset_row.attempts += 1
        exhausted = reset_row.attempts >= reset_row.max_attempts
        if exhausted:
            reset_row.used_at = now
        record_attempt(rate_key)
        await db.commit()
        if exhausted:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Urinishlar soni tugadi. Yangi tasdiqlash kodi so'rang.",
            )
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi noto'g'ri")

    user.hashed_password = hash_password(payload.new_password)
    user.token_version = (getattr(user, "token_version", 1) or 1) + 1
    user.updated_at = now
    reset_row.used_at = now
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
    reset_rate_limit(rate_key)
    return {
        "ok": True,
        "detail": "Parol muvaffaqiyatli yangilandi. Endi yangi parol bilan tizimga kirishingiz mumkin.",
    }


# ---------------------------------------------------------------------------
# Organization CRUD & Credentials Management (JWT Protected)
# ---------------------------------------------------------------------------

@router.post("/organizations", response_model=OrganizationOut, status_code=201)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
