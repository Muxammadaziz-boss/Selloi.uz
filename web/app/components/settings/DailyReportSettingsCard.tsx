"use client";

import React, { useEffect, useState } from "react";
import { IconBrandTelegram, IconCheck, IconClock, IconEye, IconSend } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export interface StoreReportConfigData {
  organization_id: number;
  is_enabled: boolean;
  send_hour: number;
  include_orders: boolean;
  include_customers: boolean;
  last_sent_date?: string | null;
}

export interface StoreReportPreviewData {
  organization_id: number;
  store_name: string;
  date: string;
  report_text: string;
  sent_count?: number;
  recipient_count?: number;
  dry_run?: boolean;
}

export interface StoreReportBundle {
  config: StoreReportConfigData;
  preview: StoreReportPreviewData;
}

export interface DailyReportSettingsCardProps {
  bundle: StoreReportBundle | null;
  onSaveConfig?: (payload: Partial<StoreReportConfigData>) => Promise<void>;
  onPreviewReport?: () => Promise<StoreReportPreviewData>;
  onSendReportNow?: () => Promise<StoreReportPreviewData>;
}

export function DailyReportSettingsCard({
  bundle,
  onSaveConfig,
  onPreviewReport,
  onSendReportNow,
}: DailyReportSettingsCardProps) {
  const cfg = bundle?.config;

  const [isEnabled, setIsEnabled] = useState(Boolean(cfg?.is_enabled));
  const [sendHour, setSendHour] = useState<number>(cfg?.send_hour ?? 21);
  const [includeOrders, setIncludeOrders] = useState<boolean>(cfg?.include_orders ?? true);
  const [includeCustomers, setIncludeCustomers] = useState<boolean>(cfg?.include_customers ?? true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewText, setPreviewText] = useState<string>(bundle?.preview?.report_text || "");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!cfg) return;
    setIsEnabled(Boolean(cfg.is_enabled));
    setSendHour(cfg.send_hour ?? 21);
    setIncludeOrders(cfg.include_orders ?? true);
    setIncludeCustomers(cfg.include_customers ?? true);
  }, [cfg]);

  useEffect(() => {
    if (bundle?.preview?.report_text) {
      setPreviewText(bundle.preview.report_text);
    }
  }, [bundle?.preview?.report_text]);

  const handleSave = async () => {
    if (!onSaveConfig) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      await onSaveConfig({
        is_enabled: isEnabled,
        send_hour: sendHour,
        include_orders: includeOrders,
        include_customers: includeCustomers,
      });
      setStatusMsg("Kunlik hisobot jadvali saqlandi.");
    } catch (err: any) {
      setStatusMsg(err?.message || "Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!onPreviewReport) return;
    setPreviewing(true);
    setStatusMsg(null);
    try {
      const res = await onPreviewReport();
      if (res?.report_text) {
        setPreviewText(res.report_text);
      }
      if (typeof res?.recipient_count === "number") {
        setStatusMsg(`Telegramda ${res.recipient_count} ta admin hisoboti olishi mumkin.`);
      }
    } catch (err: any) {
      setStatusMsg(err?.message || "Namuna hisobotni yuklashda xatolik.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSendNow = async () => {
    if (!onSendReportNow) return;
    setSending(true);
    setStatusMsg(null);
    try {
      const res = await onSendReportNow();
      if (res?.report_text) {
        setPreviewText(res.report_text);
      }
      setStatusMsg(
        res?.sent_count && res.sent_count > 0
          ? `Hisobot ${res.sent_count} ta admin Telegramiga yuborildi!`
          : "Telegram ulangan faol admin topilmadi (Adminlar bo'limida Telegram ID qo'shing)."
      );
    } catch (err: any) {
      setStatusMsg(err?.message || "Hisobot yuborishda xatolik.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader
        actions={
          <Badge variant={isEnabled ? "success" : "default"} dot>
            {isEnabled ? `Har kuni ${String(sendHour).padStart(2, "0")}:00` : "O'chiq"}
          </Badge>
        }
      >
        <div className="d-flex align-items-center gap-2">
          <IconBrandTelegram size={18} style={{ color: "var(--info)" }} />
          <CardTitle>Kunlik Telegram Hisoboti</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="d-flex flex-column gap-3">
        <p className="text-secondary small mb-0">
          Do&apos;konning kunlik buyurtmalar, mijoz suhbatlari va onlayn to&apos;lovlar xulosasini belgilangan vaqtda do&apos;kon adminlariga Telegramdan yuboradi.
        </p>

        {/* Enable switch + hour selector */}
        <div className="row g-2 align-items-center">
          <div className="col-12 col-sm-7">
            <label className="d-flex align-items-center gap-2 cursor-pointer small fw-medium text-primary mb-0">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="form-check-input mt-0"
              />
              <span>Avtomatik kunlik hisobotni yoqish</span>
            </label>
          </div>

          <div className="col-12 col-sm-5">
            <div className="d-flex align-items-center gap-1.5">
              <IconClock size={14} className="text-secondary flex-shrink-0" />
              <select
                className="linear-input py-1"
                style={{ fontSize: "0.8rem" }}
                value={sendHour}
                onChange={(e) => setSendHour(Number(e.target.value))}
                aria-label="Hisobot yuborish soati (Toshkent)"
              >
                {Array.from({ length: 15 }, (_, idx) => idx + 9).map((hr) => (
                  <option key={hr} value={hr}>
                    {String(hr).padStart(2, "0")}:00 (Toshkent)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-3 pt-1">
          <label className="d-flex align-items-center gap-1.5 small text-secondary cursor-pointer mb-0">
            <input
              type="checkbox"
              checked={includeOrders}
              onChange={(e) => setIncludeOrders(e.target.checked)}
              className="form-check-input mt-0"
            />
            <span>Buyurtmalar va to&apos;lovlar</span>
          </label>
          <label className="d-flex align-items-center gap-1.5 small text-secondary cursor-pointer mb-0">
            <input
              type="checkbox"
              checked={includeCustomers}
              onChange={(e) => setIncludeCustomers(e.target.checked)}
              className="form-check-input mt-0"
            />
            <span>Mijozlar va suhbatlar</span>
          </label>
        </div>

        {statusMsg && (
          <div
            className="p-2 rounded-2 small text-primary"
            style={{ backgroundColor: "var(--info-subtle)", border: "1px solid var(--info-border)" }}
          >
            {statusMsg}
          </div>
        )}

        {previewText && (
          <pre
            className="p-2.5 rounded-2 small font-monospace text-secondary mb-0"
            style={{
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-subtle)",
              whiteSpace: "pre-wrap",
              fontSize: "0.75rem",
            }}
          >
            {previewText}
          </pre>
        )}

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-2 border-top" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="d-flex gap-2">
            {onPreviewReport && (
              <Button variant="secondary" size="sm" icon={<IconEye size={14} />} onClick={handlePreview} disabled={previewing}>
                {previewing ? "Yuklanmoqda..." : "Namuna"}
              </Button>
            )}
            {onSendReportNow && (
              <Button variant="secondary" size="sm" icon={<IconSend size={14} />} onClick={handleSendNow} disabled={sending}>
                {sending ? "Yuborilmoqda..." : "Hozir yuborish"}
              </Button>
            )}
          </div>
          {onSaveConfig && (
            <Button variant="primary" size="sm" icon={<IconCheck size={14} />} onClick={handleSave} disabled={saving}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
