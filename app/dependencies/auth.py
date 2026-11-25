"""JWT-based and Master Token authentication dependencies for FastAPI."""

import hmac
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import jwt

from app.core.config import settings
from app.core.db import get_db
from app.core.permissions import ROLE_DEFAULTS
from app.core.security import is_token_revoked, is_user_session_revoked
from app.models import Admin, OrganizationMember, User
from app.services import admin_service

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, email: str, jti: str | None = None, token_version: int = 1) -> str:
    """Create a signed JWT token with unique jti, iat, and token_version for the given user."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_expire_minutes)
    token_id = jti or uuid.uuid4().hex
    payload = {
        "sub": str(user_id),
        "email": email,
        "jti": token_id,
        "iat": int(now.timestamp()),
        "exp": expire,
        "tv": int(token_version),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT token, ensuring it is active and not revoked."""
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET sozlanmagan — .env faylga qo'shing",
        )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token muddati tugagan")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Noto'g'ri token")

    # Check token revocation (individual token blacklist)
    jti = payload.get("jti")
    token_sig = token[-32:] if len(token) >= 32 else token
    if (jti and is_token_revoked(jti)) or is_token_revoked(token_sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token bekor qilingan (revoked)")

    # Check user-level session revocation (e.g. after password change)
    user_id_raw = payload.get("sub")
    if user_id_raw:
        try:
            user_id = int(user_id_raw)
            iat = payload.get("iat")
            if is_user_session_revoked(user_id, iat):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Foydalanuvchi sessiyasi bekor qilingan (session revoked)",
                )
        except ValueError:
            pass

    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the JWT Bearer token."""
    payload = decode_access_token(credentials.credentials)
    user_id = int(payload["sub"])
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Foydalanuvchi topilmadi yoki faol emas")

    # Precise and durable cross-process session invalidation via token_version
    user_tv = getattr(user, "token_version", 1) or 1
    token_tv = payload.get("tv")
    if token_tv is not None:
        if int(token_tv) < int(user_tv):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Foydalanuvchi sessiyasi bekor qilingan (session invalidated)",
            )
    elif int(user_tv) > 1:
        # Legacy token without tv: if user has incremented token_version, reject
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Foydalanuvchi sessiyasi bekor qilingan (session invalidated)",
        )
    return user


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    x_admin_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """Authenticate admin identity strictly via cryptographic JWT token or verified Master Token.

    Security Rules:
    - X-Admin-Telegram-ID header impersonation is completely removed.
    - Missing or unverified credentials immediately return 401 Unauthorized.
    - Synthetic unpersisted owner creation is prohibited.
    """
    # 1. Bearer JWT Authentication (Standard cryptographically verified identity)
    if credentials and credentials.credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            user_id = int(payload.get("sub", 0))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Yaroqsiz yoki muddati tugagan JWT token",
            )

        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Foydalanuvchi topilmadi yoki faol emas",
            )

        # Precise and durable cross-process session invalidation via token_version
        user_tv = getattr(user, "token_version", 1) or 1
        token_tv = payload.get("tv")
        if token_tv is not None:
            if int(token_tv) < int(user_tv):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Foydalanuvchi sessiyasi bekor qilingan (session invalidated)",
                )
        elif int(user_tv) > 1:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Foydalanuvchi sessiyasi bekor qilingan (session invalidated)",
            )

        # Check if user matches an existing Admin row by Telegram User ID
        admin = None
        if user.telegram_user_id:
            admin = await admin_service.get_admin_by_telegram_id(db, user.telegram_user_id)

        # Platform owner or appointed site admin access
        is_plat_owner = bool(user.is_platform_owner)
        is_plat_admin = bool(getattr(user, "is_platform_admin", False))
        if admin is None and (is_plat_owner or is_plat_admin):
            if is_plat_owner and settings.admin_telegram_id:
                admin = await admin_service.get_admin_by_telegram_id(db, settings.admin_telegram_id)
            if admin is None and is_plat_owner:
                admin = await admin_service.ensure_owner(db)
                await db.commit()
            elif admin is None and is_plat_admin:
                admin = Admin(
                    id=user.id,
                    organization_id=1,
                    telegram_user_id=user.telegram_user_id or 0,
                    name=user.full_name or user.email,
                    role="admin",
                    permissions=ROLE_DEFAULTS.get("admin", {}),
                    is_active=True,
                )

        if admin is not None:
            if not admin.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Admin hisobi faol emas",
                )
            admin._user = user
            admin._is_platform_owner = is_plat_owner
            admin._is_platform_admin = is_plat_admin
            return admin

        # If user is an active organization member with admin privileges
        member_res = await db.execute(
            select(OrganizationMember)
            .where(OrganizationMember.user_id == user.id, OrganizationMember.is_active.is_(True))
            .order_by(OrganizationMember.id.asc())
        )
        member = member_res.scalars().first()
        if member is not None:
            role = member.role
            perms = member.permissions or ROLE_DEFAULTS.get(role, {})
            admin_obj = Admin(
                id=user.id,
                organization_id=member.organization_id,
                telegram_user_id=user.telegram_user_id or 0,
                name=user.full_name or user.email,
                role=role,
                permissions=perms,
                is_active=True,
            )
            admin_obj._user = user
            admin_obj._is_platform_owner = is_plat_owner
            admin_obj._is_platform_admin = is_plat_admin
            return admin_obj

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Foydalanuvchida admin yoki boshqaruv ruxsati mavjud emas",
        )

    # 2. Master token check (owner equivalent, for verified server-to-server operations)
    if settings.admin_api_token and x_admin_token and hmac.compare_digest(settings.admin_api_token, x_admin_token):
        owner = None
        if settings.admin_telegram_id:
            owner = await admin_service.get_admin_by_telegram_id(db, settings.admin_telegram_id)
            if owner is None:
                owner = await admin_service.ensure_owner(db)
                await db.commit()
        if owner is not None:
            owner._is_platform_owner = True
            owner._is_platform_admin = True
            return owner
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Master admin hisobi sozlanmagan",
        )

    # 3. Explicitly reject unauthenticated requests or impersonation attempts
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin avtorizatsiyadan o'tmagan",
    )
