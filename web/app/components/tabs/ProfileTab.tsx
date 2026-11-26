"use client";

import React from "react";
import { useLanguage } from "../../lib/i18n";
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
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
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
                  <div className="d-flex justify-content-between">
                    <span className="text-secondary">Telegram ID:</span>
                    <span className="font-monospace text-primary fw-medium">{activeAdminTelegramId > 0 ? activeAdminTelegramId : (currentAdmin?.telegram_user_id || "-")}</span>
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

        {/* Right Column: Design Systems, Theme & Custom Fonts */}
        <div className="col-12 col-lg-7 d-flex flex-column gap-4">
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
    </div>
  );
}
