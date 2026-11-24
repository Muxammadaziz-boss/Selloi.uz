"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  IconActivity,
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconExternalLink,
  IconFilter,
  IconHistory,
  IconInfoCircle,
  IconRefresh,
  IconShieldCheck,
  IconShieldLock,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { fetchApi } from "../../lib/api";

export interface PaymentTestItem {
  test_id: string;
  admin_email: string;
  amount_uzs: number;
  amount_tiyin: number;
  currency: string;
  environment: "sandbox" | "live";
  provider: string;
  provider_bill_id?: string;
  external_reference: string;
  status: "created" | "pending" | "paid" | "failed" | "cancelled" | "expired";
  checkout_url?: string;
  created_at?: string;
  completed_at?: string;
  payment_purpose: string;
}

export interface PaymentTestStats {
  total_tests: number;
  pending_tests: number;
  sandbox: {
    total_count: number;
    simulated_paid_uzs: number;
    simulated_paid_tiyin: number;
    is_revenue: boolean;
  };
  live: {
    total_count: number;
    collected_paid_uzs: number;
    collected_paid_tiyin: number;
    is_revenue: boolean;
    settlement_note: string;
  };
}

const PRESET_AMOUNTS = [1000, 2000, 3000, 5000, 10000];

export function PaymentTestingStudio() {
  // Amount & Environment State
  const [amountUzs, setAmountUzs] = useState<number>(1000);
  const [customInput, setCustomInput] = useState<string>("1000");
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const [confirmLive, setConfirmLive] = useState<boolean>(false);
  const [description, setDescription] = useState<string>("");

  // Request & Active Invoice State
  const [createBusy, setCreateBusy] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>("");
  const [activeBill, setActiveBill] = useState<PaymentTestItem | null>(null);

  // History & Stats State
  const [history, setHistory] = useState<PaymentTestItem[]>([]);
  const [stats, setStats] = useState<PaymentTestStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncBusyId, setSyncBusyId] = useState<string | null>(null);

  // Details Modal
  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);

  // Fetch History and Stats
  const loadHistoryAndStats = useCallback(async () => {
    setHistoryLoading(true);
    try {
      let url = "/api/platform/payment-testing/history?limit=100";
      if (envFilter !== "all") url += `&environment=${envFilter}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;

      const [histRes, statsRes] = await Promise.all([
        fetchApi<any>(url).catch(() => ({ items: [] })),
        fetchApi<any>("/api/platform/payment-testing/stats").catch(() => null),
      ]);

      setHistory(histRes.items || []);
      setStats(statsRes);
    } catch (err: any) {
      console.error("Failed to load payment testing data:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [envFilter, statusFilter]);

  useEffect(() => {
    loadHistoryAndStats();
  }, [loadHistoryAndStats]);

  // Handle preset selection
  const handleSelectPreset = (val: number) => {
    setAmountUzs(val);
    setCustomInput(String(val));
    setCreateError("");
  };

  // Handle custom amount input
  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value.replace(/[^0-9]/g, "");
    setCustomInput(valStr);
    setCreateError("");
    if (valStr) {
      const parsed = parseInt(valStr, 10);
      setAmountUzs(parsed);
    }
  };

  // Create payment test
  const handleCreateTest = async () => {
    setCreateError("");

    if (!amountUzs || isNaN(amountUzs)) {
      setCreateError("To'lov summasi kiritilishi shart.");
      return;
    }
    if (amountUzs < 1000) {
      setCreateError("Minimal to'lov summasi 1 000 UZS bo'lishi kerak.");
      return;
    }
    if (amountUzs > 10000) {
      setCreateError("Maksimal to'lov summasi 10 000 UZS dan oshmasligi kerak.");
      return;
    }
    if (environment === "live" && !confirmLive) {
      setCreateError("LIVE to'lov uchun ogohlantirishni qabul qilish va tasdiqlash shart.");
      return;
    }

    setCreateBusy(true);
    try {
      const idempotencyKey = `idemp_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetchApi<PaymentTestItem>("/api/platform/payment-testing/create", {
        method: "POST",
        body: JSON.stringify({
          amount_uzs: amountUzs,
          environment,
          confirm_live: environment === "live" ? confirmLive : false,
          description: description.trim() || undefined,
          idempotency_key: idempotencyKey,
        }),
      });

      setActiveBill(res);
      setConfirmLive(false);
      await loadHistoryAndStats();
    } catch (err: any) {
      setCreateError(err.message || "To'lov hisobini yaratishda xatolik yuz berdi");
    } finally {
      setCreateBusy(false);
    }
  };

  // Sync bill status with provider
  const handleSyncStatus = async (testId: string) => {
    setSyncBusyId(testId);
    try {
      const res = await fetchApi<any>(`/api/platform/payment-testing/${testId}/sync`, {
        method: "POST",
      });

      // Update active bill if matching
      if (activeBill && activeBill.test_id === testId) {
        setActiveBill((prev) => (prev ? { ...prev, status: res.status } : null));
      }

      await loadHistoryAndStats();
    } catch (err: any) {
      alert(`Sinxronizatsiya xatosi: ${err.message}`);
    } finally {
      setSyncBusyId(null);
    }
  };

  // Open details modal
  const handleOpenDetails = async (testId: string) => {
    setDetailsLoading(true);
    setSelectedTest(null);
    try {
      const res = await fetchApi<any>(`/api/platform/payment-testing/${testId}`);
      setSelectedTest(res);
    } catch (err: any) {
      alert(`Ma'lumotlarni yuklashda xatolik: ${err.message}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Helper for status badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="success">PAID (To'langan)</Badge>;
      case "pending":
        return <Badge variant="warning">PENDING (Kutilmoqda)</Badge>;
      case "failed":
        return <Badge variant="danger">FAILED (Xato)</Badge>;
      case "cancelled":
        return <Badge variant="default">CANCELLED</Badge>;
      case "expired":
        return <Badge variant="default">EXPIRED</Badge>;
      default:
        return <Badge variant="default">{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* 1. Header Banner */}
      <div className="linear-card p-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
              style={{
                width: "46px",
                height: "46px",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid var(--success-border)",
              }}
            >
              <IconCreditCard size={24} style={{ color: "var(--success)" }} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="fw-bold mb-0 text-primary" style={{ fontSize: "1.2rem", letterSpacing: "-0.01em" }}>
                  Payment Testing Studio (TezCheck Diagnostika)
                </h2>
                <Badge variant="accent">Platform Owner Exclusive</Badge>
              </div>
              <p className="text-secondary small mb-0 mt-0.5">
                TezCheck to'lov shlyuzini 1 000 dan 10 000 UZS gacha bo'lgan kichik summalar orqali xavfsiz sinovdan o'tkazish markazi.
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistoryAndStats}
              loading={historyLoading}
              icon={<IconRefresh size={16} />}
            >
              Yangilash
            </Button>
          </div>
        </div>

        {/* Isolation Guarantee Alert */}
        <div
          className="mt-3.5 p-3 rounded-2 d-flex align-items-start gap-2.5"
          style={{
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            fontSize: "0.82rem",
          }}
        >
          <IconShieldCheck size={18} className="flex-shrink-0 mt-0.5 text-primary" />
          <div className="text-secondary">
            <strong className="text-primary">Xavfsizlik Kafolati (Isolation Guarantee):</strong> Ushbu modul orqali amalga oshirilgan to'lovlar{" "}
            <span className="text-primary fw-bold">faqat diagnostika maqsadida</span> saqlanadi. Ular hech qachon START, PRO yoki ULTRA rejalarini faollashtirmaydi, 7 kunlik Mega Chegirmani boshlamaydi va mijozlar obunasiga ta'sir qilmaydi.
          </div>
        </div>
      </div>

      {/* 2. Financial & Diagnostic Stats Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem" }}>
                  Jami Test To'lovlari
                </span>
                <Badge variant="default">Total</Badge>
              </div>
              <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                {stats?.total_tests || 0} <span className="fs-5 text-secondary fw-normal">ta</span>
              </div>
            </div>
            <div className="text-secondary small pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.76rem" }}>
              Kutilayotgan: <strong className="text-warning font-monospace">{stats?.pending_tests || 0} ta</strong>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem" }}>
                  Sandbox (Simulyatsiya)
                </span>
                <Badge variant="info">Zero Risk</Badge>
              </div>
              <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                {stats?.sandbox.total_count || 0} <span className="fs-5 text-secondary fw-normal">ta</span>
              </div>
            </div>
            <div className="text-secondary small pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.76rem" }}>
              Simulyatsiya: <strong className="font-monospace text-info">{(stats?.sandbox.simulated_paid_uzs || 0).toLocaleString()} UZS</strong> (Tushum emas)
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem" }}>
                  Live Test To'lovlari
                </span>
                <Badge variant="warning">Haqiqiy Kartadan</Badge>
              </div>
              <div className="fs-2 fw-bold font-monospace mb-1" style={{ color: "var(--warning-text)" }}>
                {stats?.live.total_count || 0} <span className="fs-5 text-secondary fw-normal">ta</span>
              </div>
            </div>
            <div className="text-secondary small pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.76rem" }}>
              Undirilgan: <strong className="font-monospace text-warning">{(stats?.live.collected_paid_uzs || 0).toLocaleString()} UZS</strong> (Reconciliation)
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem" }}>
                  Ruxsat etilgan diapazon
                </span>
                <Badge variant="accent">Min - Max</Badge>
              </div>
              <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                1 000 - 10 000 <span className="fs-5 text-secondary fw-normal">UZS</span>
              </div>
            </div>
            <div className="text-secondary small pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.76rem" }}>
              Tiyin o'lchov birligi: <strong className="font-monospace text-primary">1 UZS = 100 tiyin</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Testing Studio Workspace */}
      <div className="row g-3">
        {/* Left Column: Amount & Environment Configuration */}
        <div className="col-12 col-lg-6">
          <Card className="h-100">
            <CardHeader>
              <CardTitle>1. To'lov Parametrlarini Tanlash</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="d-flex flex-column gap-3.5">
                {/* Environment Mode Switcher */}
                <div>
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-1.5" style={{ fontSize: "0.75rem" }}>
                    To'lov Muhiti (Environment)
                  </label>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`btn flex-fill py-2 d-flex align-items-center justify-content-center gap-2 ${
                        environment === "sandbox" ? "btn-primary" : "btn-outline-secondary"
                      }`}
                      onClick={() => {
                        setEnvironment("sandbox");
                        setConfirmLive(false);
                      }}
                    >
                      <IconShieldCheck size={18} />
                      <span className="fw-bold">SANDBOX (Sinov)</span>
                    </button>

                    <button
                      type="button"
                      className={`btn flex-fill py-2 d-flex align-items-center justify-content-center gap-2 ${
                        environment === "live" ? "btn-warning text-dark fw-bold" : "btn-outline-secondary"
                      }`}
                      onClick={() => setEnvironment("live")}
                    >
                      <IconAlertTriangle size={18} />
                      <span>LIVE (Haqiqiy Kartadan)</span>
                    </button>
                  </div>
                  <div className="text-secondary small mt-1.5" style={{ fontSize: "0.78rem" }}>
                    {environment === "sandbox" ? (
                      <span className="text-info">
                        ℹ️ Sandbox rejimi: TezCheck sinov muhiti ishlatiladi. Real kartadan mablag' yechilmaydi.
                      </span>
                    ) : (
                      <span className="text-warning fw-semibold">
                        ⚠️ LIVE rejimi: Haqiqiy TezCheck merchant hisobidan to'lov havolasi yaratiladi va hisobdan pul yechiladi.
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount Selector Presets */}
                <div>
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-1.5" style={{ fontSize: "0.75rem" }}>
                    Qulay Summa Presetlari
                  </label>
                  <div className="d-flex flex-wrap gap-2">
                    {PRESET_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`btn btn-sm ${
                          amountUzs === preset && customInput === String(preset)
                            ? "btn-primary"
                            : "btn-outline-secondary"
                        }`}
                        onClick={() => handleSelectPreset(preset)}
                      >
                        {preset.toLocaleString()} UZS
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Numeric Input */}
                <div>
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-1.5" style={{ fontSize: "0.75rem" }}>
                    Maxsus Summa (1 000 - 10 000 UZS)
                  </label>
                  <div className="input-group">
                    <input
                      type="number"
                      min={1000}
                      max={10000}
                      step={1}
                      className="form-control font-monospace"
                      value={customInput}
                      onChange={handleCustomInputChange}
                      placeholder="Masalan: 4500"
                    />
                    <span className="input-group-text font-monospace text-secondary">UZS</span>
                  </div>

                  {/* Tiyin Equivalent */}
                  <div className="d-flex align-items-center justify-content-between mt-1.5 small text-secondary">
                    <span>Tiyin ekvivalenti (Backend / TezCheck):</span>
                    <strong className="font-monospace text-primary">
                      {amountUzs ? (amountUzs * 100).toLocaleString() : 0} tiyin
                    </strong>
                  </div>
                </div>

                {/* Optional Description */}
                <div>
                  <label className="form-label text-secondary small fw-bold text-uppercase mb-1.5" style={{ fontSize: "0.75rem" }}>
                    Qayd / Izoh (Ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Masalan: Humo / Uzcard to'lov tekshiruvi"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* LIVE Explicit Confirmation Box */}
                {environment === "live" && (
                  <div
                    className="p-3 rounded-2 border"
                    style={{
                      background: "rgba(245, 158, 11, 0.08)",
                      borderColor: "var(--warning-border)",
                    }}
                  >
                    <div className="d-flex align-items-start gap-2 mb-2 text-warning fw-bold">
                      <IconAlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                      <span>DIQQAT: Haqiqiy to'lov ogohlantirishi</span>
                    </div>
                    <p className="text-secondary small mb-2.5" style={{ fontSize: "0.82rem", lineHeight: 1.4 }}>
                      Bu haqiqiy to‘lov. Tanlangan <strong className="text-primary font-monospace">{amountUzs?.toLocaleString()} UZS</strong> summa kartangizdan yoki to‘lov vositangizdan real ravishda undiriladi.
                    </p>
                    <label className="d-flex align-items-center gap-2 cursor-pointer text-primary small user-select-none">
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={confirmLive}
                        onChange={(e) => setConfirmLive(e.target.checked)}
                      />
                      <span>Haqiqiy to'lov havolasi yaratilishini tasdiqlayman</span>
                    </label>
                  </div>
                )}

                {/* Error Banner */}
                {createError && (
                  <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-0">
                    <IconAlertCircle size={16} className="flex-shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  variant={environment === "live" ? "danger" : "primary"}
                  onClick={handleCreateTest}
                  loading={createBusy}
                  disabled={environment === "live" && !confirmLive}
                  className="w-100 py-2.5 fw-bold"
                >
                  {environment === "live" ? (
                    <>
                      <IconAlertTriangle size={18} />
                      <span>Haqiqiy To'lov Havolasini Yaratish ({amountUzs?.toLocaleString()} UZS)</span>
                    </>
                  ) : (
                    <>
                      <IconSparkles size={18} />
                      <span>Sandbox Test To'lovini Yaratish ({amountUzs?.toLocaleString()} UZS)</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Active Bill Status & Quick Actions */}
        <div className="col-12 col-lg-6">
          <Card className="h-100">
            <CardHeader
              actions={
                activeBill && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSyncStatus(activeBill.test_id)}
                    loading={syncBusyId === activeBill.test_id}
                    icon={<IconRefresh size={14} />}
                  >
                    Holatni tekshirish
                  </Button>
                )
              }
            >
              <CardTitle>2. Faol Test To'lovi Holati</CardTitle>
            </CardHeader>
            <CardContent>
              {activeBill ? (
                <div className="d-flex flex-column gap-3">
                  <div
                    className="p-3.5 rounded-2 border d-flex flex-column gap-2.5"
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-secondary small">Test ID:</span>
                        <code className="text-primary fw-bold">{activeBill.test_id}</code>
                      </div>
                      {renderStatusBadge(activeBill.status)}
                    </div>

                    <div className="d-flex align-items-baseline gap-2">
                      <span className="fs-1 fw-bold text-primary font-monospace">
                        {activeBill.amount_uzs?.toLocaleString()}
                      </span>
                      <span className="fs-4 text-secondary font-monospace">UZS</span>
                      <span className="small text-secondary font-monospace ms-2">
                        ({activeBill.amount_tiyin?.toLocaleString()} tiyin)
                      </span>
                    </div>

                    <div className="d-flex flex-column gap-1.5 text-secondary small pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.8rem" }}>
                      <div className="d-flex justify-content-between">
                        <span>Muhit:</span>
                        <span className="text-primary fw-bold text-uppercase">{activeBill.environment}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Provayder Bill ID:</span>
                        <span className="text-primary font-monospace">{activeBill.provider_bill_id || "-"}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Buyurtma Ref:</span>
                        <span className="text-primary font-monospace">{activeBill.external_reference}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Yaratilgan vaqt:</span>
                        <span className="text-primary">
                          {activeBill.created_at ? new Date(activeBill.created_at).toLocaleString() : "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Redirection Button */}
                  {activeBill.checkout_url && activeBill.status === "pending" && (
                    <div className="d-flex flex-column gap-2">
                      <a
                        href={activeBill.checkout_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-success py-2.5 d-flex align-items-center justify-content-center gap-2 fw-bold text-white shadow"
                      >
                        <IconExternalLink size={18} />
                        <span>To'lov Sahifasiga O'tish (Hosted Checkout)</span>
                        <IconArrowRight size={16} />
                      </a>
                      <p className="text-secondary small text-center mb-0" style={{ fontSize: "0.78rem" }}>
                        Havola yangi oynada ochiladi. To'lov qilingach, "Holatni tekshirish" tugmasini bosing.
                      </p>
                    </div>
                  )}

                  {activeBill.status === "paid" && (
                    <div className="alert alert-success py-2.5 px-3 d-flex align-items-center gap-2 mb-0">
                      <IconCheck size={20} className="flex-shrink-0 text-success" />
                      <div className="small">
                        <strong>To'lov tasdiqlandi!</strong> TezCheck orqali to'lov muvaffaqiyatli qabul qilindi.
                        (Hech qanday obuna o'zgartirilmadi).
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-5 text-secondary">
                  <IconCreditCard size={40} className="mb-2 opacity-50" />
                  <p className="mb-0">Hozircha faol test to'lovi mavjud emas.</p>
                  <p className="small opacity-75">Chap tomondan parametr tanlab "Test To'lovini Yaratish" tugmasini bosing.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Payment Test History Table */}
      <Card>
        <CardHeader
          actions={
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Environment Filter */}
              <select
                className="form-select form-select-sm"
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value)}
                style={{ width: "130px" }}
              >
                <option value="all">Barcha muhit</option>
                <option value="sandbox">Sandbox</option>
                <option value="live">Live</option>
              </select>

              {/* Status Filter */}
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: "140px" }}
              >
                <option value="all">Barcha holat</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          }
        >
          <CardTitle>Test To'lovlari Tarixi (Audit Trail)</CardTitle>
        </CardHeader>

        <div className="table-responsive">
          <table className="table table-vcenter card-table table-hover">
            <thead>
              <tr>
                <th>Test ID</th>
                <th>Admin</th>
                <th>Summa (UZS)</th>
                <th>Summa (tiyin)</th>
                <th>Muhit</th>
                <th>Holat</th>
                <th>Yaratildi</th>
                <th className="text-end">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.test_id}>
                  <td>
                    <code className="text-primary fw-bold" style={{ fontSize: "0.85rem" }}>
                      {item.test_id}
                    </code>
                  </td>
                  <td className="small text-secondary">{item.admin_email}</td>
                  <td className="font-monospace fw-bold text-primary">
                    {item.amount_uzs?.toLocaleString()} UZS
                  </td>
                  <td className="font-monospace small text-secondary">
                    {item.amount_tiyin?.toLocaleString()}
                  </td>
                  <td>
                    {item.environment === "live" ? (
                      <Badge variant="warning">LIVE</Badge>
                    ) : (
                      <Badge variant="default">SANDBOX</Badge>
                    )}
                  </td>
                  <td>{renderStatusBadge(item.status)}</td>
                  <td className="small text-secondary">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSyncStatus(item.test_id)}
                        loading={syncBusyId === item.test_id}
                        title="Provayderdan holatni yangilash"
                        icon={<IconRefresh size={14} />}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetails(item.test_id)}
                      >
                        Batafsil
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {history.length === 0 && !historyLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-secondary">
                    Test to'lovlari tarixi mavjud emas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. Details Modal */}
      {selectedTest && (
        <div
          className="modal modal-blur fade show d-block"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", zIndex: 1050 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-secondary border-opacity-25" style={{ background: "var(--card-bg)" }}>
              <div className="modal-header border-secondary border-opacity-20">
                <div className="d-flex align-items-center gap-2">
                  <IconShieldLock size={20} className="text-primary" />
                  <h5 className="modal-title fw-bold text-primary">
                    Test To'lovi Tafsilotlari: {selectedTest.test_id}
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedTest(null)}
                />
              </div>

              <div className="modal-body d-flex flex-column gap-3">
                <div className="row g-2">
                  <div className="col-sm-6">
                    <div className="p-2.5 rounded border border-secondary border-opacity-20">
                      <div className="text-secondary small">Summa (UZS / Tiyin):</div>
                      <div className="fw-bold text-primary font-monospace">
                        {selectedTest.amount_uzs?.toLocaleString()} UZS ({selectedTest.amount_tiyin?.toLocaleString()} tiyin)
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="p-2.5 rounded border border-secondary border-opacity-20">
                      <div className="text-secondary small">Holat va Muhit:</div>
                      <div className="d-flex align-items-center gap-2 mt-0.5">
                        {renderStatusBadge(selectedTest.status)}
                        <Badge variant={selectedTest.environment === "live" ? "warning" : "default"}>
                          {selectedTest.environment.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-column gap-1.5 small text-secondary">
                  <div><strong>Admin pochtasi:</strong> <span className="text-primary">{selectedTest.admin_email}</span></div>
                  <div><strong>Provayder Bill ID:</strong> <code className="text-primary">{selectedTest.provider_bill_id || "Mavjud emas"}</code></div>
                  <div><strong>Tashqi Order ID:</strong> <code className="text-primary">{selectedTest.external_reference}</code></div>
                  <div><strong>Idempotency Key:</strong> <code className="text-primary">{selectedTest.idempotency_key || "Yo'q"}</code></div>
                  <div><strong>Yaratilgan vaqt:</strong> <span className="text-primary">{selectedTest.created_at ? new Date(selectedTest.created_at).toLocaleString() : "-"}</span></div>
                  <div><strong>Yakunlangan vaqt:</strong> <span className="text-primary">{selectedTest.completed_at ? new Date(selectedTest.completed_at).toLocaleString() : "-"}</span></div>
                </div>

                {/* Raw Provider Response JSON */}
                <div>
                  <div className="text-secondary small fw-bold text-uppercase mb-1">
                    Provayder Javobi (Raw JSON snapshot)
                  </div>
                  <pre
                    className="p-3 rounded border border-secondary border-opacity-20 font-monospace small mb-0"
                    style={{ maxHeight: "200px", overflowY: "auto", fontSize: "0.78rem", background: "rgba(0, 0, 0, 0.4)" }}
                  >
                    {JSON.stringify(selectedTest.provider_response || selectedTest.metadata_snapshot, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="modal-footer border-secondary border-opacity-20">
                <Button variant="outline" onClick={() => setSelectedTest(null)}>
                  Yopish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
