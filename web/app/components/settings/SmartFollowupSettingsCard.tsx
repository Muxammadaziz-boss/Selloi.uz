"use client";

import React, { useEffect, useState } from "react";
import { IconCheck, IconClock, IconEye, IconRefresh, IconSend, IconSparkles } from "@tabler/icons-react";
import { useLanguage } from "../../lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export interface FollowupConfigData {
  organization_id: number;
  is_enabled: boolean;
  delay_hours: number;
  max_attempts: number;
  business_hours_only: boolean;
  start_hour: number;
  end_hour: number;
  offer_discount_pct: number;
  custom_template: string;
}

export interface FollowupHistoryItem {
  id: number;
  conversation_id: number;
  customer_name: string;
  attempt_number: number;
  message_text: string;
  status: string;
  sent_at?: string | null;
}

export interface FollowupBundle {
  config: FollowupConfigData;
  eligible_count: number;
  history: FollowupHistoryItem[];
}

export interface FollowupPreviewItem {
  conversation_id: number;
  customer_name: string;
  username?: string | null;
  hours_silent: number;
  attempt_number: number;
  suggested_message: string;
}

export interface SmartFollowupSettingsCardProps {
  bundle: FollowupBundle | null;
  onSaveConfig?: (payload: Partial<FollowupConfigData>) => Promise<void>;
  onPreview?: () => Promise<{ candidates_count: number; items: FollowupPreviewItem[] }>;
  onRunNow?: () => Promise<{ sent_count: number }>;
}

export function SmartFollowupSettingsCard({
  bundle,
  onSaveConfig,
  onPreview,
  onRunNow,
}: SmartFollowupSettingsCardProps) {
  const { t } = useLanguage();
  const cfg = bundle?.config;

  const [isEnabled, setIsEnabled] = useState(Boolean(cfg?.is_enabled));
  const [delayHours, setDelayHours] = useState<number>(cfg?.delay_hours ?? 6);
  const [maxAttempts, setMaxAttempts] = useState<number>(cfg?.max_attempts ?? 1);
  const [businessHoursOnly, setBusinessHoursOnly] = useState<boolean>(cfg?.business_hours_only ?? true);
  const [startHour, setStartHour] = useState<number>(cfg?.start_hour ?? 9);
  const [endHour, setEndHour] = useState<number>(cfg?.end_hour ?? 20);
  const [discountPct, setDiscountPct] = useState<number>(cfg?.offer_discount_pct ?? 0);
  const [customTemplate, setCustomTemplate] = useState<string>(cfg?.custom_template || "");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [previewItems, setPreviewItems] = useState<FollowupPreviewItem[] | null>(null);

  useEffect(() => {
    if (!cfg) return;
    setIsEnabled(Boolean(cfg.is_enabled));
    setDelayHours(cfg.delay_hours ?? 6);
    setMaxAttempts(cfg.max_attempts ?? 1);
    setBusinessHoursOnly(Boolean(cfg.business_hours_only));
    setStartHour(cfg.start_hour ?? 9);
    setEndHour(cfg.end_hour ?? 20);
    setDiscountPct(cfg.offer_discount_pct ?? 0);
    setCustomTemplate(cfg.custom_template || "");
  }, [cfg]);

  const handleSave = async () => {
    if (!onSaveConfig) return;
    setSaving(true);
    try {
      await onSaveConfig({
        is_enabled: isEnabled,
        delay_hours: delayHours,
        max_attempts: maxAttempts,
        business_hours_only: businessHoursOnly,
        start_hour: startHour,
        end_hour: endHour,
        offer_discount_pct: discountPct,
        custom_template: customTemplate,
      });
    } catch {
      // Error surfaced via parent toast
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!onPreview) return;
    setPreviewing(true);
    try {
      const res = await onPreview();
      setPreviewItems(res?.items || []);
    } catch {
      setPreviewItems([]);
    } finally {
      setPreviewing(false);
    }
  };

  const handleRun = async () => {
    if (!onRunNow) return;
    setRunningNow(true);
    try {
      await onRunNow();
      setPreviewItems(null);
    } catch {
      // Error surfaced via parent toast
    } finally {
      setRunningNow(false);
    }
  };

  return (
    <Card>
      <CardHeader
        actions={
          <div className="d-flex align-items-center gap-1.5">
            {bundle && (
              <Badge variant={bundle.eligible_count > 0 ? "info" : "default"}>
                {t("followup.eligible_badge", { count: bundle.eligible_count })}
              </Badge>
            )}
            <Badge variant={isEnabled ? "success" : "default"} dot>
              {isEnabled ? t("payments.badge_enabled") : t("payments.badge_disabled")}
            </Badge>
          </div>
        }
      >
        <CardTitle className="d-flex align-items-center gap-2">
          <IconSparkles size={17} style={{ color: "var(--accent)" }} />
          <span>{t("followup.card_title")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-secondary small mb-3">{t("followup.card_desc")}</p>

        <div className="d-flex flex-column gap-3">
          <label className="d-flex align-items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="small fw-medium text-primary">{t("followup.enable_label")}</span>
          </label>

          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="small text-secondary d-block mb-1">{t("followup.delay_label")}</label>
              <select
                aria-label={t("followup.delay_label")}
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
                className="linear-input"
              >
                {[2, 4, 6, 12, 24, 48].map((h) => (
                  <option key={h} value={h}>
                    {h} {t("followup.hours_unit")}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="small text-secondary d-block mb-1">{t("followup.max_attempts_label")}</label>
              <select
                aria-label={t("followup.max_attempts_label")}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="linear-input"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="small text-secondary d-block mb-1">{t("followup.discount_label")}</label>
              <select
                aria-label={t("followup.discount_label")}
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value))}
                className="linear-input"
              >
                <option value={0}>{t("followup.discount_none")}</option>
                <option value={3}>3%</option>
                <option value={5}>5%</option>
                <option value={10}>10%</option>
                <option value={15}>15%</option>
              </select>
            </div>
          </div>

          <div className="p-2.5 rounded-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
            <label className="d-flex align-items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={businessHoursOnly}
                onChange={(e) => setBusinessHoursOnly(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="small text-primary d-inline-flex align-items-center gap-1">
                <IconClock size={13} />
                <span>{t("followup.business_hours_label")}</span>
              </span>
            </label>
            {businessHoursOnly && (
              <div className="d-flex align-items-center gap-2 small">
                <select
                  aria-label="Ish vaqti boshlanish soati"
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="linear-input py-1"
                  style={{ width: "auto" }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{`${String(i).padStart(2, "0")}:00`}</option>
                  ))}
                </select>
                <span className="text-secondary">-</span>
                <select
                  aria-label="Ish vaqti tugash soati"
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="linear-input py-1"
                  style={{ width: "auto" }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{`${String(i).padStart(2, "0")}:00`}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="small text-secondary d-block mb-1">{t("followup.template_label")}</label>
            <textarea
              rows={2}
              value={customTemplate}
              onChange={(e) => setCustomTemplate(e.target.value)}
              placeholder={t("followup.template_placeholder")}
              className="linear-input"
              style={{ fontSize: "0.78rem" }}
            />
          </div>

          {previewItems !== null && (
            <div className="p-2.5 rounded-2" style={{ backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-subtle)" }}>
              <div className="small fw-semibold text-primary mb-1.5">
                {t("followup.preview_heading")} ({previewItems.length})
              </div>
              {previewItems.length === 0 ? (
                <div className="small text-secondary">{t("followup.preview_empty")}</div>
              ) : (
                <div className="d-flex flex-column gap-2" style={{ maxHeight: 180, overflowY: "auto" }}>
                  {previewItems.map((item) => (
                    <div key={item.conversation_id} className="p-2 rounded-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", fontSize: "0.75rem" }}>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="fw-semibold text-primary">{item.customer_name}</span>
                        <span className="text-secondary font-monospace">
                          {item.hours_silent}h • #{item.attempt_number}
                        </span>
                      </div>
                      <div className="text-secondary">{item.suggested_message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-1">
            <div className="d-flex gap-2">
              {onPreview && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={previewing}
                  onClick={() => void handlePreview()}
                  icon={<IconEye size={14} />}
                >
                  {t("followup.btn_preview")}
                </Button>
              )}
              {onRunNow && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={runningNow}
                  onClick={() => void handleRun()}
                  icon={<IconSend size={14} />}
                >
                  {t("followup.btn_run_now")}
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!onSaveConfig}
              onClick={() => void handleSave()}
              icon={<IconCheck size={14} />}
            >
              {t("followup.btn_save")}
            </Button>
          </div>

          {bundle?.history && bundle.history.length > 0 && (
            <div className="pt-2 border-top border-subtle">
              <div className="small fw-semibold text-secondary mb-1.5 d-flex align-items-center gap-1">
                <IconRefresh size={12} />
                <span>{t("followup.history_title")}</span>
              </div>
              <div className="d-flex flex-column gap-1" style={{ maxHeight: 140, overflowY: "auto" }}>
                {bundle.history.slice(0, 5).map((h) => (
                  <div key={h.id} className="d-flex justify-content-between align-items-center small" style={{ fontSize: "0.73rem" }}>
                    <span className="text-primary text-truncate me-2">
                      {h.customer_name} (#{h.attempt_number})
                    </span>
                    <Badge variant={h.status === "sent" ? "success" : "danger"}>{h.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
