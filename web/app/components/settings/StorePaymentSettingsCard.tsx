"use client";

import React, { useEffect, useState } from "react";
import { IconCheck, IconCopy, IconCreditCard } from "@tabler/icons-react";
import { useLanguage } from "../../lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export interface StorePaymentConfigData {
  organization_id: number;
  provider: "tezcheck" | "click" | "payme" | "manual_card" | string;
  is_enabled: boolean;
  tezcheck_cash_desk_code: string;
  tezcheck_api_key_set: boolean;
  tezcheck_secret_key_set: boolean;
  click_service_id: string;
  click_merchant_id: string;
  payme_merchant_id: string;
  card_number: string;
  card_holder: string;
  webhook_url: string;
}

export interface StorePaymentSettingsCardProps {
  config: StorePaymentConfigData | null;
  onSaveConfig?: (payload: {
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
}

export function StorePaymentSettingsCard({ config, onSaveConfig }: StorePaymentSettingsCardProps) {
  const { t } = useLanguage();
  const [provider, setProvider] = useState<string>(config?.provider || "tezcheck");
  const [isEnabled, setIsEnabled] = useState<boolean>(Boolean(config?.is_enabled));
  const [cashDeskCode, setCashDeskCode] = useState<string>(config?.tezcheck_cash_desk_code || "");
  const [tezApiKey, setTezApiKey] = useState<string>("");
  const [tezSecretKey, setTezSecretKey] = useState<string>("");
  const [clickServiceId, setClickServiceId] = useState<string>(config?.click_service_id || "");
  const [clickMerchantId, setClickMerchantId] = useState<string>(config?.click_merchant_id || "");
  const [paymeMerchantId, setPaymeMerchantId] = useState<string>(config?.payme_merchant_id || "");
  const [cardNumber, setCardNumber] = useState<string>(config?.card_number || "");
  const [cardHolder, setCardHolder] = useState<string>(config?.card_holder || "");
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider || "tezcheck");
    setIsEnabled(Boolean(config.is_enabled));
    setCashDeskCode(config.tezcheck_cash_desk_code || "");
    setClickServiceId(config.click_service_id || "");
    setClickMerchantId(config.click_merchant_id || "");
    setPaymeMerchantId(config.payme_merchant_id || "");
    setCardNumber(config.card_number || "");
    setCardHolder(config.card_holder || "");
    setTezApiKey("");
    setTezSecretKey("");
  }, [config]);

  const handleSave = async () => {
    if (!onSaveConfig) return;
    setSaving(true);
    try {
      await onSaveConfig({
        provider,
        is_enabled: isEnabled,
        tezcheck_cash_desk_code: cashDeskCode,
        ...(tezApiKey.trim() ? { tezcheck_api_key: tezApiKey.trim() } : {}),
        ...(tezSecretKey.trim() ? { tezcheck_secret_key: tezSecretKey.trim() } : {}),
        click_service_id: clickServiceId,
        click_merchant_id: clickMerchantId,
        payme_merchant_id: paymeMerchantId,
        card_number: cardNumber,
        card_holder: cardHolder,
      });
      setTezApiKey("");
      setTezSecretKey("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        actions={
          <Badge variant={isEnabled ? "success" : "default"} dot>
            {isEnabled ? t("payments.badge_enabled") : t("payments.badge_disabled")}
          </Badge>
        }
      >
        <CardTitle className="d-flex align-items-center gap-2">
          <IconCreditCard size={17} style={{ color: "var(--accent)" }} />
          <span>{t("payments.card_title")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-secondary small mb-3">{t("payments.card_desc")}</p>

        <div className="d-flex flex-column gap-3">
          <label className="d-flex align-items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="small fw-medium text-primary">{t("payments.enable_label")}</span>
          </label>

          <div>
            <label className="fw-medium text-primary small d-block mb-1">{t("payments.provider_label")}</label>
            <div className="d-flex flex-wrap gap-2">
              {[
                { id: "tezcheck", label: "TezCheck (Uzcard/Humo/Click/Payme)" },
                { id: "click", label: "Click Merchant" },
                { id: "payme", label: "Payme Checkout" },
                { id: "manual_card", label: t("payments.provider_card") },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProvider(opt.id)}
                  className={`btn-linear px-3 py-1.5 small ${
                    provider === opt.id ? "border-accent text-accent fw-semibold" : "text-secondary"
                  }`}
                  style={{
                    backgroundColor: provider === opt.id ? "var(--bg-surface-elevated)" : "transparent",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {provider === "tezcheck" && (
            <div className="d-flex flex-column gap-2.5 p-3 rounded-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
              <div>
                <label className="small text-secondary d-block mb-1">Kassa kodi (X-Cash-Desk-Code)</label>
                <input
                  type="text"
                  value={cashDeskCode}
                  onChange={(e) => setCashDeskCode(e.target.value)}
                  placeholder="cdk_..."
                  className="linear-input font-monospace"
                />
              </div>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="small text-secondary d-block mb-1">
                    API Kalit {config?.tezcheck_api_key_set && <span className="text-success">(Saqlangan)</span>}
                  </label>
                  <input
                    type="password"
                    value={tezApiKey}
                    onChange={(e) => setTezApiKey(e.target.value)}
                    placeholder={config?.tezcheck_api_key_set ? "••••••••••••••••" : "aps_..."}
                    className="linear-input font-monospace"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="small text-secondary d-block mb-1">
                    Webhook Secret {config?.tezcheck_secret_key_set && <span className="text-success">(Saqlangan)</span>}
                  </label>
                  <input
                    type="password"
                    value={tezSecretKey}
                    onChange={(e) => setTezSecretKey(e.target.value)}
                    placeholder={config?.tezcheck_secret_key_set ? "••••••••••••••••" : "whsec_..."}
                    className="linear-input font-monospace"
                  />
                </div>
              </div>
              {config?.webhook_url && (
                <div>
                  <label className="small text-secondary d-block mb-1">{t("payments.webhook_url_label")}</label>
                  <div className="d-flex gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={config.webhook_url}
                      className="linear-input font-monospace flex-grow-1"
                      style={{ fontSize: "0.75rem" }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={copiedWebhook ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={() => {
                        navigator.clipboard?.writeText(config.webhook_url);
                        setCopiedWebhook(true);
                        setTimeout(() => setCopiedWebhook(false), 2000);
                      }}
                    >
                      {copiedWebhook ? t("payments.copied") : t("payments.copy")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {provider === "click" && (
            <div className="row g-2 p-3 rounded-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
              <div className="col-12 col-md-6">
                <label className="small text-secondary d-block mb-1">Click Service ID</label>
                <input
                  type="text"
                  value={clickServiceId}
                  onChange={(e) => setClickServiceId(e.target.value)}
                  placeholder="Masalan: 31452"
                  className="linear-input font-monospace"
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="small text-secondary d-block mb-1">Click Merchant ID</label>
                <input
                  type="text"
                  value={clickMerchantId}
                  onChange={(e) => setClickMerchantId(e.target.value)}
                  placeholder="Masalan: 18421"
                  className="linear-input font-monospace"
                />
              </div>
            </div>
          )}

          {provider === "payme" && (
            <div className="p-3 rounded-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
              <label className="small text-secondary d-block mb-1">Payme Merchant (Kassa) ID</label>
              <input
                type="text"
                value={paymeMerchantId}
                onChange={(e) => setPaymeMerchantId(e.target.value)}
                placeholder="650a..."
                className="linear-input font-monospace"
              />
            </div>
          )}

          {provider === "manual_card" && (
            <div className="row g-2 p-3 rounded-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
              <div className="col-12 col-md-6">
                <label className="small text-secondary d-block mb-1">{t("payments.card_number_label")}</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="8600 0000 0000 0000"
                  className="linear-input font-monospace"
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="small text-secondary d-block mb-1">{t("payments.card_holder_label")}</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="ALI VALIYEV"
                  className="linear-input"
                />
              </div>
            </div>
          )}

          <div className="text-end pt-1">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              loading={saving}
              disabled={!onSaveConfig}
              icon={<IconCheck size={14} />}
            >
              {t("payments.save_config")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
