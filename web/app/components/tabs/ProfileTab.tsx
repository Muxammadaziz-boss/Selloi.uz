"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import { api } from "../../lib/dashboardApi";
import {
  IconUser,
  IconShieldCheck,
  IconSun,
  IconMoon,
  IconCheck,
  IconLogout,
  IconTypography,
  IconSparkles,
  IconLock,
  IconMail,
  IconBrandTelegram,
  IconSend,
  IconLoader2,
  IconKey,
  IconEye,
  IconEyeOff,
  IconShieldLock,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { PageHeader } from "../layout/PageHeader";
import { DesignSelector } from "../design/DesignSelector";

export const FONT_OPTIONS = [
  {
    id: "quicksand",
    name: "Quicksand",
    subtitle: "Modern Geometric Rounded Sans",
    fontFamily: "'Quicksand', sans-serif",
    styleTag: "Modern & Clean",
    imagePreview: null,
    isNew: true,
  },
  {
    id: "olline",
    name: "Olline",
    subtitle: "Heavy Display Sans",
    fontFamily: "'Olline', 'Outfit', 'Syne', sans-serif",
    styleTag: "Modern Headline",
    imagePreview: "/fonts/olline-preview.png",
    isNew: true,
  },
  {
    id: "pogonia",
    name: "Pogonia",
    subtitle: "Clean Geometric Sans",
    fontFamily: "'Pogonia', 'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif",
    styleTag: "Fresh & Tech",
    imagePreview: "/fonts/pogonia-preview.png",
    isNew: true,
  },
  {
    id: "inter",
    name: "Inter",
    subtitle: "Linear Enterprise UI",
    fontFamily: "'Inter', sans-serif",
    styleTag: "Linear Style",
    imagePreview: null,
    isNew: false,
  },
  {
    id: "sf-pro",
    name: "SF Pro",
    subtitle: "Apple Native System",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    styleTag: "Apple Clean",
    imagePreview: null,
    isNew: false,
  },
  {
    id: "jakarta",
    name: "Plus Jakarta",
    subtitle: "Modern Geometric",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    styleTag: "Geometric",
    imagePreview: null,
    isNew: false,
  },
];

export interface ProfileTabProps {
  currentAdmin: any;
  activeAdminTelegramId: number;
  profileAvatarError: boolean;
  setProfileAvatarError: (b: boolean) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  appFont: string;
  onSelectFont: (fontId: string) => void;
  onLogout: () => void;
  permissionLabels: Record<string, string>;
  onNavigateToBilling?: () => void;
  onReturnToAdmin?: () => void;
}

export function ProfileTab({
  currentAdmin,
  activeAdminTelegramId,
  profileAvatarError,
  setProfileAvatarError,
  theme,
  setTheme,
  appFont,
  onSelectFont,
  onLogout,
  permissionLabels,
  onNavigateToBilling,
  onReturnToAdmin,
}: ProfileTabProps) {
  const { language, setLanguage, t } = useLanguage();
  const isOwner = currentAdmin?.role === "platform_owner" || currentAdmin?.role === "owner" || Boolean(currentAdmin?.isPlatformOwner);
  const isSiteAdmin = currentAdmin?.role === "platform_admin" || Boolean(currentAdmin?.isPlatformAdmin);
  type AuthMeProfile = {
    email?: string;
    email_verified?: boolean;
    smtp_configured?: boolean;
    telegram_user_id?: number | null;
    bot_username?: string;
    has_password?: boolean;
  };
  const [authProfile, setAuthProfile] = useState<AuthMeProfile | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null);
  const [tgLinkCode, setTgLinkCode] = useState<string | null>(null);
  const [tgLinkUrl, setTgLinkUrl] = useState<string | null>(null);
  const [tgLinkBotUsername, setTgLinkBotUsername] = useState<string>("Selloi_ai_bot");
  const [tgLinkBusy, setTgLinkBusy] = useState(false);
  const [tgLinkPolling, setTgLinkPolling] = useState(false);
  const [tgLinkError, setTgLinkError] = useState<string | null>(null);
  const [tgLinkFeedback, setTgLinkFeedback] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<AuthMeProfile>("/api/v1/auth/me")
      .then((res) => {
        if (active && res) {
          setAuthProfile(res);
          if (res.bot_username) {
            setTgLinkBotUsername(res.bot_username);
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tgLinkPolling || !tgLinkCode) return;
    let active = true;
    let attempts = 0;
    const pollTimer = setInterval(async () => {
      attempts += 1;
      if (attempts > 165) {
        if (active) {
          setTgLinkPolling(false);
          setTgLinkError("Telegram tasdiqlash vaqti tugadi. Qayta urinib ko'ring.");
        }
        return;
      }
      try {
        const res = await api<{
          status?: string;
          ok?: boolean;
          telegram_user_id?: number | null;
          username?: string;
        }>("/api/v1/auth/telegram/link/poll", {
          method: "POST",
          body: JSON.stringify({ code: tgLinkCode }),
        });
        if (!active) return;
        if (res?.status === "verified" || res?.ok) {
          setTgLinkPolling(false);
          setTgLinkCode(null);
          setTgLinkUrl(null);
          setTgLinkError(null);
          setAuthProfile((prev) => ({ ...(prev || {}), telegram_user_id: res.telegram_user_id ?? null }));
          setTgLinkFeedback(
            res.username
              ? `Telegram (@${res.username}) muvaffaqiyatli ulandi!`
              : "Telegram hisob muvaffaqiyatli ulandi!"
          );
        }
      } catch (err) {
        if (!active) return;
        setTgLinkPolling(false);
        setTgLinkError(err instanceof Error ? err.message : "Telegram ulashda xatolik yuz berdi");
      }
    }, 1800);
    return () => {
      active = false;
      clearInterval(pollTimer);
    };
  }, [tgLinkPolling, tgLinkCode]);

  const displayEmail = authProfile?.email || currentAdmin?.email || "";
  const isEmailVerified = Boolean(authProfile?.email_verified);
  const canVerifyViaSmtp = Boolean(authProfile?.smtp_configured && displayEmail && !displayEmail.endsWith("@telegram.selloi.uz"));
  const botUsername = authProfile?.bot_username || tgLinkBotUsername || "Selloi_ai_bot";
  const linkedTelegramId =
    authProfile !== null
      ? Number(authProfile.telegram_user_id || 0)
      : activeAdminTelegramId > 0
      ? activeAdminTelegramId
      : Number(currentAdmin?.telegram_user_id || 0);
  const isTelegramOnlyAccount = Boolean(
    displayEmail.toLowerCase().endsWith("@telegram.selloi.uz") && !authProfile?.has_password
  );

  const handleStartTelegramLink = async () => {
    setTgLinkBusy(true);
    setTgLinkError(null);
    setTgLinkFeedback(null);
    try {
      const res = await api<{ code: string; bot_url: string; bot_username?: string }>(
        "/api/v1/auth/telegram/link/init",
        { method: "POST" }
      );
      if (res.bot_username) setTgLinkBotUsername(res.bot_username);
      setTgLinkCode(res.code);
      setTgLinkUrl(res.bot_url);
      setTgLinkPolling(true);
    } catch (err) {
      setTgLinkError(err instanceof Error ? err.message : "Bot bilan ulanish sessiyasini yaratib bo'lmadi");
    } finally {
      setTgLinkBusy(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    setTgLinkBusy(true);
    setTgLinkError(null);
    setTgLinkFeedback(null);
    try {
      await api<{ ok: boolean }>("/api/v1/auth/telegram/unlink", { method: "POST" });
      setAuthProfile((prev) => ({ ...(prev || {}), telegram_user_id: null }));
      setTgLinkFeedback("Telegram hisob uzildi.");
    } catch (err) {
      setTgLinkError(err instanceof Error ? err.message : "Telegram hisobni uzishda xatolik");
    } finally {
      setTgLinkBusy(false);
    }
  };

  const handleSendVerifyCode = async () => {
    if (!displayEmail) return;
    setVerifyBusy(true);
    setVerifyFeedback(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: displayEmail }),
      });
      const data = await res.json().catch(() => ({}));
      setVerifyFeedback(data.detail || "Tasdiqlash kodi yuborildi");
      setVerifyOpen(true);
    } catch {
      setVerifyFeedback("Kod yuborishda xatolik");
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleConfirmProfileEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayEmail || verifyCode.trim().length !== 6) return;
    setVerifyBusy(true);
    setVerifyFeedback(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: displayEmail, code: verifyCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerifyFeedback(typeof data.detail === "string" ? data.detail : "Kod noto'g'ri");
        return;
      }
      setAuthProfile((prev) => ({ ...(prev || {}), email_verified: true }));
      setVerifyOpen(false);
      setVerifyCode("");
      setVerifyFeedback("Email muvaffaqiyatli tasdiqlandi!");
    } catch {
      setVerifyFeedback("Tarmoq xatosi");
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordFeedback(null);

    if (authProfile?.has_password && !currentPassword) {
      setPasswordError("Hozirgi parolingizni kiriting.");
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Yangi parol va tasdiqlash maydoni mos kelmadi.");
      return;
    }

    setPasswordBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError(typeof data.detail === "string" ? data.detail : "Parolni saqlashda xatolik");
        return;
      }
      setAuthProfile((prev) => ({ ...(prev || {}), has_password: true }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback(data.detail || "Parol muvaffaqiyatli saqlandi!");
    } catch {
      setPasswordError("Server bilan bog'lanishda xatolik");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokeBusy(true);
    try {
      await fetch("/api/auth/revoke-sessions", { method: "POST" });
      setRevokeModalOpen(false);
      window.location.href = "/login";
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.profile")}
        title={t("profile.title")}
        description={t("profile.subtitle")}
        badge={{ text: language === "uz" ? "Shaxsiy kabinet" : "Account Settings", variant: "accent" }}
      />

      <div className="row g-4">
        {/* Left Column: Admin Profile Card */}
        <div className="col-12 col-lg-5">
          <Card className="h-100">
            <CardHeader>
              <CardTitle>Admin Hisobi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="d-flex flex-column align-items-center text-center gap-3 py-2">
                {/* Avatar */}
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold"
                  style={{
                    width: "80px",
                    height: "80px",
                    backgroundColor: "var(--accent-subtle)",
                    fontSize: "2rem",
                    border: "2px solid var(--accent-border)",
                  }}
                >
                  {!profileAvatarError && Boolean(activeAdminTelegramId) && activeAdminTelegramId > 0 ? (
                    <img
                      src={`/api/proxy?path=/admin/users/${activeAdminTelegramId}/avatar`}
                      alt={currentAdmin?.name || "Admin"}
                      className="rounded-circle w-100 h-100 object-fit-cover"
                      onError={() => setProfileAvatarError(true)}
                    />
                  ) : (
                    (currentAdmin?.name || "A").charAt(0).toUpperCase()
                  )}
                </div>

                <div>
                  <h3 className="fw-bold text-primary m-0" style={{ fontSize: "1.2rem" }}>
                    {currentAdmin?.name || "Foydalanuvchi"}
                  </h3>
                  <div className="text-secondary small font-monospace mt-0.5">
                    {currentAdmin?.username
                      ? `@${currentAdmin.username}`
                      : activeAdminTelegramId > 0
                      ? `Telegram ID: ${activeAdminTelegramId}`
                      : (currentAdmin?.email || "")}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <Badge variant={isOwner ? "accent" : isSiteAdmin ? "info" : "default"}>
                    {isOwner
                      ? language === "uz"
                        ? "Sayt Egasi (Owner)"
                        : language === "ru"
                        ? "Владелец сайта"
                        : "Site Owner"
                      : isSiteAdmin
                      ? language === "uz"
                        ? "Sayt Admini"
                        : language === "ru"
                        ? "Админ сайта"
                        : "Site Admin"
                      : currentAdmin?.role === "admin"
                      ? language === "uz"
                        ? "Menejer"
                        : "Admin"
                      : language === "uz"
                      ? "Operator"
                      : "Moderator"}
                  </Badge>
                  <Badge variant="success" dot>{language === "uz" ? "Faol" : language === "ru" ? "Активен" : "Online"}</Badge>
                </div>

                {/* Account Details Box */}
                <div className="w-100 p-3 rounded-2 text-start small d-flex flex-column gap-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                  {displayEmail && (
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <span className="text-secondary d-flex align-items-center gap-1">
                        <IconMail size={13} /> Email:
                      </span>
                      <div className="d-flex align-items-center gap-1.5 flex-wrap justify-content-end">
                        <span className="font-monospace text-primary fw-medium" style={{ fontSize: "0.75rem" }}>
                          {displayEmail}
                        </span>
                        {authProfile && (
                          <Badge variant={isEmailVerified ? "success" : "warning"}>
                            {isEmailVerified ? "Tasdiqlangan" : "Tasdiqlanmagan"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <span className="text-secondary d-flex align-items-center gap-1">
                      <IconBrandTelegram size={13} /> Telegram:
                    </span>
                    <div className="d-flex align-items-center gap-1.5 flex-wrap justify-content-end">
                      <span className="font-monospace text-primary fw-medium" style={{ fontSize: "0.75rem" }}>
                        {linkedTelegramId > 0 ? `ID: ${linkedTelegramId}` : "Ulanmagan"}
                      </span>
                      {authProfile && (
                        <Badge variant={linkedTelegramId > 0 ? "success" : "default"}>
                          {linkedTelegramId > 0 ? "Ulangan" : "Ulanmagan"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-secondary">{language === "uz" ? "Tizim roli:" : "Role:"}</span>
                    <span className="text-capitalize text-primary fw-medium">{currentAdmin?.role || "Foydalanuvchi"}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-secondary">{language === "uz" ? "Vakolatlar:" : "Permissions:"}</span>
                    <span className={isOwner ? "text-success fw-medium" : "text-secondary fw-medium"}>
                      {isOwner ? (language === "uz" ? "Barcha ruxsatlar faol" : "Full access") : (language === "uz" ? "Cheklangan" : "Restricted")}
                    </span>
                  </div>
                </div>

                {authProfile && !isEmailVerified && canVerifyViaSmtp && (
                  <div className="w-100 p-2.5 rounded-2 text-start small" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                    {!verifyOpen ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="w-100"
                        loading={verifyBusy}
                        onClick={handleSendVerifyCode}
                        icon={<IconMail size={13} />}
                      >
                        Email manzilni tasdiqlash
                      </Button>
                    ) : (
                      <form onSubmit={handleConfirmProfileEmail} className="d-flex gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="6 xonali kod"
                          className="linear-input font-monospace flex-grow-1"
                        />
                        <Button type="submit" variant="primary" size="xs" loading={verifyBusy} disabled={verifyCode.trim().length !== 6}>
                          Tasdiqlash
                        </Button>
                      </form>
                    )}
                    {verifyFeedback && <div className="text-secondary mt-1.5" style={{ fontSize: "0.72rem" }}>{verifyFeedback}</div>}
                  </div>
                )}
                {isEmailVerified && verifyFeedback && (
                  <div className="small text-success">{verifyFeedback}</div>
                )}

                {authProfile && (
                  <div className="w-100 p-2.5 rounded-2 text-start small d-flex flex-column gap-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-secondary fw-medium d-flex align-items-center gap-1">
                        <IconBrandTelegram size={14} style={{ color: "#229ed9" }} /> @{botUsername}
                      </span>
                      {linkedTelegramId > 0 && !tgLinkUrl && !isTelegramOnlyAccount && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                          style={{ fontSize: "0.72rem" }}
                          disabled={tgLinkBusy}
                          onClick={handleUnlinkTelegram}
                        >
                          Uzish
                        </button>
                      )}
                    </div>

                    {tgLinkUrl ? (
                      <div className="d-flex flex-column gap-2">
                        <a
                          href={tgLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm w-100 d-inline-flex align-items-center justify-content-center gap-1.5 text-decoration-none"
                        >
                          <IconSend size={14} />
                          <span>@{tgLinkBotUsername} da tasdiqlash</span>
                        </a>
                        <div className="d-flex align-items-center justify-content-between gap-2 text-secondary" style={{ fontSize: "0.72rem" }}>
                          <span className="d-inline-flex align-items-center gap-1">
                            {tgLinkPolling && <IconLoader2 size={12} className="spin text-primary" />}
                            Botda Start bosing — avtomatik tasdiqlanadi
                          </span>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-secondary text-decoration-none"
                            style={{ fontSize: "0.72rem" }}
                            onClick={() => {
                              setTgLinkPolling(false);
                              setTgLinkUrl(null);
                              setTgLinkCode(null);
                            }}
                          >
                            Bekor qilish
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant={linkedTelegramId > 0 ? "ghost" : "outline"}
                        size="xs"
                        className="w-100"
                        loading={tgLinkBusy}
                        onClick={handleStartTelegramLink}
                        icon={<IconBrandTelegram size={13} />}
                      >
                        {linkedTelegramId > 0
                          ? `Boshqa Telegram ulash (@${botUsername})`
                          : `Telegramni ulash (@${botUsername})`}
                      </Button>
                    )}

                    {tgLinkFeedback && <div className="text-success" style={{ fontSize: "0.72rem" }}>{tgLinkFeedback}</div>}
                    {tgLinkError && <div className="text-danger" style={{ fontSize: "0.72rem" }}>{tgLinkError}</div>}
                  </div>
                )}

                {onReturnToAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-100 mt-2"
                    onClick={onReturnToAdmin}
                    icon={<IconShieldCheck size={15} />}
                  >
                    {language === "ru"
                      ? "Вернуться в админ-панель"
                      : language === "en"
                      ? "Back to Admin Panel"
                      : "Admin panelga qaytish"}
                  </Button>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  className="w-100 mt-2"
                  onClick={onLogout}
                  icon={<IconLogout size={15} />}
                >
                  {t("profile.logout_btn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Security, Design Systems, Theme & Custom Fonts */}
        <div className="col-12 col-lg-7 d-flex flex-column gap-4">
          {/* Account Security: Password Setup / Change & Global Session Revocation */}
          <Card>
            <CardHeader
              actions={
                <Badge variant={authProfile?.has_password ? "success" : "info"}>
                  {authProfile?.has_password ? "Parol o'rnatilgan" : "Parol o'rnatilmagan"}
                </Badge>
              }
            >
              <CardTitle className="d-flex align-items-center gap-2">
                <IconShieldLock size={17} style={{ color: "var(--accent)" }} />
                <span>Xavfsizlik va Parol</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePassword} className="d-flex flex-column gap-2.5">
                {!authProfile?.has_password && (
                  <p className="text-secondary small mb-1">
                    Siz Google yoki Telegram orqali kirgansiz. Email + parol orqali kirish uchun parol o&apos;rnating.
                  </p>
                )}

                {authProfile?.has_password && (
                  <div>
                    <label className="form-label text-secondary small mb-1">Hozirgi parol</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      className="linear-input"
                      placeholder="Hozirgi parolingiz"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                )}

                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label className="form-label text-secondary small mb-1">
                      {authProfile?.has_password ? "Yangi parol" : "Parol (kamida 6 belgi)"}
                    </label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      className="linear-input"
                      placeholder="Kamida 6 ta belgi"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label text-secondary small mb-1">Parolni tasdiqlang</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      className="linear-input"
                      placeholder="Parolni qayta kiriting"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </div>
                </div>

                {passwordError && (
                  <div className="small text-danger">{passwordError}</div>
                )}
                {passwordFeedback && (
                  <div className="small text-success">{passwordFeedback}</div>
                )}

                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-1">
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-secondary text-decoration-none d-inline-flex align-items-center gap-1"
                    style={{ fontSize: "0.78rem" }}
                    onClick={() => setShowPasswords((v) => !v)}
                  >
                    {showPasswords ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    <span>{showPasswords ? "Parollarni yashirish" : "Parollarni ko'rsatish"}</span>
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={passwordBusy}
                    icon={<IconKey size={14} />}
                  >
                    {authProfile?.has_password ? "Parolni yangilash" : "Parol o'rnatish"}
                  </Button>
                </div>
              </form>

              <div
                className="mt-3 pt-3 border-top d-flex flex-wrap align-items-center justify-content-between gap-2"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div>
                  <div className="fw-semibold text-primary small">Barcha qurilmalardagi sessiyalar</div>
                  <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                    Barcha brauzer va qurilmalardagi faol kirishlarni bir zumda yoping.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setRevokeModalOpen(true)}
                  icon={<IconLogout size={14} />}
                >
                  Barcha sessiyalardan chiqish
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Visual Design Systems (Phase 4: Premium, iOS, Classic) */}
          <Card>
            <CardHeader
              actions={
                <Badge variant="accent">
                  {t("profile.badge_3_systems")}
                </Badge>
              }
            >
              <CardTitle>{t("profile.card_design_systems")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-secondary small mb-3">
                {t("profile.card_design_desc")}
              </p>
              <DesignSelector onNavigateToBilling={onNavigateToBilling} />

              {/* Quick Font Selection in Design Systems Row */}
              <div className="mt-3 pt-3 border-top border-subtle">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-1.5">
                    <IconTypography size={16} className="text-secondary" />
                    <span className="fw-semibold text-primary small">
                      {t("profile.font_heading")}
                    </span>
                  </div>
                  <Badge variant="accent">
                    {FONT_OPTIONS.find((f) => f.id === appFont)?.name || "Quicksand"} {t("profile.font_active_suffix")}
                  </Badge>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {FONT_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onSelectFont(f.id)}
                      className={`btn btn-sm d-flex align-items-center gap-1.5 transition-fast ${
                        appFont === f.id ? "btn-primary" : "btn-outline-secondary"
                      }`}
                      style={{
                        fontFamily: f.fontFamily,
                        fontSize: "0.82rem",
                        padding: "5px 12px",
                      }}
                    >
                      {f.isNew && (
                        <span
                          className="badge bg-warning text-dark px-1 py-0 me-1"
                          style={{ fontSize: "8px", fontWeight: 700 }}
                        >
                          {t("profile.badge_new")}
                        </span>
                      )}
                      <span>{f.name}</span>
                      {appFont === f.id && <IconCheck size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Selector */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.card_title_theme")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="row g-3">
                <div className="col-6">
                  <div
                    onClick={() => setTheme("dark")}
                    className={`p-3 rounded-2 border cursor-pointer transition-fast d-flex align-items-center justify-content-between ${
                      theme === "dark" ? "border-accent" : "border-subtle"
                    }`}
                    style={{
                      backgroundColor: theme === "dark" ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <IconMoon size={18} style={{ color: "#8e98ec" }} />
                      <span className="fw-medium text-primary small">{t("profile.theme_dark")}</span>
                    </div>
                    {theme === "dark" && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
                  </div>
                </div>

                <div className="col-6">
                  <div
                    onClick={() => setTheme("light")}
                    className={`p-3 rounded-2 border cursor-pointer transition-fast d-flex align-items-center justify-content-between ${
                      theme === "light" ? "border-accent" : "border-subtle"
                    }`}
                    style={{
                      backgroundColor: theme === "light" ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <IconSun size={18} style={{ color: "#f59e0b" }} />
                      <span className="fw-medium text-primary small">{t("profile.theme_light")}</span>
                    </div>
                    {theme === "light" && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interface Language Selector */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.section_language")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="row g-3">
                <div className="col-12 col-sm-4">
                  <div
                    onClick={() => setLanguage("uz")}
                    className={`p-3 rounded-2 border cursor-pointer transition-fast d-flex align-items-center justify-content-between ${
                      language === "uz" ? "border-accent" : "border-subtle"
                    }`}
                    style={{
                      backgroundColor: language === "uz" ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                    }}
                  >
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: "1.1rem" }}>🇺🇿</span>
                        <span className="fw-medium text-primary small">{t("profile.language_uz_title")}</span>
                      </div>
                      <p className="text-secondary small mb-0 mt-1" style={{ fontSize: "0.75rem" }}>
                        {t("profile.language_uz_desc")}
                      </p>
                    </div>
                    {language === "uz" && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
                  </div>
                </div>

                <div className="col-12 col-sm-4">
                  <div
                    onClick={() => setLanguage("ru")}
                    className={`p-3 rounded-2 border cursor-pointer transition-fast d-flex align-items-center justify-content-between ${
                      language === "ru" ? "border-accent" : "border-subtle"
                    }`}
                    style={{
                      backgroundColor: language === "ru" ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                    }}
                  >
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: "1.1rem" }}>🇷🇺</span>
                        <span className="fw-medium text-primary small">{t("profile.language_ru_title")}</span>
                      </div>
                      <p className="text-secondary small mb-0 mt-1" style={{ fontSize: "0.75rem" }}>
                        {t("profile.language_ru_desc")}
                      </p>
                    </div>
                    {language === "ru" && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
                  </div>
                </div>

                <div className="col-12 col-sm-4">
                  <div
                    onClick={() => setLanguage("en")}
                    className={`p-3 rounded-2 border cursor-pointer transition-fast d-flex align-items-center justify-content-between ${
                      language === "en" ? "border-accent" : "border-subtle"
                    }`}
                    style={{
                      backgroundColor: language === "en" ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                    }}
                  >
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: "1.1rem" }}>🇬🇧</span>
                        <span className="fw-medium text-primary small">{t("profile.language_en_title")}</span>
                      </div>
                      <p className="text-secondary small mb-0 mt-1" style={{ fontSize: "0.75rem" }}>
                        {t("profile.language_en_desc")}
                      </p>
                    </div>
                    {language === "en" && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typography Selector (Olline, Pogonia, Inter, SF Pro, Jakarta) */}
          <Card>
            <CardHeader
              actions={
                <Badge variant="accent">
                  {FONT_OPTIONS.find((f) => f.id === appFont)?.name || "Quicksand"} faol
                </Badge>
              }
            >
              <CardTitle>Interfeys Shrifti (Typography)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-secondary small mb-3">
                Yangi <strong>Olline</strong> va <strong>Pogonia</strong> yoki boshqa zamonaviy shriftlarni tanlang:
              </p>

              <div className="row g-3">
                {FONT_OPTIONS.map((font) => {
                  const isSelected = appFont === font.id;
                  return (
                    <div key={font.id} className="col-12 col-sm-6">
                      <div
                        onClick={() => onSelectFont(font.id)}
                        className={`p-3 rounded-2 border cursor-pointer transition-fast position-relative h-100 d-flex flex-column justify-content-between ${
                          isSelected ? "border-accent" : "border-subtle"
                        }`}
                        style={{
                          backgroundColor: isSelected ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                        }}
                      >
                        {font.isNew && (
                          <span
                            className="position-absolute badge rounded-pill"
                            style={{
                              top: 8,
                              right: 8,
                              backgroundColor: "var(--warning)",
                              color: "#090a0c",
                              fontWeight: 700,
                              fontSize: "9px",
                              padding: "2px 6px",
                            }}
                          >
                            YANGI FONT
                          </span>
                        )}

                        {/* Typography Visual Preview Box matching user images */}
                        {font.imagePreview ? (
                          <div
                            className="d-flex flex-column align-items-center justify-content-center p-2 rounded mb-2 overflow-hidden"
                            style={{
                              backgroundColor: "#f1f5f9",
                              border: "1px solid var(--border-subtle)",
                              height: "82px",
                            }}
                          >
                            <img
                              src={font.imagePreview}
                              alt={`${font.name} font preview`}
                              className="img-fluid object-fit-contain"
                              style={{ maxHeight: "66px", maxWidth: "100%" }}
                            />
                          </div>
                        ) : (
                          <div
                            className="text-center py-2 px-2 rounded mb-2 d-flex flex-column justify-content-center"
                            style={{
                              backgroundColor: "var(--bg-canvas)",
                              border: "1px solid var(--border-subtle)",
                              height: "82px",
                            }}
                          >
                            <div
                              className="text-primary text-truncate"
                              style={{
                                fontFamily: font.fontFamily,
                                fontSize: "1.35rem",
                                fontWeight: 700,
                                lineHeight: 1.15,
                              }}
                            >
                              {font.name}
                            </div>
                            <div
                              className="text-secondary small mt-0.5"
                              style={{
                                fontFamily: font.fontFamily,
                                fontSize: "0.72rem",
                              }}
                            >
                              {font.name}
                            </div>
                          </div>
                        )}

                        <div className="d-flex align-items-center justify-content-between mt-auto pt-1">
                          <div>
                            <div className="fw-semibold text-primary small">{font.name}</div>
                            <div className="text-secondary" style={{ fontSize: "0.7rem" }}>{font.subtitle}</div>
                          </div>
                          {isSelected && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
        onConfirm={handleRevokeAllSessions}
        loading={revokeBusy}
        variant="danger"
        title="Barcha sessiyalardan chiqish"
        confirmText="Ha, hammasidan chiqish"
        message="Barcha qurilma va brauzerlardagi faol sessiyalaringiz darhol bekor qilinadi hamda tizimga qaytadan kirishingiz kerak bo'ladi."
      />
    </div>
  );
}
