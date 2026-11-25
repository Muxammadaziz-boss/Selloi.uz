"use client";

import React from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconCpu,
  IconBrandTelegram,
  IconCheck,
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconActivity,
  IconPhoto,
  IconId,
  IconShieldLock,
  IconPhone,
  IconMessageDots,
  IconInfoCircle,
  IconSparkles,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { Tooltip } from "../ui/Tooltip";
import { PageHeader } from "../layout/PageHeader";
import { AiPlaygroundPanel, type PlaygroundApiResponse } from "../ai/AiPlaygroundPanel";
import { StorePaymentSettingsCard, type StorePaymentConfigData } from "../settings/StorePaymentSettingsCard";
import {
  SmartFollowupSettingsCard,
  type FollowupBundle,
  type FollowupConfigData,
  type FollowupPreviewItem,
} from "../settings/SmartFollowupSettingsCard";

export interface SettingsTabProps {
  aiModel: string;
  setAiModel: (m: string) => void;
  aiTemperature: number;
  setAiTemperature: (t: number) => void;
  autoHandoff: boolean;
  setAutoHandoff: (b: boolean) => void;
  doubleConfirmation: boolean;
  setDoubleConfirmation: (b: boolean) => void;
  businessHoursOnly: boolean;
  setBusinessHoursOnly: (b: boolean) => void;
  onSaveAiSettings: () => void;
  currentOrgDetails: any;
  botTokenInput: string;
  setBotTokenInput: (t: string) => void;
  showBotToken: boolean;
  setShowBotToken: (b: boolean) => void;
  botTokenVerifying: boolean;
  onVerifyBotToken: () => void;
  botTokenResult: any;
  activeOrgId: number;
  webhookSetting: boolean;
  onSetWebhook: () => void;
  webhookStatusChecking: boolean;
  onCheckWebhookStatus: () => void;
  webhookInfo: any;
  customPromptInput: string;
  setCustomPromptInput: (p: string) => void;
  telegramApiIdInput?: string;
  setTelegramApiIdInput?: (id: string) => void;
  telegramApiHashInput?: string;
  setTelegramApiHashInput?: (hash: string) => void;
  telegramPhoneInput?: string;
  setTelegramPhoneInput?: (phone: string) => void;
  adminChatIdInput?: string;
  setAdminChatIdInput?: (id: string) => void;
  showApiHash?: boolean;
  setShowApiHash?: (b: boolean) => void;
  onSaveBotSettings: () => void;
  savingOrgSettings: boolean;
  logoUrl: string;
  customLogoInput: string;
  setCustomLogoInput: (url: string) => void;
  onSaveLogoUrl: (url: string) => void;
  onLogoUpload: (file: File) => void;
  channels: Array<{ id: number; channel_username: string }>;
  onRunPlayground?: (payload: {
    message: string;
    history: Array<{ direction: "customer" | "assistant"; text: string }>;
    custom_system_prompt?: string;
    ai_temperature?: number;
    ai_model?: string;
  }) => Promise<PlaygroundApiResponse>;
  storePaymentConfig?: StorePaymentConfigData | null;
  onSaveStorePaymentConfig?: (payload: {
    provider: string;
    is_enabled: boolean;
    tezcheck_cash_desk_code?: string;
    tezcheck_api_key?: string;
    tezcheck_secret_key?: string;
    click_service_id?: string;
    click_merchant_id?: string;
    payme_merchant_id?: string;
    card_number?: string;
    card_holder?: string;
  }) => Promise<void>;
  followupBundle?: FollowupBundle | null;
  onSaveFollowupConfig?: (payload: Partial<FollowupConfigData>) => Promise<void>;
  onPreviewFollowup?: () => Promise<{ candidates_count: number; items: FollowupPreviewItem[] }>;
  onRunFollowupNow?: () => Promise<{ sent_count: number }>;
}

export function SettingsTab({
  aiModel,
  setAiModel,
  aiTemperature,
  setAiTemperature,
  autoHandoff,
  setAutoHandoff,
  doubleConfirmation,
  setDoubleConfirmation,
  businessHoursOnly,
  setBusinessHoursOnly,
  onSaveAiSettings,
  currentOrgDetails,
  botTokenInput,
  setBotTokenInput,
  showBotToken,
  setShowBotToken,
  botTokenVerifying,
  onVerifyBotToken,
  botTokenResult,
  activeOrgId,
  webhookSetting,
  onSetWebhook,
  webhookStatusChecking,
  onCheckWebhookStatus,
  webhookInfo,
  customPromptInput,
  setCustomPromptInput,
  telegramApiIdInput = "",
  setTelegramApiIdInput = () => {},
  telegramApiHashInput = "",
  setTelegramApiHashInput = () => {},
  telegramPhoneInput = "",
  setTelegramPhoneInput = () => {},
  adminChatIdInput = "",
  setAdminChatIdInput = () => {},
  showApiHash = false,
  setShowApiHash = () => {},
  onSaveBotSettings,
  savingOrgSettings,
  logoUrl,
  customLogoInput,
  setCustomLogoInput,
  onSaveLogoUrl,
  onLogoUpload,
  channels,
  onRunPlayground,
  storePaymentConfig = null,
  onSaveStorePaymentConfig,
  followupBundle = null,
  onSaveFollowupConfig,
  onPreviewFollowup,
  onRunFollowupNow,
}: SettingsTabProps) {
  const { language, t } = useLanguage();
  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.settings")}
        title={t("settings.title")}
        description={t("settings.subtitle")}
        badge={{ text: language === "uz" ? "Tizim sozlamalari" : "System Config", variant: "accent" }}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("ai-playground")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            icon={<IconSparkles size={14} style={{ color: "var(--accent)" }} />}
          >
            {t("playground.open_btn")}
          </Button>
        }
      />

      <div className="row g-4">
        {/* Left Column: AI Parameters & Telegram Webhook */}
        <div className="col-12 col-lg-7 d-flex flex-column gap-4">
          {/* AI Model & Temperature Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.card_ai_params")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="d-flex flex-column gap-3">
                <Select
                  label={t("settings.label_model")}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  options={[
                    { value: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite (0.7s)" },
                    { value: "gemini-3.5-flash", label: "gemini-3.5-flash" },
                    { value: "gemini-flash-latest", label: "gemini-flash-latest" },
                  ]}
                  hint={t("settings.hint_model")}
                />

                <div>
                  <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <div className="d-flex align-items-center gap-1.5">
                      <label className="fw-medium text-primary small m-0">
                        {t("settings.label_temperature")} <strong className="text-accent">{aiTemperature}</strong>
                      </label>
                      <Tooltip
                        title={t("settings.tooltip_temp_title")}
                        content={t("settings.tooltip_temp_desc")}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    aria-label={t("settings.label_temperature")}
                    min="0"
                    max="1"
                    step="0.05"
                    value={aiTemperature}
                    onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                    className="w-100"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <div className="d-flex justify-content-between text-secondary mt-1 font-monospace" style={{ fontSize: "0.72rem" }}>
                    <span>{t("settings.temp_precise")}</span>
                    <span>{t("settings.temp_balanced")}</span>
                    <span>{t("settings.temp_creative")}</span>
                  </div>
                </div>

                <div className="border-top border-subtle my-2" />

                {/* Switches */}
                <div className="d-flex flex-column gap-2.5">
                  <label className="d-flex align-items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoHandoff}
                      onChange={(e) => setAutoHandoff(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="small text-primary d-flex align-items-center gap-1.5">
                      <span>{t("settings.switch_handoff")}</span>
                      <Tooltip
                        title={t("settings.tooltip_handoff_title")}
                        content={t("settings.tooltip_handoff_desc")}
                      />
                    </span>
                  </label>

                  <label className="d-flex align-items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={doubleConfirmation}
                      onChange={(e) => setDoubleConfirmation(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="small text-primary d-flex align-items-center gap-1.5">
                      <span>{t("settings.switch_typing")}</span>
                      <Tooltip
                        title={t("settings.tooltip_typing_title")}
                        content={t("settings.tooltip_typing_desc")}
                      />
                    </span>
                  </label>

                  <label className="d-flex align-items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={businessHoursOnly}
                      onChange={(e) => setBusinessHoursOnly(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="small text-primary">
                      Faqat ish vaqtida faol bo'lish (09:00 - 20:00)
                    </span>
                  </label>
                </div>

                <div className="text-end pt-2">
                  <Button variant="primary" size="sm" onClick={onSaveAiSettings}>
                    AI parametrlarini saqlash
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Telegram Bot & Webhook Card */}
          <Card>
            <CardHeader
              actions={
                currentOrgDetails?.telegram_bot_token_set ? (
                  <Badge variant="success" dot>Bot Ulangan</Badge>
                ) : (
                  <Badge variant="warning" dot>Bot Ulanmagan</Badge>
                )
              }
            >
              <CardTitle>Telegram Bot va Webhook Integratsiyasi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="d-flex flex-column gap-3">
                {/* Bot Token Input */}
                <div>
                  <label className="fw-medium text-primary small d-block mb-1">
                    Telegram Bot Token (BotFather'dan olingan)
                  </label>
                  <div className="d-flex gap-2">
                    <input
                      type={showBotToken ? "text" : "password"}
                      aria-label="Telegram Bot Token"
                      placeholder={currentOrgDetails?.telegram_bot_token_set ? "••••••••••••••••••••••••••••••••" : "Masalan: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"}
                      value={botTokenInput}
                      onChange={(e) => setBotTokenInput(e.target.value)}
                      className="linear-input font-monospace flex-grow-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label={showBotToken ? "Tokenni yashirish" : "Tokenni ko'rsatish"}
                      onClick={() => setShowBotToken(!showBotToken)}
                      icon={showBotToken ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onVerifyBotToken}
                      disabled={botTokenVerifying || !botTokenInput.trim()}
                      loading={botTokenVerifying}
                      icon={<IconCheck size={14} />}
                    >
                      Tekshirish
                    </Button>
                  </div>
                  <div className="text-secondary small mt-1" style={{ fontSize: "0.72rem" }}>
                    Token shifrlangan holda (AES-128 Fernet) saqlanadi va xavfsiz Telegram Webhook orqali ishlaydi.
                  </div>
                </div>

                {/* Verification Result */}
                {botTokenResult && (
                  <div
                    className={`p-2.5 rounded-2 d-flex align-items-center gap-2 border ${
                      botTokenResult.valid ? "border-success text-success" : "border-danger text-danger"
                    }`}
                    style={{ backgroundColor: "var(--bg-surface-elevated)" }}
                  >
                    {botTokenResult.valid ? <IconCheck size={18} /> : <IconAlertCircle size={18} />}
                    <div className="small">
                      {botTokenResult.valid ? (
                        <>
                          <strong>Bot tasdiqlandi:</strong> @{botTokenResult.bot_username} ({botTokenResult.bot_name})
                        </>
                      ) : (
                        <>
                          <strong>Xatolik:</strong> {botTokenResult.error}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Webhook Endpoint */}
                <div>
                  <label className="fw-medium text-primary small d-block mb-1">
                    Webhook Havolasi
                  </label>
                  <div className="p-2 rounded-2 border d-flex align-items-center justify-content-between font-monospace small" style={{ backgroundColor: "var(--bg-surface-elevated)", borderColor: "var(--border-default)" }}>
                    <span className="text-accent text-truncate">
                      {currentOrgDetails?.webhook_url || `/telegram/webhook/${currentOrgDetails?.slug || activeOrgId}`}
                    </span>
                    <Badge variant="accent">POST</Badge>
                  </div>
                </div>

                {/* Webhook Action Buttons */}
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSetWebhook}
                    disabled={webhookSetting || !currentOrgDetails?.telegram_bot_token_set}
                    loading={webhookSetting}
                    icon={<IconRefresh size={14} />}
                  >
                    setWebhook Yangilash
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onCheckWebhookStatus}
                    disabled={webhookStatusChecking || !currentOrgDetails?.telegram_bot_token_set}
                    loading={webhookStatusChecking}
                    icon={<IconActivity size={14} />}
                  >
                    Webhook Holatini Tekshirish
                  </Button>
                </div>

                {/* Webhook Info Display */}
                {webhookInfo && (
                  <div className="p-3 rounded-2 border border-subtle small" style={{ backgroundColor: "var(--bg-surface-elevated)" }}>
                    <div className="d-flex align-items-center justify-content-between fw-medium mb-2">
                      <span className="text-primary">Telegram Webhook Statusi:</span>
                      <Badge variant={webhookInfo.webhook_info?.url ? "success" : "warning"}>
                        {webhookInfo.webhook_info?.url ? "Faol (O'rnatilgan)" : "O'rnatilmagan"}
                      </Badge>
                    </div>
                    <div className="text-secondary d-flex flex-column gap-1">
                      <div><strong>URL:</strong> <span className="font-monospace text-primary">{webhookInfo.webhook_info?.url || "Mavjud emas"}</span></div>
                      <div><strong>Kutilayotgan xabarlar:</strong> {webhookInfo.webhook_info?.pending_update_count ?? 0}</div>
                    </div>
                  </div>
                )}

                {/* Telegram MTProto / User Client & Chat Settings */}
                <div className="pt-2 border-top" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-semibold text-primary small d-flex align-items-center gap-1.5">
                      <IconId size={16} className="text-accent" />
                      Telegram API & Foydalanuvchi Sozlamalari (my.telegram.org)
                    </span>
                    {currentOrgDetails?.telegram_api_hash_set && (
                      <Badge variant="success" dot>API Hash O&apos;rnatilgan</Badge>
                    )}
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-12 col-md-6">
                      <label className="text-secondary small d-block mb-1" style={{ fontSize: "0.78rem" }}>
                        Telegram API ID (App api_id)
                      </label>
                      <input
                        type="text"
                        placeholder="Masalan: 20400123"
                        value={telegramApiIdInput}
                        onChange={(e) => setTelegramApiIdInput(e.target.value.replace(/[^0-9]/g, ""))}
                        className="linear-input font-monospace w-100"
                        style={{ fontSize: "0.82rem" }}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="text-secondary small d-block mb-1" style={{ fontSize: "0.78rem" }}>
                        Telegram API HASH (App api_hash)
                      </label>
                      <div className="d-flex gap-1.5">
                        <input
                          type={showApiHash ? "text" : "password"}
                          placeholder={currentOrgDetails?.telegram_api_hash_set ? "••••••••••••••••••••••••••••••••" : "0123456789abcdef0123456789abcdef"}
                          value={telegramApiHashInput}
                          onChange={(e) => setTelegramApiHashInput(e.target.value)}
                          className="linear-input font-monospace flex-grow-1"
                          style={{ fontSize: "0.82rem" }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowApiHash(!showApiHash)}
                          icon={showApiHash ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <label className="text-secondary small d-block mb-1" style={{ fontSize: "0.78rem" }}>
                        Bog&apos;langan Telefon Raqam (User session)
                      </label>
                      <input
                        type="tel"
                        placeholder="+998901234567"
                        value={telegramPhoneInput}
                        onChange={(e) => setTelegramPhoneInput(e.target.value)}
                        className="linear-input font-monospace w-100"
                        style={{ fontSize: "0.82rem" }}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="text-secondary small d-block mb-1" style={{ fontSize: "0.78rem" }}>
                        Admin Chat ID (Xabarnoma & Buyurtmalar)
                      </label>
                      <input
                        type="text"
                        placeholder="Masalan: 5544332211"
                        value={adminChatIdInput}
                        onChange={(e) => setAdminChatIdInput(e.target.value.replace(/[^0-9-]/g, ""))}
                        className="linear-input font-monospace w-100"
                        style={{ fontSize: "0.82rem" }}
                      />
                    </div>
                  </div>
                  <div className="text-secondary small mt-1.5 d-flex align-items-center gap-1.5" style={{ fontSize: "0.74rem" }}>
                    <IconInfoCircle size={14} className="text-secondary flex-shrink-0" />
                    <span>
                      API ID/Hash: <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-primary text-decoration-underline">my.telegram.org</a> saytidan olinadi. Admin Chat ID: Telegram&apos;da <code>@userinfobot</code> orqali bilib olinadi.
                    </span>
                  </div>
                </div>

                {/* System Prompt Textarea */}
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <label className="fw-medium text-primary small m-0">
                      Do'kon AI Sotuvchisi Uchun Maxsus Tizim Ko'rsatmasi (System Prompt)
                    </label>
                    <Tooltip
                      title="Tizim Ko'rsatmasi (System Prompt)"
                      content="Bu yerda do'koningiz nomi, muloqot ohangi (xushmuomala, do'stona), chegirma va to'lov shartlari hamda taqiqlangan mavzularni ko'rsatishingiz mumkin."
                    />
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Do'konning o'ziga xos xususiyatlari, yetkazib berish qoidalari yoki mijozlar bilan muloqot ohangi bo'yicha maxsus ko'rsatma..."
                    value={customPromptInput}
                    onChange={(e) => setCustomPromptInput(e.target.value)}
                    className="linear-input font-monospace"
                    style={{ fontSize: "0.82rem" }}
                  />
                  <div className="text-secondary small mt-1" style={{ fontSize: "0.72rem" }}>
                    Ushbu ko'rsatma har bir mijoz bilan muloqotda asosiy AI modeliga qo'shimcha kontekst sifatida kiritiladi.
                  </div>
                </div>

                <div className="text-end pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onSaveBotSettings}
                    loading={savingOrgSettings}
                    icon={<IconCheck size={14} />}
                  >
                    Bot va AI Sozlamalarini Saqlash
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <StorePaymentSettingsCard
            config={storePaymentConfig}
            onSaveConfig={onSaveStorePaymentConfig}
          />

          <SmartFollowupSettingsCard
            bundle={followupBundle}
            onSaveConfig={onSaveFollowupConfig}
            onPreview={onPreviewFollowup}
            onRunNow={onRunFollowupNow}
          />
        </div>

        {/* Right Column: Live AI Playground, Logo & System Meta */}
        <div className="col-12 col-lg-5 d-flex flex-column gap-4">
          <AiPlaygroundPanel
            activeOrgId={activeOrgId}
            aiModel={aiModel}
            aiTemperature={aiTemperature}
            customPromptInput={customPromptInput}
            onRunPlayground={onRunPlayground}
          />

          {/* Logo Card */}
          <Card>
            <CardHeader>
              <CardTitle>Do'kon Logotipi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="d-flex flex-column align-items-center text-center gap-3">
                <div
                  className="p-3 rounded-2 d-flex align-items-center justify-content-center"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-default)",
                    width: "80px",
                    height: "80px",
                  }}
                >
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo.svg";
                    }}
                  />
                </div>

                <div className="w-100 text-start">
                  <label className="text-secondary small d-block mb-1">Fayl yuklash (PNG, SVG, JPG):</label>
                  <input
                    type="file"
                    aria-label="Logotip faylini yuklash"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onLogoUpload(file);
                    }}
                    className="linear-input py-1"
                    style={{ fontSize: "0.78rem" }}
                  />
                </div>

                <div className="w-100 text-start">
                  <label className="text-secondary small d-block mb-1">Yoki logotip URL manzili:</label>
                  <div className="d-flex gap-1.5">
                    <input
                      type="text"
                      aria-label="Logotip URL manzili"
                      placeholder="/logo.svg"
                      value={customLogoInput}
                      onChange={(e) => setCustomLogoInput(e.target.value)}
                      className="linear-input flex-grow-1"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onSaveLogoUrl(customLogoInput)}
                    >
                      Qo'llash
                    </Button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-100"
                  onClick={() => {
                    onSaveLogoUrl("/logo.svg");
                    setCustomLogoInput("/logo.svg");
                  }}
                >
                  Standart logotipga qaytarish
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Tech Stack Card */}
          <Card>
            <CardHeader>
              <CardTitle>Tizim Arxitekturasi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="d-flex flex-column gap-2.5 small">
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Frontend:</span>
                  <span className="fw-medium text-primary">Next.js 15 (App Router)</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Backend API:</span>
                  <span className="fw-medium text-primary">FastAPI + SQLAlchemy</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Database:</span>
                  <span className="fw-medium text-primary">PostgreSQL (Multi-tenant)</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Telegram API:</span>
                  <span className="fw-medium text-primary">Business Connection Webhook</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Ulangan Kanallar:</span>
                  <span className="fw-medium text-primary">{channels.length} ta</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
