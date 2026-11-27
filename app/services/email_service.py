"""Optional SMTP email service for password reset fallback and team invitations."""

from __future__ import annotations

import asyncio
from email.message import EmailMessage
import html
import re
import smtplib
import ssl

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
_NON_ROUTABLE_DOMAINS = ("telegram.selloi.uz", "example.invalid", "localhost.localdomain")


def is_smtp_configured() -> bool:
    """Return True when an SMTP host is configured."""
    return settings.smtp_configured


def is_deliverable_email(email: str | None) -> bool:
    """Return True if the address looks like a routable external email address."""
    clean = (email or "").strip().lower()
    if not clean or not _EMAIL_RE.match(clean):
        return False
    domain = clean.split("@", 1)[1]
    if domain in _NON_ROUTABLE_DOMAINS or domain.endswith(".local"):
        return False
    return True


def _send_email_sync(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> None:
    sender = (settings.smtp_from_email or settings.smtp_username or "noreply@selloi.uz").strip()
    msg = EmailMessage()
    msg["From"] = f"Selloi AI <{sender}>" if "<" not in sender else sender
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    host = settings.smtp_host.strip()
    port = int(settings.smtp_port or (465 if settings.smtp_use_ssl else 587))
    ctx = ssl.create_default_context()

    if settings.smtp_use_ssl or port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15, context=ctx) as server:
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            if settings.smtp_use_tls:
                server.starttls(context=ctx)
                server.ehlo()
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)


async def send_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> bool:
    """Deliver an email via SMTP in a worker thread; never raises on failure."""
    if not is_smtp_configured() or not is_deliverable_email(to_email):
        return False
    try:
        await asyncio.to_thread(
            _send_email_sync,
            to_email=to_email.strip().lower(),
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        return True
    except Exception as exc:
        logger.warning("SMTP xatolik (%s): %s", to_email, exc)
        return False


async def send_password_reset_email(to_email: str, code: str, full_name: str = "") -> bool:
    """Send 6-digit password reset code via email."""
    greeting = f"Salom, {full_name.strip()}!" if full_name and full_name.strip() else "Assalomu alaykum!"
    safe_greeting = html.escape(greeting)
    safe_code = html.escape(code)
    text_body = (
        f"{greeting}\n\n"
        f"Selloi hisobingiz parolini tiklash kodi: {code}\n"
        "Kod 15 daqiqa davomida amal qiladi.\n"
        "Agar siz bu so'rovni yubormagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring."
    )
    html_body = (
        f"<p>{safe_greeting}</p>"
        f"<p>Selloi hisobingiz parolini tiklash kodi:</p>"
        f"<p style='font-size:24px;font-weight:700;letter-spacing:4px;'>{safe_code}</p>"
        f"<p style='color:#666'>Kod 15 daqiqa davomida amal qiladi.</p>"
    )
    return await send_email(
        to_email=to_email,
        subject="Selloi — Parolni tiklash kodi",
        text_body=text_body,
        html_body=html_body,
    )


async def send_team_invite_email(
    *,
    to_email: str,
    org_name: str,
    inviter_name: str,
    role: str,
    invite_url: str,
) -> bool:
    """Send a workspace team invitation email containing the single-use invite URL."""
    safe_org = html.escape(org_name or "Selloi Do'kon")
    safe_inviter = html.escape(inviter_name or "Administrator")
    safe_role = html.escape(role)
    safe_url = html.escape(invite_url)
    text_body = (
        f"Assalomu alaykum!\n\n"
        f"{inviter_name} sizni \"{org_name}\" do'koni jamoasiga ({role} roli bilan) taklif qildi.\n\n"
        f"Taklifni qabul qilish va panelga kirish uchun quyidagi havolani oching:\n{invite_url}\n\n"
        "Havola 7 kun davomida amal qiladi."
    )
    html_body = (
        f"<p>Assalomu alaykum!</p>"
        f"<p><strong>{safe_inviter}</strong> sizni <strong>{safe_org}</strong> do'koni jamoasiga "
        f"(<code>{safe_role}</code> roli bilan) taklif qildi.</p>"
        f"<p><a href='{safe_url}' style='display:inline-block;padding:10px 18px;"
        f"background:#e11d48;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;'>"
        f"Jamoaga Qo'shilish</a></p>"
        f"<p style='color:#666;font-size:12px;'>Havola 7 kun davomida amal qiladi.</p>"
    )
    return await send_email(
        to_email=to_email,
        subject=f"Selloi — {org_name} jamoasiga taklifnoma",
        text_body=text_body,
        html_body=html_body,
    )
