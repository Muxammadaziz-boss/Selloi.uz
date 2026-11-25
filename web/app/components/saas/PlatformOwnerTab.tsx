"use client";

import React, { useMemo, useState } from "react";
import {
  IconActivity,
  IconAlertCircle,
  IconArrowRight,
  IconBellRinging,
  IconBrandTelegram,
  IconBuildingSkyscraper,
  IconCalendarPlus,
  IconChartBar,
  IconCheck,
  IconCopy,
  IconCpu,
  IconCreditCard,
  IconCrown,
  IconDatabase,
  IconDownload,
  IconEye,
  IconHistory,
  IconLayersLinked,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconServer,
  IconShieldLock,
  IconSparkles,
  IconTrash,
  IconTrendingUp,
  IconUserCheck,
  IconUserOff,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ActivityBarsChart, DonutChart } from "../ui/Charts";
import { EmptyState } from "../ui/EmptyState";
import { OwnerPricingStudio } from "./OwnerPricingStudio";
import { PaymentTestingStudio } from "./PaymentTestingStudio";

export interface PlatformFinancialMetrics {
  mrr_usd: number;
  arr_usd: number;
  arpu_usd: number;
  total_organizations: number;
  active_subscriptions: number;
  trial_organizations: number;
  churn_rate_percent: number;
  total_ai_messages_this_month: number;
  total_ai_cost_usd: number;
  gross_margin_percent: number;
  plan_distribution: Record<string, number>;
}

export interface OrganizationProfitability {
  id: number;
  name: string;
  slug: string;
  category: string;
  status?: string;
  plan: string;
  subscription_status: string;
  monthly_revenue_usd: number;
  monthly_ai_cost_usd: number;
  gross_margin_percent: number;
  is_profitable: boolean;
  conversations_count?: number;
  bot_configured?: boolean;
  created_at?: string;
}

export interface PlatformUser {
  id: number;
  email: string;
  full_name?: string;
  telegram_user_id?: number;
  is_platform_owner: boolean;
  is_platform_admin?: boolean;
  is_active: boolean;
  organizations_count?: number;
  organization_names?: string[];
  created_at?: string;
}

export interface PlatformAuditLog {
  id: number;
  organization_id?: number | null;
  action: string;
  resource: string;
  resource_id?: string | null;
  metadata?: any;
  created_at?: string;
}

export interface PlatformSystemHealth {
  status: string;
  database: string;
  redis?: string;
  app_env: string;
  version: string;
  gemini_configured: boolean;
  openai_configured: boolean;
  telegram_configured: boolean;
  tezcheck_configured?: boolean;
}

type PlatformSubTab =
  | "overview"
  | "stores"
  | "users"
  | "plans"
  | "usage"
  | "system"
  | "audit"
  | "payment-testing";

interface PlatformOwnerTabProps {
  subTab?: PlatformSubTab;
  metrics: PlatformFinancialMetrics | null;
  organizations: OrganizationProfitability[];
  usersList?: PlatformUser[];
  systemHealth?: PlatformSystemHealth | null;
  auditLogs?: PlatformAuditLog[];
  loading: boolean;
  isCurrentUserOwner?: boolean;
  onRefresh: () => void;
  onUpdatePlan: (planCode: string, payload: any) => Promise<void>;
  onEnterStore?: (store: OrganizationProfitability) => void;
  onSwitchSubTab?: (subTab: PlatformSubTab) => void;
  onCreateStore?: (payload: any) => Promise<any>;
  onUpdateStoreStatus?: (storeId: number, status: string) => Promise<void>;
  onDeleteStore?: (storeId: number) => Promise<void>;
  onAppointSiteAdmin?: (email: string, fullName?: string) => Promise<void>;
  onToggleSiteAdmin?: (userId: number, makeAdmin: boolean) => Promise<void>;
  onToggleUserStatus?: (userId: number, isActive: boolean) => Promise<void>;
  onInspectStore?: (storeId: number) => Promise<any>;
  onUpdateStoreSubscription?: (
    storeId: number,
    payload: { plan_code: string; status: string; billing_cycle: string; extend_days: number }
  ) => Promise<any>;
  onSendDailyReport?: () => Promise<any>;
  onSendBroadcast?: (payload: { audience: string; message: string; dry_run?: boolean }) => Promise<any>;
}

function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const escapeCell = (val: string | number | boolean | null | undefined) => {
    const str = val === null || val === undefined ? "" : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvLines = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getAuditActionVariant(action: string): "danger" | "success" | "info" | "warning" | "accent" {
  const a = (action || "").toLowerCase();
  if (a.includes("delete") || a.includes("suspend") || a.includes("revoke")) return "danger";
  if (a.includes("create") || a.includes("activate") || a.includes("completed") || a.includes("appoint")) return "success";
  if (a.includes("subscription") || a.includes("broadcast") || a.includes("report")) return "info";
  if (a.includes("password") || a.includes("status")) return "warning";
  return "accent";
}

export function PlatformOwnerTab({
  subTab = "overview",
  metrics,
  organizations,
  usersList = [],
  systemHealth = null,
  auditLogs = [],
  loading,
  isCurrentUserOwner = false,
  onRefresh,
  onUpdatePlan: _onUpdatePlan,
  onEnterStore,
  onSwitchSubTab,
  onCreateStore,
  onUpdateStoreStatus,
  onDeleteStore,
  onAppointSiteAdmin,
  onToggleSiteAdmin,
  onToggleUserStatus,
  onInspectStore,
  onUpdateStoreSubscription,
  onSendDailyReport,
  onSendBroadcast,
}: PlatformOwnerTabProps) {
  const [storeSearch, setStoreSearch] = useState("");
  const [storeStatusFilter, setStoreStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [storePlanFilter, setStorePlanFilter] = useState<string>("all");
  const [storeSort, setStoreSort] = useState<"newest" | "revenue" | "cost" | "conversations">("newest");

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admins" | "owners" | "telegram" | "suspended">("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("all");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [adminActionBusy, setAdminActionBusy] = useState(false);

  // Create store modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStoreName, setCreateStoreName] = useState("");
  const [createStoreSlug, setCreateStoreSlug] = useState("");
  const [createStoreCategory, setCreateStoreCategory] = useState("Elektronika va Texnika");
  const [createStoreEmail, setCreateStoreEmail] = useState("");
  const [createStorePassword, setCreateStorePassword] = useState("");
  const [createStoreBotToken, setCreateStoreBotToken] = useState("");
  const [createStoreCurrency, setCreateStoreCurrency] = useState<"UZS" | "USD">("UZS");
  const [createStorePlan, setCreateStorePlan] = useState("pro");
  const [createStoreBusy, setCreateStoreBusy] = useState(false);
  const [createStoreError, setCreateStoreError] = useState("");
  const [createStoreSuccess, setCreateStoreSuccess] = useState<any>(null);

  // Store inspector & subscription editor modal state
  const [inspectStoreId, setInspectStoreId] = useState<number | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState("");
  const [inspectDetails, setInspectDetails] = useState<any>(null);
  const [subPlanCode, setSubPlanCode] = useState("pro");
  const [subStatus, setSubStatus] = useState("active");
  const [subCycle, setSubCycle] = useState("monthly");
  const [subExtendDays, setSubExtendDays] = useState(0);
  const [subSaving, setSubSaving] = useState(false);

  // Daily report & Telegram broadcast modal state
  const [reportBusy, setReportBusy] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState<"store_owners" | "site_admins" | "all_linked">("store_owners");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastPreviewCount, setBroadcastPreviewCount] = useState<number | null>(null);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastResult, setBroadcastResult] = useState<any>(null);

  const resetCreateForm = () => {
    setCreateStoreName("");
    setCreateStoreSlug("");
    setCreateStoreEmail("");
    setCreateStorePassword("");
    setCreateStoreBotToken("");
    setCreateStoreCurrency("UZS");
    setCreateStorePlan("pro");
    setCreateStoreError("");
    setCreateStoreSuccess(null);
  };

  const openStoreInspector = async (org: OrganizationProfitability) => {
    setInspectStoreId(org.id);
    setInspectDetails(null);
    setInspectError("");
    setSubPlanCode(org.plan && org.plan !== "None" ? org.plan.toLowerCase() : "start");
    setSubStatus(org.subscription_status && org.subscription_status !== "inactive" ? org.subscription_status : "active");
    setSubCycle("monthly");
    setSubExtendDays(0);

    if (!onInspectStore) return;
    setInspectLoading(true);
    try {
      const data = await onInspectStore(org.id);
      setInspectDetails(data);
      if (data?.subscription?.plan_code && data.subscription.plan_code !== "NONE") {
        setSubPlanCode(String(data.subscription.plan_code).toLowerCase());
      }
      if (data?.subscription?.status && data.subscription.status !== "inactive") {
        setSubStatus(String(data.subscription.status));
      }
      if (data?.subscription?.billing_cycle) {
        setSubCycle(String(data.subscription.billing_cycle));
      }
    } catch (err: any) {
      setInspectError(err?.message || "Do'kon ma'lumotlarini yuklashda xatolik");
    } finally {
      setInspectLoading(false);
    }
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectStoreId || !onUpdateStoreSubscription) return;
    setSubSaving(true);
    setInspectError("");
    try {
      await onUpdateStoreSubscription(inspectStoreId, {
        plan_code: subPlanCode,
        status: subStatus,
        billing_cycle: subCycle,
        extend_days: subExtendDays,
      });
      if (onInspectStore) {
        const refreshed = await onInspectStore(inspectStoreId);
        setInspectDetails(refreshed);
      }
      setSubExtendDays(0);
    } catch (err: any) {
      setInspectError(err?.message || "Obunani yangilashda xatolik");
    } finally {
      setSubSaving(false);
    }
  };

  const handleTriggerDailyReport = async () => {
    if (!onSendDailyReport) return;
    setReportBusy(true);
    try {
      const data = await onSendDailyReport();
      setReportData(data);
      setShowReportModal(true);
    } finally {
      setReportBusy(false);
    }
  };

  const handlePreviewBroadcast = async () => {
    if (!onSendBroadcast) return;
    setBroadcastError("");
    setBroadcastBusy(true);
    try {
      const res = await onSendBroadcast({
        audience: broadcastAudience,
        message: broadcastMessage.trim() || "Tekshiruv xabari",
        dry_run: true,
      });
      setBroadcastPreviewCount(res?.recipient_count ?? 0);
    } catch (err: any) {
      setBroadcastError(err?.message || "Qabul qiluvchilarni hisoblashda xatolik");
    } finally {
      setBroadcastBusy(false);
    }
  };

  const handleSubmitBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSendBroadcast) return;
    if (broadcastMessage.trim().length < 5) {
      setBroadcastError("Xabar kamida 5 ta belgidan iborat bo'lishi kerak");
      return;
    }
    setBroadcastError("");
    setBroadcastBusy(true);
    try {
      const res = await onSendBroadcast({
        audience: broadcastAudience,
        message: broadcastMessage.trim(),
        dry_run: false,
      });
      setBroadcastResult(res);
    } catch (err: any) {
      setBroadcastError(err?.message || "E'lon yuborishda xatolik");
    } finally {
      setBroadcastBusy(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createStoreName.trim()) {
      setCreateStoreError("Do'kon nomi kiritilishi shart");
      return;
    }
    if (!createStoreSlug.trim()) {
      setCreateStoreError("Do'kon qisqa nomi (slug) kiritilishi shart");
      return;
    }
    if (!createStoreEmail.trim()) {
      setCreateStoreError("Do'kon egasi pochtasi kiritilishi shart");
      return;
    }
    setCreateStoreBusy(true);
    setCreateStoreError("");
    try {
      if (onCreateStore) {
        const res = await onCreateStore({
          name: createStoreName.trim(),
          slug: createStoreSlug.trim().toLowerCase(),
          category: createStoreCategory,
          owner_email: createStoreEmail.trim().toLowerCase(),
          owner_password: createStorePassword || undefined,
          telegram_bot_token: createStoreBotToken.trim() || undefined,
          currency: createStoreCurrency,
          plan_code: createStorePlan,
        });
        setCreateStoreSuccess(res);
      }
    } catch (err: any) {
      setCreateStoreError(err.message || "Do'kon ochishda xatolik yuz berdi");
    } finally {
      setCreateStoreBusy(false);
    }
  };

  const filteredOrgs = useMemo(() => {
    const list = organizations.filter((o) => {
      const matchesSearch =
        o.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
        o.slug.toLowerCase().includes(storeSearch.toLowerCase());
      if (!matchesSearch) return false;
      const orgStatus = (o.status || "active").toLowerCase();
      if (storeStatusFilter === "active" && orgStatus !== "active") return false;
      if (storeStatusFilter === "suspended" && orgStatus === "active") return false;
      if (storePlanFilter !== "all" && (o.plan || "").toLowerCase() !== storePlanFilter) return false;
      return true;
    });

    if (storeSort === "revenue") {
      return [...list].sort((a, b) => (b.monthly_revenue_usd || 0) - (a.monthly_revenue_usd || 0));
    }
    if (storeSort === "cost") {
      return [...list].sort((a, b) => (b.monthly_ai_cost_usd || 0) - (a.monthly_ai_cost_usd || 0));
    }
    if (storeSort === "conversations") {
      return [...list].sort((a, b) => (b.conversations_count || 0) - (a.conversations_count || 0));
    }
    return list;
  }, [organizations, storeSearch, storeStatusFilter, storePlanFilter, storeSort]);

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.organization_names && u.organization_names.some((n) => n.toLowerCase().includes(userSearch.toLowerCase())));
      if (!matchesSearch) return false;
      if (userRoleFilter === "admins") return Boolean(u.is_platform_owner || u.is_platform_admin);
      if (userRoleFilter === "owners") return !u.is_platform_owner && !u.is_platform_admin;
      if (userRoleFilter === "telegram") return Boolean(u.telegram_user_id);
      if (userRoleFilter === "suspended") return !u.is_active;
      return true;
    });
  }, [usersList, userSearch, userRoleFilter]);

  const auditActions = Array.from(new Set(auditLogs.map((l) => l.action).filter(Boolean)));
  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditActionFilter !== "all" && log.action !== auditActionFilter) return false;
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.resource.toLowerCase().includes(q) ||
      (log.resource_id && log.resource_id.toLowerCase().includes(q)) ||
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(q))
    );
  });

  const botConnectedCount = organizations.filter((o) => Boolean(o.bot_configured)).length;
  const suspendedCount = organizations.filter((o) => (o.status || "active").toLowerCase() !== "active").length;
  const telegramUsersCount = usersList.filter((u) => Boolean(u.telegram_user_id)).length;

  const navTabs: Array<{ id: PlatformSubTab; label: string; badge?: number | string }> = [
    { id: "overview", label: "Umumiy" },
    { id: "stores", label: "Do'konlar", badge: organizations.length },
    { id: "users", label: "Foydalanuvchilar", badge: usersList.length },
    { id: "plans", label: "Tariflar & Narxlar" },
    { id: "usage", label: "AI Xarajati" },
    { id: "payment-testing", label: "Payment Testing" },
    { id: "system", label: "Tizim Holati" },
    { id: "audit", label: "Audit Loglar", badge: auditLogs.length },
  ];

  const storeChartData = useMemo(() => {
    return [...organizations]
      .sort((a, b) => (b.monthly_revenue_usd + b.monthly_ai_cost_usd) - (a.monthly_revenue_usd + a.monthly_ai_cost_usd))
      .slice(0, 6)
      .map((o) => ({
        label: o.slug.slice(0, 9),
        primary: Number((o.monthly_revenue_usd || 0).toFixed(2)),
        secondary: Number((o.monthly_ai_cost_usd || 0).toFixed(2)),
      }));
  }, [organizations]);

  const exportStoresCsv = () => {
    downloadCsvFile(
      `selloi-dokonlar-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Nomi", "Slug", "Soha", "Holat", "Tarif", "Obuna Holati", "Bot Ulangan", "Suhbatlar", "Oylik Daromad ($)", "AI Xarajati ($)", "Marja (%)"],
      filteredOrgs.map((o) => [
        o.id,
        o.name,
        o.slug,
        o.category || "Retail",
        o.status || "active",
        o.plan,
        o.subscription_status,
        o.bot_configured ? "Ha" : "Yo'q",
        o.conversations_count ?? 0,
        o.monthly_revenue_usd,
        o.monthly_ai_cost_usd,
        o.gross_margin_percent,
      ])
    );
  };

  const exportUsersCsv = () => {
    downloadCsvFile(
      `selloi-foydalanuvchilar-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Ism", "Email", "Telegram ID", "Roli", "Holati", "Do'konlari", "Ro'yxatdan o'tgan"],
      filteredUsers.map((u) => [
        u.id,
        u.full_name || "",
        u.email,
        u.telegram_user_id || "",
        u.is_platform_owner ? "Owner" : u.is_platform_admin ? "Sayt Admini" : "Do'kon egasi",
        u.is_active ? "Faol" : "Bloklangan",
        (u.organization_names || []).join("; "),
        u.created_at || "",
      ])
    );
  };

  const exportAuditCsv = () => {
    downloadCsvFile(
      `selloi-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Vaqt", "Tashkilot ID", "Harakat", "Resurs", "Resurs ID", "Tafsilotlar"],
      filteredAuditLogs.map((l) => [
        l.id,
        l.created_at || "",
        l.organization_id ?? "",
        l.action,
        l.resource,
        l.resource_id ?? "",
        l.metadata ? JSON.stringify(l.metadata) : "",
      ])
    );
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Upgraded Platform Admin Command Center Header */}
      <div
        className="linear-card-elevated p-3.5"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 76, 99, 0.08) 0%, rgba(131, 174, 234, 0.05) 55%, var(--bg-surface) 100%)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
              style={{
                width: "46px",
                height: "46px",
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <IconCrown size={22} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="fw-bold mb-0 text-primary" style={{ fontSize: "1.18rem", letterSpacing: "-0.015em" }}>
                  {isCurrentUserOwner ? "Sayt Egasi Boshqaruv Markazi" : "Sayt Admini Boshqaruv Markazi"}
                </h2>
                <Badge variant="accent">
                  {isCurrentUserOwner ? "Platform Owner" : "Sayt Admini"}
                </Badge>
                <Badge variant="default">
                  {(metrics?.total_organizations ?? organizations.length) || 0} ta do&apos;kon
                </Badge>
                <span
                  onClick={() => onSwitchSubTab?.("system")}
                  style={{ cursor: onSwitchSubTab ? "pointer" : "default" }}
                >
                  <Badge variant={systemHealth?.status === "ok" ? "success" : "warning"} dot>
                    {systemHealth?.status === "ok" ? "Tizim Faol" : "Holatni tekshirish"}
                  </Badge>
                </span>
              </div>
              <p className="text-secondary small mb-0 mt-1">
                Do&apos;konlar portfeli, obuna boshqaruvi, AI iqtisodiyoti, foydalanuvchilar va jonli xavfsizlik auditi.
              </p>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<IconRefresh size={14} />}
              onClick={onRefresh}
              disabled={loading}
            >
              Yangilash
            </Button>
            {onSendDailyReport && (
              <Button
                variant="secondary"
                size="sm"
                icon={<IconSend size={14} />}
                onClick={handleTriggerDailyReport}
                disabled={reportBusy}
              >
                {reportBusy ? "Tayyorlanmoqda..." : "Telegram Hisobot"}
              </Button>
            )}
            {isCurrentUserOwner && onSendBroadcast && (
              <Button
                variant="secondary"
                size="sm"
                icon={<IconBellRinging size={14} />}
                onClick={() => {
                  setBroadcastError("");
                  setBroadcastResult(null);
                  setBroadcastPreviewCount(null);
                  setShowBroadcastModal(true);
                }}
              >
                E&apos;lon Yuborish
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={15} />}
              onClick={() => {
                resetCreateForm();
                setShowCreateModal(true);
              }}
            >
              Yangi Do&apos;kon
            </Button>
          </div>
        </div>

        {/* Quick Sub-Tab Pill Bar inside Admin Panel */}
        {onSwitchSubTab && (
          <div
            className="d-flex align-items-center gap-1.5 flex-wrap mt-3 pt-3 border-top"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {navTabs.map((item) => {
              const active = subTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSwitchSubTab(item.id)}
                  className={`linear-btn py-1.5 px-2.5 d-inline-flex align-items-center gap-1.5 ${
                    active ? "linear-btn-primary" : "linear-btn-ghost"
                  }`}
                  style={{ fontSize: "0.78rem" }}
                >
                  <span>{item.label}</span>
                  {typeof item.badge === "number" && (
                    <span
                      className="font-monospace px-1.5 rounded-pill"
                      style={{
                        fontSize: "0.68rem",
                        backgroundColor: active ? "rgba(255,255,255,0.22)" : "var(--bg-surface-elevated)",
                        color: active ? "#fff" : "var(--text-secondary)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SUBTAB: OVERVIEW */}
      {subTab === "overview" && (
        <div className="d-flex flex-column gap-4">
          {/* Top 4 Financial KPI Cards */}
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between" style={{ borderTop: "2px solid var(--success)" }}>
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                      Oylik Daromad (MRR)
                    </span>
                    <Badge variant="success">Real-time</Badge>
                  </div>
                  {loading ? (
                    <div className="skeleton-shimmer skeleton-title w-50 mb-1 mt-1" style={{ height: "28px" }} />
                  ) : (
                    <div className="fs-2 fw-bold font-monospace mb-1" style={{ color: "var(--success-text)" }}>
                      ${metrics?.mrr_usd?.toFixed(2) || "0.00"}
                    </div>
                  )}
                </div>
                <div className="text-secondary small mt-2 pt-2 border-top d-flex justify-content-between" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  <span>Yillik (ARR):</span>
                  <strong className="text-primary font-monospace">${metrics?.arr_usd?.toFixed(2) || "0.00"}</strong>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between" style={{ borderTop: "2px solid var(--accent)" }}>
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                      Yalpi Foyda Marjasi
                    </span>
                    <Badge variant="accent">Margin</Badge>
                  </div>
                  {loading ? (
                    <div className="skeleton-shimmer skeleton-title w-50 mb-1 mt-1" style={{ height: "28px" }} />
                  ) : (
                    <div className="fs-2 fw-bold font-monospace mb-1 text-primary d-flex align-items-center gap-2">
                      <span>{metrics?.gross_margin_percent?.toFixed(1) || "100"}%</span>
                      <IconTrendingUp size={18} style={{ color: "var(--success)" }} />
                    </div>
                  )}
                </div>
                <div className="text-secondary small mt-2 pt-2 border-top d-flex justify-content-between" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  <span>ARPU / mijoz:</span>
                  <strong className="font-monospace" style={{ color: "var(--info-text)" }}>${metrics?.arpu_usd?.toFixed(2) || "0.00"}</strong>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between" style={{ borderTop: "2px solid var(--warning)" }}>
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                      Jami AI Xarajati
                    </span>
                    <Badge variant="warning">LLM</Badge>
                  </div>
                  {loading ? (
                    <div className="skeleton-shimmer skeleton-title w-50 mb-1 mt-1" style={{ height: "28px" }} />
                  ) : (
                    <div className="fs-2 fw-bold font-monospace mb-1" style={{ color: "var(--warning-text)" }}>
                      ${metrics?.total_ai_cost_usd?.toFixed(2) || "0.00"}
                    </div>
                  )}
                </div>
                <div className="text-secondary small mt-2 pt-2 border-top d-flex justify-content-between" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  <span>Bu oy xabarlar:</span>
                  <strong className="text-primary font-monospace">{metrics?.total_ai_messages_this_month?.toLocaleString() || "0"} ta</strong>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between" style={{ borderTop: "2px solid var(--info)" }}>
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                      Do&apos;konlar &amp; Egalari
                    </span>
                    <Badge variant="info">Tenants</Badge>
                  </div>
                  {loading ? (
                    <div className="skeleton-shimmer skeleton-title w-50 mb-1 mt-1" style={{ height: "28px" }} />
                  ) : (
                    <div className="fs-2 fw-bold font-monospace mb-1 text-primary">
                      {(metrics?.total_organizations ?? organizations.length) || 0}{" "}
                      <span className="text-secondary small fs-6 fw-normal">do&apos;kon / {usersList.length} user</span>
                    </div>
                  )}
                </div>
                <div className="text-secondary small mt-2 pt-2 border-top d-flex justify-content-between" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  <span>Faol: <strong style={{ color: "var(--success-text)" }}>{metrics?.active_subscriptions ?? 0}</strong></span>
                  <span>Sinov: <strong style={{ color: "var(--info-text)" }}>{metrics?.trial_organizations ?? 0}</strong></span>
                  <span>To&apos;xtatilgan: <strong style={{ color: "var(--warning-text)" }}>{suspendedCount}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Revenue vs AI Cost Bar Chart + Plan Donut */}
          <div className="row g-3">
            <div className="col-12 col-lg-7">
              <Card className="h-100">
                <CardHeader
                  actions={
                    <Badge variant="default" className="d-inline-flex align-items-center gap-1">
                      <IconChartBar size={12} />
                      <span>Top {storeChartData.length} do&apos;kon</span>
                    </Badge>
                  }
                >
                  <CardTitle>Do&apos;konlar Daromadi va AI Xarajati ($)</CardTitle>
                </CardHeader>
                <CardContent>
                  {storeChartData.length > 0 ? (
                    <ActivityBarsChart
                      data={storeChartData}
                      primaryLabel="Daromad ($)"
                      secondaryLabel="AI Xarajat ($)"
                      primaryColor="var(--success, #A0CA92)"
                      secondaryColor="var(--warning, #E8B66A)"
                      height={185}
                    />
                  ) : (
                    <div className="text-center py-5 text-secondary small">
                      Grafik uchun do&apos;kon ma&apos;lumotlari yetarli emas.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="col-12 col-lg-5">
              <Card className="h-100">
                <CardHeader actions={<Badge variant="accent">{botConnectedCount}/{organizations.length} bot</Badge>}>
                  <CardTitle>Tariflar &amp; Ulanish Taqsimoti</CardTitle>
                </CardHeader>
                <CardContent className="d-flex flex-column justify-content-between gap-3">
                  {(() => {
                    const dist = metrics?.plan_distribution || {};
                    const planKeys = Array.from(new Set(["start", "pro", "ultra", ...Object.keys(dist).map((k) => k.toLowerCase())]));
                    const segments = planKeys.map((plan) => {
                      const count =
                        typeof dist[plan] === "number"
                          ? dist[plan]
                          : organizations.filter((o) => o.plan.toLowerCase() === plan).length;
                      return {
                        label: plan.toUpperCase(),
                        value: count,
                        color:
                          plan === "ultra"
                            ? "var(--accent, #FF4C63)"
                            : plan === "pro"
                            ? "var(--info, #83AEEA)"
                            : plan === "standard"
                            ? "var(--warning, #E8B66A)"
                            : "var(--success, #A0CA92)",
                      };
                    });
                    const total = segments.reduce((a, b) => a + b.value, 0);
                    return (
                      <DonutChart
                        segments={segments}
                        centerValue={total}
                        centerLabel="ta obuna"
                        size={140}
                        strokeWidth={15}
                      />
                    );
                  })()}
                  <div className="d-flex flex-wrap gap-2 pt-2 border-top" style={{ borderColor: "var(--border-subtle)" }}>
                    <Badge variant="info" className="d-inline-flex align-items-center gap-1">
                      <IconBrandTelegram size={12} />
                      <span>{telegramUsersCount} ta Telegram ulangan user</span>
                    </Badge>
                    <Badge variant="success">{botConnectedCount} ta faol do&apos;kon boti</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Stores Overview + Recent System & Audit Feed */}
          <div className="row g-3">
            <div className="col-12 col-lg-7">
              <Card className="h-100">
                <CardHeader
                  actions={
                    onSwitchSubTab && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconArrowRight size={14} />}
                        onClick={() => onSwitchSubTab("stores")}
                      >
                        Barcha do&apos;konlar
                      </Button>
                    )
                  }
                >
                  <CardTitle>Eng Faol Do&apos;konlar</CardTitle>
                </CardHeader>
                <div className="table-responsive">
                  <table className="linear-table">
                    <thead>
                      <tr>
                        <th>Do&apos;kon</th>
                        <th>Tarif</th>
                        <th>Bot</th>
                        <th>Daromad</th>
                        <th className="text-end">Amal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        [...Array(4)].map((_, idx) => (
                          <tr key={`skel-store-${idx}`}>
                            <td><div className="skeleton-shimmer skeleton-text w-75" style={{ height: "14px" }} /></td>
                            <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "18px" }} /></td>
                            <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                            <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                            <td className="text-end"><div className="skeleton-shimmer skeleton-text ms-auto" style={{ width: "90px", height: "28px" }} /></td>
                          </tr>
                        ))
                      ) : organizations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-secondary">
                            Hozircha faol do&apos;konlar mavjud emas.
                          </td>
                        </tr>
                      ) : (
                        organizations.slice(0, 5).map((org) => (
                          <tr key={org.id}>
                            <td>
                              <div className="fw-semibold text-primary">{org.name}</div>
                              <div className="text-secondary small font-monospace" style={{ fontSize: "0.72rem" }}>
                                {org.slug}
                              </div>
                            </td>
                            <td>
                              <Badge variant="accent">{org.plan.toUpperCase()}</Badge>
                            </td>
                            <td>
                              <Badge variant={org.bot_configured ? "success" : "default"} dot>
                                {org.bot_configured ? "Ulangan" : "Yo'q"}
                              </Badge>
                            </td>
                            <td className="font-monospace fw-bold" style={{ color: "var(--success-text)" }}>
                              ${org.monthly_revenue_usd}
                            </td>
                            <td className="text-end">
                              <div className="d-flex align-items-center justify-content-end gap-1.5">
                                {onInspectStore && (
                                  <button
                                    type="button"
                                    className="linear-btn linear-btn-secondary py-1 px-2"
                                    onClick={() => openStoreInspector(org)}
                                    title="Batafsil va obunani boshqarish"
                                  >
                                    <IconEye size={14} />
                                  </button>
                                )}
                                {onEnterStore && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    icon={<IconArrowRight size={14} />}
                                    onClick={() => onEnterStore(org)}
                                  >
                                    Kirish
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="col-12 col-lg-5">
              <Card className="h-100">
                <CardHeader
                  actions={
                    onSwitchSubTab && (
                      <Button variant="ghost" size="sm" onClick={() => onSwitchSubTab("audit")}>
                        Barchasi
                      </Button>
                    )
                  }
                >
                  <CardTitle>Tizim va Oxirgi Audit Voqealari</CardTitle>
                </CardHeader>
                <CardContent className="d-flex flex-column gap-3">
                  <div className="d-flex flex-wrap gap-1.5">
                    <Badge variant={systemHealth?.database === "healthy" ? "success" : "danger"} dot>
                      DB
                    </Badge>
                    <Badge variant={systemHealth?.redis === "healthy" ? "success" : "warning"} dot>
                      Redis
                    </Badge>
                    <Badge variant={systemHealth?.gemini_configured ? "success" : "danger"} dot>
                      Gemini
                    </Badge>
                    <Badge variant={systemHealth?.telegram_configured ? "success" : "warning"} dot>
                      Telegram Bot
                    </Badge>
                    <Badge variant={systemHealth?.tezcheck_configured ? "success" : "warning"} dot>
                      TezCheck
                    </Badge>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {auditLogs.slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="p-2 rounded-2 d-flex align-items-center justify-content-between gap-2"
                        style={{
                          backgroundColor: "var(--bg-canvas)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div className="min-w-0 d-flex align-items-center gap-2">
                          <Badge variant={getAuditActionVariant(log.action)}>{log.action}</Badge>
                          <span className="small text-secondary text-truncate">
                            {log.resource}
                            {log.resource_id ? ` #${log.resource_id}` : ""}
                          </span>
                        </div>
                        <span className="font-monospace text-tertiary flex-shrink-0" style={{ fontSize: "0.7rem" }}>
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <div className="text-secondary small text-center py-3">
                        Hozircha audit yozuvlari yo&apos;q.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: STORES */}
      {subTab === "stores" && (
        <Card>
          <CardHeader
            actions={
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div style={{ minWidth: "180px" }}>
                  <input
                    type="text"
                    className="linear-input"
                    placeholder="Do'kon nomi yoki slug..."
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                  />
                </div>
                <select
                  className="linear-input"
                  style={{ width: "auto", minWidth: "125px" }}
                  value={storeStatusFilter}
                  onChange={(e) => setStoreStatusFilter(e.target.value as any)}
                >
                  <option value="all">Barcha holatlar</option>
                  <option value="active">Faol</option>
                  <option value="suspended">To&apos;xtatilgan</option>
                </select>
                <select
                  className="linear-input"
                  style={{ width: "auto", minWidth: "115px" }}
                  value={storePlanFilter}
                  onChange={(e) => setStorePlanFilter(e.target.value)}
                >
                  <option value="all">Barcha tariflar</option>
                  <option value="start">START</option>
                  <option value="pro">PRO</option>
                  <option value="ultra">ULTRA</option>
                </select>
                <select
                  className="linear-input"
                  style={{ width: "auto", minWidth: "130px" }}
                  value={storeSort}
                  onChange={(e) => setStoreSort(e.target.value as any)}
                >
                  <option value="newest">Eng yangi</option>
                  <option value="revenue">Daromad yuqori</option>
                  <option value="cost">AI xarajat yuqori</option>
                  <option value="conversations">Suhbat ko&apos;p</option>
                </select>
                <Button variant="secondary" size="sm" icon={<IconDownload size={14} />} onClick={exportStoresCsv}>
                  CSV
                </Button>
                <Badge variant="accent">{filteredOrgs.length} ta</Badge>
              </div>
            }
          >
            <CardTitle>Barcha Do&apos;konlar (Tenants Portfolio)</CardTitle>
          </CardHeader>
          {!loading && filteredOrgs.length === 0 ? (
            <EmptyState
              icon={<IconBuildingSkyscraper size={32} />}
              title="Mos keluvchi do'kon topilmadi"
              description="Qidiruv so'zi yoki filtrni o'zgartiring yoxud yangi do'kon oching."
            />
          ) : (
            <>
              <div className="d-none d-md-block table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th>Do&apos;kon Nomi</th>
                      <th>Holat &amp; Bot</th>
                      <th>Tarif / Obuna</th>
                      <th>Suhbatlar</th>
                      <th>Oylik Daromad</th>
                      <th>AI Xarajati</th>
                      <th>Marja</th>
                      <th className="text-end">Harakatlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(5)].map((_, idx) => (
                        <tr key={`skel-store-full-${idx}`}>
                          <td>
                            <div className="skeleton-shimmer skeleton-text w-75 mb-1" style={{ height: "14px" }} />
                            <div className="skeleton-shimmer skeleton-text w-50" style={{ height: "10px" }} />
                          </td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "18px", borderRadius: "10px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "18px", borderRadius: "10px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "12px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                          <td className="text-end">
                            <div className="skeleton-shimmer skeleton-text ms-auto" style={{ width: "130px", height: "30px", borderRadius: "6px" }} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      filteredOrgs.map((org) => {
                        const orgStatus = (org.status || "active").toLowerCase();
                        const isOrgActive = orgStatus === "active";
                        return (
                          <tr key={org.id}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    backgroundColor: "var(--accent-subtle)",
                                    color: "var(--accent-text)",
                                  }}
                                >
                                  <IconBuildingSkyscraper size={16} />
                                </div>
                                <div>
                                  <div className="fw-semibold text-primary">{org.name}</div>
                                  <div className="text-secondary small font-monospace" style={{ fontSize: "0.72rem" }}>
                                    #{org.id} • {org.slug} • {org.category || "Retail"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                <Badge variant={isOrgActive ? "success" : "warning"} dot>
                                  {isOrgActive ? "Faol" : orgStatus === "suspended" ? "To'xtatilgan" : orgStatus}
                                </Badge>
                                <Badge variant={org.bot_configured ? "info" : "default"}>
                                  {org.bot_configured ? "Bot ✓" : "Bot yo'q"}
                                </Badge>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                <Badge variant="accent">{org.plan.toUpperCase()}</Badge>
                                <Badge
                                  variant={
                                    org.subscription_status === "active" || org.subscription_status === "subscription_active"
                                      ? "success"
                                      : org.subscription_status === "trialing"
                                      ? "info"
                                      : "default"
                                  }
                                >
                                  {org.subscription_status}
                                </Badge>
                              </div>
                            </td>
                            <td className="font-monospace text-secondary small">
                              {org.conversations_count ?? 0} ta
                            </td>
                            <td className="font-monospace fw-bold" style={{ color: "var(--success-text)" }}>
                              ${org.monthly_revenue_usd}
                            </td>
                            <td className="font-monospace" style={{ color: "var(--warning-text)" }}>
                              ${org.monthly_ai_cost_usd}
                            </td>
                            <td className="font-monospace fw-semibold text-primary small">
                              {org.gross_margin_percent}%
                            </td>
                            <td className="text-end">
                              <div className="d-flex align-items-center justify-content-end gap-1.5">
                                {onInspectStore && (
                                  <button
                                    type="button"
                                    className="linear-btn linear-btn-secondary py-1 px-2 d-inline-flex align-items-center gap-1"
                                    onClick={() => openStoreInspector(org)}
                                    title="Do'kon tafsilotlari va obunani boshqarish"
                                    style={{ fontSize: "0.75rem" }}
                                  >
                                    <IconEye size={14} />
                                    <span>Obuna</span>
                                  </button>
                                )}
                                {onEnterStore && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    icon={<IconArrowRight size={14} />}
                                    onClick={() => onEnterStore(org)}
                                    title="Do'kon ichiga kirish"
                                  >
                                    Kirish
                                  </Button>
                                )}
                                {onUpdateStoreStatus && org.id !== 1 && (
                                  <button
                                    type="button"
                                    className="linear-btn linear-btn-secondary py-1 px-2"
                                    onClick={() =>
                                      onUpdateStoreStatus(
                                        org.id,
                                        isOrgActive ? "suspended" : "active"
                                      )
                                    }
                                    title={
                                      isOrgActive
                                        ? "Do'konni vaqtincha to'xtatish"
                                        : "Do'konni faollashtirish"
                                    }
                                  >
                                    {isOrgActive ? (
                                      <IconPlayerPause size={14} style={{ color: "var(--warning)" }} />
                                    ) : (
                                      <IconPlayerPlay size={14} style={{ color: "var(--success)" }} />
                                    )}
                                  </button>
                                )}
                                {onDeleteStore && org.id !== 1 && (
                                  <button
                                    type="button"
                                    className="linear-btn linear-btn-danger py-1 px-2"
                                    onClick={() => onDeleteStore(org.id)}
                                    title="Do'konni o'chirish"
                                  >
                                    <IconTrash size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Store Cards */}
              <div className="d-md-none d-flex flex-column">
                {loading
                  ? [...Array(4)].map((_, idx) => (
                      <div key={`skel-mob-org-${idx}`} className="p-3 border-bottom border-subtle space-y-2">
                        <div className="skeleton-shimmer skeleton-text w-50" style={{ height: 14 }} />
                        <div className="skeleton-shimmer skeleton-text w-75" style={{ height: 12 }} />
                      </div>
                    ))
                  : filteredOrgs.map((org) => {
                      const orgStatus = (org.status || "active").toLowerCase();
                      const isOrgActive = orgStatus === "active";
                      return (
                        <div key={`mob-org-${org.id}`} className="p-3 border-bottom border-subtle d-flex flex-column gap-2">
                          <div className="d-flex align-items-start justify-content-between gap-2">
                            <div className="min-w-0">
                              <div className="fw-semibold text-primary text-truncate">{org.name}</div>
                              <div className="text-secondary small font-monospace" style={{ fontSize: "0.72rem" }}>
                                #{org.id} • {org.slug}
                              </div>
                            </div>
                            <Badge variant={isOrgActive ? "success" : "warning"} dot>
                              {isOrgActive ? "Faol" : orgStatus === "suspended" ? "To'xtatilgan" : orgStatus}
                            </Badge>
                          </div>
                          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                            <div className="d-flex align-items-center gap-1.5">
                              <Badge variant="accent">{org.plan.toUpperCase()}</Badge>
                              <span className="font-monospace small fw-bold" style={{ color: "var(--success-text)" }}>
                                ${org.monthly_revenue_usd}
                              </span>
                              <span className="text-secondary small font-monospace">
                                / {org.gross_margin_percent}%
                              </span>
                            </div>
                            <div className="d-flex align-items-center gap-1.5">
                              {onInspectStore && (
                                <button
                                  type="button"
                                  className="linear-btn linear-btn-secondary py-1 px-2"
                                  onClick={() => openStoreInspector(org)}
                                  aria-label="Batafsil"
                                >
                                  <IconEye size={13} />
                                </button>
                              )}
                              {onEnterStore && (
                                <Button variant="primary" size="xs" icon={<IconArrowRight size={13} />} onClick={() => onEnterStore(org)}>
                                  Kirish
                                </Button>
                              )}
                              {onUpdateStoreStatus && org.id !== 1 && (
                                <button
                                  type="button"
                                  className="linear-btn linear-btn-secondary py-1 px-2"
                                  onClick={() => onUpdateStoreStatus(org.id, isOrgActive ? "suspended" : "active")}
                                  aria-label={isOrgActive ? "To'xtatish" : "Faollashtirish"}
                                >
                                  {isOrgActive ? (
                                    <IconPlayerPause size={13} style={{ color: "var(--warning)" }} />
                                  ) : (
                                    <IconPlayerPlay size={13} style={{ color: "var(--success)" }} />
                                  )}
                                </button>
                              )}
                              {onDeleteStore && org.id !== 1 && (
                                <button
                                  type="button"
                                  className="linear-btn linear-btn-danger py-1 px-2"
                                  onClick={() => onDeleteStore(org.id)}
                                  aria-label="O'chirish"
                                >
                                  <IconTrash size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </>
          )}
        </Card>
      )}

      {/* SUBTAB: USERS & SITE ADMINS */}
      {subTab === "users" && (
        <div className="d-flex flex-column gap-3">
          {isCurrentUserOwner && onAppointSiteAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Sayt Adminini Tayinlash (Faqat Owner)</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="row g-2 align-items-end"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newAdminEmail.trim()) return;
                    setAdminActionBusy(true);
                    try {
                      await onAppointSiteAdmin(newAdminEmail.trim(), newAdminName.trim());
                      setNewAdminEmail("");
                      setNewAdminName("");
                    } catch {
                      // Error handled by parent toast
                    } finally {
                      setAdminActionBusy(false);
                    }
                  }}
                >
                  <div className="col-12 col-md-5">
                    <label className="text-secondary small fw-medium mb-1 d-block">
                      Email manzil (Google yoki oddiy kirish uchun) *
                    </label>
                    <input
                      type="email"
                      className="linear-input"
                      placeholder="admin@gmail.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="text-secondary small fw-medium mb-1 d-block">
                      To&apos;liq ismi (ixtiyoriy)
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="Masalan: Sardor"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={adminActionBusy}
                      icon={<IconShieldLock size={15} />}
                      className="w-100"
                    >
                      {adminActionBusy ? "Saqlanmoqda..." : "Admin tayinlash"}
                    </Button>
                  </div>
                </form>
                <div className="text-secondary small mt-2">
                  Faqat siz (Sayt egasi) tayinlagan odamlar <code>/admin</code> paneliga kira oladi (yangi email bo&apos;lsa Google orqali kiradi). Oddiy do&apos;kon egalari faqat <code>/dashboard</code> ga kiradi.
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader
              actions={
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div style={{ minWidth: "200px" }}>
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="Email, ism yoki do'kon..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="linear-input"
                    style={{ width: "auto", minWidth: "155px" }}
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value as any)}
                  >
                    <option value="all">Barcha foydalanuvchilar</option>
                    <option value="admins">Sayt Adminlari</option>
                    <option value="owners">Do&apos;kon Egalari</option>
                    <option value="telegram">Telegram ulanganlar</option>
                    <option value="suspended">Bloklanganlar</option>
                  </select>
                  <Button variant="secondary" size="sm" icon={<IconDownload size={14} />} onClick={exportUsersCsv}>
                    CSV
                  </Button>
                  <Badge variant="accent">{filteredUsers.length} ta</Badge>
                </div>
              }
            >
              <CardTitle>Sayt Adminlari va Do&apos;kon Egalari</CardTitle>
            </CardHeader>
            <div className="table-responsive">
              <table className="linear-table">
                <thead>
                  <tr>
                    <th>Foydalanuvchi</th>
                    <th>Do&apos;konlari</th>
                    <th>Telegram ID</th>
                    <th>Roli</th>
                    <th>Holati</th>
                    <th>Ro&apos;yxatdan o&apos;tgan</th>
                    {isCurrentUserOwner && <th className="text-end">Boshqaruv</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="fw-semibold text-primary">{u.full_name || u.email}</div>
                        <div className="text-secondary small font-monospace" style={{ fontSize: "0.75rem" }}>
                          {u.email}
                        </div>
                      </td>
                      <td>
                        {u.organization_names && u.organization_names.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1">
                            {u.organization_names.slice(0, 2).map((orgName) => (
                              <Badge key={orgName} variant="default">{orgName}</Badge>
                            ))}
                            {u.organization_names.length > 2 && (
                              <Badge variant="info">+{u.organization_names.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-tertiary small">-</span>
                        )}
                      </td>
                      <td className="font-monospace text-secondary small">
                        {u.telegram_user_id ? String(u.telegram_user_id) : "-"}
                      </td>
                      <td>
                        {u.is_platform_owner ? (
                          <Badge variant="accent">Sayt egasi (Owner)</Badge>
                        ) : u.is_platform_admin ? (
                          <Badge variant="info">Sayt Admini</Badge>
                        ) : (
                          <Badge variant="default">Do&apos;kon egasi</Badge>
                        )}
                      </td>
                      <td>
                        <Badge variant={u.is_active ? "success" : "danger"} dot>
                          {u.is_active ? "Faol" : "Bloklangan"}
                        </Badge>
                      </td>
                      <td className="text-secondary small font-monospace">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                      </td>
                      {isCurrentUserOwner && (
                        <td className="text-end">
                          {!u.is_platform_owner ? (
                            <div className="d-flex align-items-center justify-content-end gap-1.5">
                              {onToggleSiteAdmin && (
                                <Button
                                  variant={u.is_platform_admin ? "secondary" : "primary"}
                                  size="sm"
                                  disabled={adminActionBusy}
                                  onClick={async () => {
                                    setAdminActionBusy(true);
                                    try {
                                      await onToggleSiteAdmin(u.id, !u.is_platform_admin);
                                    } finally {
                                      setAdminActionBusy(false);
                                    }
                                  }}
                                >
                                  {u.is_platform_admin ? "Adminlikdan olish" : "Sayt admini qilish"}
                                </Button>
                              )}
                              {onToggleUserStatus && (
                                <button
                                  type="button"
                                  className={`linear-btn py-1 px-2 ${u.is_active ? "linear-btn-danger" : "linear-btn-secondary"}`}
                                  disabled={adminActionBusy}
                                  title={u.is_active ? "Foydalanuvchini bloklash" : "Foydalanuvchini faollashtirish"}
                                  onClick={async () => {
                                    setAdminActionBusy(true);
                                    try {
                                      await onToggleUserStatus(u.id, !u.is_active);
                                    } finally {
                                      setAdminActionBusy(false);
                                    }
                                  }}
                                >
                                  {u.is_active ? (
                                    <IconUserOff size={14} />
                                  ) : (
                                    <IconUserCheck size={14} style={{ color: "var(--success)" }} />
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-secondary small">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={isCurrentUserOwner ? 7 : 6} className="text-center py-4 text-secondary">
                        Foydalanuvchilar topilmadi
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* SUBTAB: PLANS (OWNER PRICING STUDIO) */}
      {subTab === "plans" && (
        <OwnerPricingStudio
          organizations={organizations}
          onRefreshParent={onRefresh}
        />
      )}

      {/* SUBTAB: PAYMENT TESTING STUDIO */}
      {subTab === "payment-testing" && (
        <PaymentTestingStudio />
      )}

      {/* SUBTAB: USAGE */}
      {subTab === "usage" && (
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="linear-card p-3.5 h-100">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem" }}>
                    Jami Hisoblangan AI Xarajat
                  </span>
                  <Badge variant="warning">Bu oy</Badge>
                </div>
                <div className="fs-2 fw-bold font-monospace mb-1" style={{ color: "var(--warning-text)" }}>
                  ${metrics?.total_ai_cost_usd?.toFixed(4) || "0.0000"}
                </div>
                <p className="text-secondary small mb-0">
                  Oylik marja: <strong style={{ color: "var(--success-text)" }}>{metrics?.gross_margin_percent?.toFixed(1) || "100"}%</strong>
                </p>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="linear-card p-3.5 h-100">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem" }}>
                    Jami AI Xabarlari
                  </span>
                  <Badge variant="info">LLM</Badge>
                </div>
                <div className="fs-2 fw-bold font-monospace mb-1 text-primary">
                  {metrics?.total_ai_messages_this_month?.toLocaleString() || "0"} ta
                </div>
                <p className="text-secondary small mb-0">
                  O&apos;rtacha 1 xabar narxi:{" "}
                  <strong className="font-monospace" style={{ color: "var(--info-text)" }}>
                    $
                    {metrics && metrics.total_ai_messages_this_month > 0
                      ? (metrics.total_ai_cost_usd / metrics.total_ai_messages_this_month).toFixed(5)
                      : "0.00000"}
                  </strong>
                </p>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="linear-card p-3.5 h-100">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem" }}>
                    Jami Suhbatlar
                  </span>
                  <Badge variant="accent">{organizations.length} do&apos;kon</Badge>
                </div>
                <div className="fs-2 fw-bold font-monospace mb-1 text-primary">
                  {organizations.reduce((acc, o) => acc + (o.conversations_count || 0), 0).toLocaleString()} ta
                </div>
                <p className="text-secondary small mb-0">
                  Oylik daromad (MRR): <strong className="font-monospace" style={{ color: "var(--success-text)" }}>${metrics?.mrr_usd?.toFixed(2) || "0.00"}</strong>
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader
              actions={
                <div className="d-flex align-items-center gap-2">
                  <Button variant="secondary" size="sm" icon={<IconDownload size={14} />} onClick={exportStoresCsv}>
                    CSV Yuklash
                  </Button>
                  <Badge variant="accent">{organizations.length} ta do&apos;kon</Badge>
                </div>
              }
            >
              <CardTitle>Do&apos;konlar Kesimida AI Xarajati va Daromad</CardTitle>
            </CardHeader>
            <div className="table-responsive">
              <table className="linear-table">
                <thead>
                  <tr>
                    <th>Do&apos;kon</th>
                    <th>Tarif</th>
                    <th>Suhbatlar</th>
                    <th>Oylik Daromad</th>
                    <th>AI Xarajati</th>
                    <th>Marja</th>
                    <th>Rentabellik</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-secondary">
                        Ma&apos;lumotlar topilmadi
                      </td>
                    </tr>
                  ) : (
                    [...organizations]
                      .sort((a, b) => (b.monthly_ai_cost_usd || 0) - (a.monthly_ai_cost_usd || 0))
                      .map((org) => (
                        <tr key={org.id}>
                          <td>
                            <div className="fw-semibold text-primary">{org.name}</div>
                            <div className="text-secondary small font-monospace" style={{ fontSize: "0.72rem" }}>
                              {org.slug}
                            </div>
                          </td>
                          <td><Badge variant="accent">{org.plan.toUpperCase()}</Badge></td>
                          <td className="font-monospace text-secondary small">{org.conversations_count ?? 0} ta</td>
                          <td className="font-monospace fw-bold" style={{ color: "var(--success-text)" }}>${org.monthly_revenue_usd}</td>
                          <td className="font-monospace" style={{ color: "var(--warning-text)" }}>${org.monthly_ai_cost_usd}</td>
                          <td className="font-monospace text-primary small">{org.gross_margin_percent}%</td>
                          <td>
                            <Badge variant={org.is_profitable ? "success" : "danger"}>
                              {org.is_profitable ? "Foydali" : "Zarar"}
                            </Badge>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* SUBTAB: SYSTEM */}
      {subTab === "system" && (
        <div className="d-flex flex-column gap-4">
          <Card>
            <CardHeader
              actions={
                <div className="d-flex align-items-center gap-2">
                  <Badge variant={systemHealth?.status === "ok" ? "success" : "danger"} dot>
                    {systemHealth?.status === "ok" ? "Tizim Barqaror" : "Tekshirish kerak"}
                  </Badge>
                  <Button variant="secondary" size="sm" icon={<IconRefresh size={14} />} onClick={onRefresh}>
                    Tekshirish
                  </Button>
                </div>
              }
            >
              <CardTitle>Tizim va Xizmatlar Holati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="linear-card p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold text-primary d-flex align-items-center gap-1.5">
                        <IconDatabase size={16} style={{ color: "var(--accent)" }} />
                        PostgreSQL &amp; pgvector
                      </span>
                      <Badge variant={systemHealth?.database === "healthy" ? "success" : "danger"}>
                        {systemHealth?.database === "healthy" ? "Connected" : "Uzilgan"}
                      </Badge>
                    </div>
                    <div className="small text-secondary font-monospace" style={{ fontSize: "0.75rem" }}>
                      Holat: {systemHealth?.database || "tekshirilmoqda"}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="linear-card p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold text-primary d-flex align-items-center gap-1.5">
                        <IconActivity size={16} style={{ color: "var(--info)" }} />
                        Redis Kesh &amp; Navbat
                      </span>
                      <Badge
                        variant={
                          systemHealth?.redis === "healthy"
                            ? "success"
                            : systemHealth?.redis === "unconfigured"
                            ? "default"
                            : "warning"
                        }
                      >
                        {systemHealth?.redis === "healthy"
                          ? "Faol"
                          : systemHealth?.redis === "unconfigured"
                          ? "O'chirilgan"
                          : "Muammo"}
                      </Badge>
                    </div>
                    <div className="small text-secondary font-monospace" style={{ fontSize: "0.75rem" }}>
                      Holat: {systemHealth?.redis || "tekshirilmoqda"}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="linear-card p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold text-primary d-flex align-items-center gap-1.5">
                        <IconCpu size={16} style={{ color: "var(--warning)" }} />
                        Google Gemini API
                      </span>
                      <Badge variant={systemHealth?.gemini_configured ? "success" : "danger"}>
                        {systemHealth?.gemini_configured ? "Sozlangan" : "Sozlanmagan"}
                      </Badge>
                    </div>
                    <div className="small text-secondary" style={{ fontSize: "0.75rem" }}>
                      OpenAI zaxira: {systemHealth?.openai_configured ? "Sozlangan" : "Yo'q"}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="linear-card p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold text-primary">Telegram Bot Service</span>
                      <Badge variant={systemHealth?.telegram_configured ? "success" : "warning"}>
                        {systemHealth?.telegram_configured ? "Faol" : "Sozlanmagan"}
                      </Badge>
                    </div>
                    <div className="small text-secondary" style={{ fontSize: "0.75rem" }}>
                      Platforma asosiy boti va webhook
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="linear-card p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold text-primary d-flex align-items-center gap-1.5">
                        <IconCreditCard size={16} style={{ color: "var(--success)" }} />
                        TezCheck To&apos;lov Tizimi
                      </span>
                      <Badge variant={systemHealth?.tezcheck_configured ? "success" : "warning"}>
                        {systemHealth?.tezcheck_configured ? "Faol" : "Sozlanmagan"}
                      </Badge>
                    </div>
                    <div className="small text-secondary" style={{ fontSize: "0.75rem" }}>
                      Merchant API va webhook tekshiruvi
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="linear-card p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold text-primary d-flex align-items-center gap-1.5">
                        <IconServer size={16} style={{ color: "var(--accent)" }} />
                        Backend Server
                      </span>
                      <Badge variant="accent">v{systemHealth?.version || "0.1.0"}</Badge>
                    </div>
                    <div className="small text-secondary font-monospace" style={{ fontSize: "0.75rem" }}>
                      Muhit: {systemHealth?.app_env || "production"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tezkor Platforma Vositalari va Hisobotlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between gap-3">
                    <div>
                      <div className="fw-semibold text-primary d-flex align-items-center gap-2 mb-1">
                        <IconSend size={16} style={{ color: "var(--info)" }} />
                        Kunlik / Hozirgi Telegram Hisobot
                      </div>
                      <p className="text-secondary small mb-0">
                        Barcha do&apos;konlar, faol obunalar, MRR, AI xarajati va oxirgi 24 soatlik ko&apos;rsatkichlarni admin Telegramiga yuborish.
                      </p>
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<IconSend size={14} />}
                        onClick={handleTriggerDailyReport}
                        disabled={!onSendDailyReport || reportBusy}
                      >
                        {reportBusy ? "Yuborilmoqda..." : "Hisobotni Yuborish"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between gap-3">
                    <div>
                      <div className="fw-semibold text-primary d-flex align-items-center gap-2 mb-1">
                        <IconBellRinging size={16} style={{ color: "var(--accent)" }} />
                        Telegram E&apos;lon (Broadcast)
                      </div>
                      <p className="text-secondary small mb-0">
                        Telegram akkaunti ulangan do&apos;kon egalari yoki sayt adminlariga yangilanish va muhim ogohlantirish yuborish.
                      </p>
                    </div>
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<IconBellRinging size={14} />}
                        disabled={!isCurrentUserOwner || !onSendBroadcast}
                        onClick={() => {
                          setBroadcastError("");
                          setBroadcastResult(null);
                          setBroadcastPreviewCount(null);
                          setShowBroadcastModal(true);
                        }}
                      >
                        E&apos;lon Yozish
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUBTAB: AUDIT */}
      {subTab === "audit" && (
        <Card>
          <CardHeader
            actions={
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="position-relative" style={{ minWidth: "200px" }}>
                  <IconSearch size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-secondary" />
                  <input
                    type="text"
                    className="linear-input ps-5"
                    placeholder="Qidirish (resurs, email, amal)..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                  />
                </div>
                <select
                  className="linear-input"
                  style={{ width: "auto", minWidth: "160px" }}
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                >
                  <option value="all">Barcha harakatlar</option>
                  {auditActions.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" size="sm" icon={<IconDownload size={14} />} onClick={exportAuditCsv}>
                  CSV
                </Button>
                <Badge variant="default">{filteredAuditLogs.length} ta yozuv</Badge>
              </div>
            }
          >
            <CardTitle>Xavfsizlik va Ma&apos;muriy Audit Loglari</CardTitle>
          </CardHeader>
          <div className="table-responsive">
            <table className="linear-table">
              <thead>
                <tr>
                  <th>Vaqt</th>
                  <th>Harakat</th>
                  <th>Resurs</th>
                  <th>Tafsilotlar</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-secondary small font-monospace" style={{ whiteSpace: "nowrap" }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                    </td>
                    <td>
                      <Badge variant={getAuditActionVariant(log.action)}>{log.action}</Badge>
                    </td>
                    <td className="text-primary small">
                      {log.resource} {log.resource_id ? `#${log.resource_id}` : ""}
                    </td>
                    <td className="font-monospace small text-secondary" style={{ maxWidth: "420px" }}>
                      {log.metadata && typeof log.metadata === "object" ? (
                        <div className="d-flex flex-wrap gap-1">
                          {Object.entries(log.metadata).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-1.5 py-0.5 rounded border text-truncate"
                              style={{
                                maxWidth: "240px",
                                fontSize: "0.7rem",
                                backgroundColor: "var(--bg-canvas)",
                                borderColor: "var(--border-subtle)",
                              }}
                              title={`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`}
                            >
                              <strong className="text-primary">{k}:</strong>{" "}
                              {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-secondary">
                      Audit yozuvlari topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: STORE INSPECTOR & SUBSCRIPTION MANAGER */}
      {inspectStoreId !== null && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1055 }}
          onClick={() => setInspectStoreId(null)}
        >
          <div
            className="linear-card p-4"
            style={{ width: "680px", maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-2"
                  style={{ width: "34px", height: "34px", backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)" }}
                >
                  <IconBuildingSkyscraper size={18} />
                </div>
                <div>
                  <h5 className="fw-bold mb-0 text-primary">
                    {inspectDetails?.organization?.name || `Do'kon #${inspectStoreId}`}
                  </h5>
                  <span className="text-secondary small font-monospace">
                    {inspectDetails?.organization?.slug || "Yuklanmoqda..."}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 d-flex align-items-center justify-content-center rounded"
                style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                onClick={() => setInspectStoreId(null)}
                aria-label="Yopish"
              >
                <IconX size={16} />
              </button>
            </div>

            {inspectError && (
              <div
                className="p-2.5 rounded-2 d-flex align-items-center gap-2 small mb-3"
                style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger-text)", border: "1px solid var(--danger-border)" }}
              >
                <IconAlertCircle size={16} />
                <span>{inspectError}</span>
              </div>
            )}

            {inspectLoading ? (
              <div className="py-5 text-center text-secondary small">Do&apos;kon ma&apos;lumotlari yuklanmoqda...</div>
            ) : (
              inspectDetails && (
                <div className="d-flex flex-column gap-3">
                  {/* Stats Grid */}
                  <div className="row g-2">
                    <div className="col-6 col-md-3">
                      <div className="linear-card p-2.5 text-center">
                        <div className="text-secondary" style={{ fontSize: "0.7rem" }}>Suhbatlar</div>
                        <div className="fs-5 fw-bold font-monospace text-primary">
                          {inspectDetails.stats?.conversations_count ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="linear-card p-2.5 text-center">
                        <div className="text-secondary" style={{ fontSize: "0.7rem" }}>Xabarlar</div>
                        <div className="fs-5 fw-bold font-monospace text-primary">
                          {inspectDetails.stats?.messages_count ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="linear-card p-2.5 text-center">
                        <div className="text-secondary" style={{ fontSize: "0.7rem" }}>Buyurtmalar</div>
                        <div className="fs-5 fw-bold font-monospace" style={{ color: "var(--success-text)" }}>
                          {inspectDetails.stats?.orders_count ?? 0} ({inspectDetails.stats?.confirmed_orders_count ?? 0} ✓)
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="linear-card p-2.5 text-center">
                        <div className="text-secondary" style={{ fontSize: "0.7rem" }}>Mahsulotlar</div>
                        <div className="fs-5 fw-bold font-monospace text-primary">
                          {inspectDetails.stats?.products_count ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Integration Status Badges */}
                  <div className="d-flex flex-wrap gap-2">
                    <Badge variant={inspectDetails.organization?.bot_configured ? "success" : "warning"}>
                      Telegram Bot: {inspectDetails.organization?.bot_configured ? "Ulangan" : "Ulanmagan"}
                    </Badge>
                    <Badge variant={inspectDetails.organization?.gemini_configured ? "info" : "default"}>
                      Custom Gemini: {inspectDetails.organization?.gemini_configured ? "Bor" : "Platforma kaliti"}
                    </Badge>
                    <Badge variant="default">Til: {inspectDetails.organization?.ai_language?.toUpperCase() || "UZ"}</Badge>
                  </div>

                  {/* Subscription Editor */}
                  {onUpdateStoreSubscription && (
                    <form
                      onSubmit={handleSaveSubscription}
                      className="linear-card p-3 d-flex flex-column gap-2.5"
                      style={{ backgroundColor: "var(--bg-canvas)" }}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="fw-semibold text-primary small d-flex align-items-center gap-1.5">
                          <IconCalendarPlus size={15} style={{ color: "var(--accent)" }} />
                          Tarif va Obuna Boshqaruvi
                        </span>
                        {inspectDetails.subscription?.current_period_end && (
                          <span className="text-secondary font-monospace" style={{ fontSize: "0.72rem" }}>
                            Tugash sanasi: {new Date(inspectDetails.subscription.current_period_end).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="row g-2">
                        <div className="col-6 col-md-3">
                          <label className="text-secondary small mb-1 d-block">Tarif</label>
                          <select
                            className="linear-input"
                            value={subPlanCode}
                            onChange={(e) => setSubPlanCode(e.target.value)}
                          >
                            <option value="start">START</option>
                            <option value="pro">PRO</option>
                            <option value="ultra">ULTRA</option>
                          </select>
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="text-secondary small mb-1 d-block">Holat</label>
                          <select
                            className="linear-input"
                            value={subStatus}
                            onChange={(e) => setSubStatus(e.target.value)}
                          >
                            <option value="active">active</option>
                            <option value="subscription_active">subscription_active</option>
                            <option value="trialing">trialing</option>
                            <option value="mega_discount_active">mega_discount_active</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="text-secondary small mb-1 d-block">Davr</label>
                          <select
                            className="linear-input"
                            value={subCycle}
                            onChange={(e) => setSubCycle(e.target.value)}
                          >
                            <option value="monthly">Oylik</option>
                            <option value="yearly">Yillik</option>
                          </select>
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="text-secondary small mb-1 d-block">Muddat qo&apos;shish</label>
                          <select
                            className="linear-input"
                            value={subExtendDays}
                            onChange={(e) => setSubExtendDays(Number(e.target.value))}
                          >
                            <option value={0}>O&apos;zgartirmaslik</option>
                            <option value={7}>+7 kun (Sinov)</option>
                            <option value={30}>+30 kun (1 oy)</option>
                            <option value={90}>+90 kun (3 oy)</option>
                            <option value={365}>+365 kun (1 yil)</option>
                          </select>
                        </div>
                      </div>

                      <div className="d-flex justify-content-end gap-2 mt-1">
                        <Button type="submit" variant="primary" size="sm" disabled={subSaving}>
                          {subSaving ? "Saqlanmoqda..." : "Obunani Saqlash"}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Members List */}
                  <div>
                    <div className="text-secondary small fw-semibold mb-1.5">Do&apos;kon A&apos;zolari ({inspectDetails.members?.length || 0})</div>
                    <div className="d-flex flex-column gap-1.5">
                      {(inspectDetails.members || []).map((m: any) => (
                        <div
                          key={m.user_id}
                          className="p-2 rounded-2 d-flex align-items-center justify-content-between"
                          style={{ backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-subtle)" }}
                        >
                          <div>
                            <div className="small fw-semibold text-primary">{m.full_name || m.email}</div>
                            <div className="font-monospace text-secondary" style={{ fontSize: "0.72rem" }}>{m.email}</div>
                          </div>
                          <div className="d-flex align-items-center gap-1.5">
                            <Badge variant="accent">{m.role}</Badge>
                            {m.telegram_user_id && <Badge variant="info">TG: {m.telegram_user_id}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* MODAL: DAILY REPORT PREVIEW */}
      {showReportModal && reportData && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1055 }}
          onClick={() => setShowReportModal(false)}
        >
          <div className="linear-card p-4" style={{ width: "520px", maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fw-bold mb-0 text-primary">Platforma Kunlik Hisoboti</h5>
              <button
                type="button"
                className="btn btn-sm p-1 rounded"
                style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                onClick={() => setShowReportModal(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div className="mb-2 d-flex gap-2 flex-wrap">
              <Badge variant={reportData.sent_count > 0 ? "success" : "warning"}>
                Telegram yuborildi: {reportData.sent_count} / {reportData.recipient_count}
              </Badge>
            </div>
            <pre
              className="p-3 rounded-2 small font-monospace text-primary mb-3"
              style={{
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
                whiteSpace: "pre-wrap",
              }}
            >
              {reportData.report_text}
            </pre>
            <div className="d-flex justify-content-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<IconCopy size={14} />}
                onClick={() => {
                  navigator.clipboard?.writeText(reportData.report_text || "");
                  setCopiedReport(true);
                  setTimeout(() => setCopiedReport(false), 1800);
                }}
              >
                {copiedReport ? "Nusxalandi!" : "Nusxalash"}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowReportModal(false)}>
                Yopish
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TELEGRAM BROADCAST */}
      {showBroadcastModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1055 }}
          onClick={() => setShowBroadcastModal(false)}
        >
          <div className="linear-card p-4" style={{ width: "540px", maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="d-flex align-items-center gap-2">
                <IconBellRinging size={18} style={{ color: "var(--accent)" }} />
                <h5 className="fw-bold mb-0 text-primary">Telegram E&apos;lon (Broadcast)</h5>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 rounded"
                style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                onClick={() => setShowBroadcastModal(false)}
              >
                <IconX size={16} />
              </button>
            </div>

            {broadcastError && (
              <div
                className="p-2.5 rounded-2 small mb-3 d-flex align-items-center gap-2"
                style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger-text)", border: "1px solid var(--danger-border)" }}
              >
                <IconAlertCircle size={15} />
                <span>{broadcastError}</span>
              </div>
            )}

            {broadcastResult ? (
              <div className="text-center py-3">
                <Badge variant="success" className="mb-2">Yuborish yakunlandi</Badge>
                <p className="small text-secondary mb-3">
                  Jami qabul qiluvchilar: <strong>{broadcastResult.recipient_count}</strong> • Muvaffaqiyatli:{" "}
                  <strong style={{ color: "var(--success-text)" }}>{broadcastResult.sent_count}</strong> • Xatolik:{" "}
                  <strong>{broadcastResult.failed_count}</strong>
                </p>
                <Button variant="primary" size="sm" onClick={() => setShowBroadcastModal(false)}>
                  Yopish
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmitBroadcast} className="d-flex flex-column gap-3">
                <div>
                  <label className="text-secondary small fw-medium mb-1 d-block">Kimga yuborilsin?</label>
                  <select
                    className="linear-input"
                    value={broadcastAudience}
                    onChange={(e) => {
                      setBroadcastAudience(e.target.value as any);
                      setBroadcastPreviewCount(null);
                    }}
                  >
                    <option value="store_owners">Do&apos;kon egalari (Telegram ulanganlar)</option>
                    <option value="site_admins">Faqat Sayt Adminlari</option>
                    <option value="all_linked">Telegram ulangan barcha foydalanuvchilar</option>
                  </select>
                </div>

                <div>
                  <label className="text-secondary small fw-medium mb-1 d-block">Xabar matni</label>
                  <textarea
                    rows={4}
                    className="linear-input"
                    placeholder="Masalan: Bugun tizimda yangi AI Playground va Smart Follow-up ishga tushdi!"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    required
                  />
                </div>

                {broadcastPreviewCount !== null && (
                  <div className="small text-secondary">
                    Taxminiy qabul qiluvchilar soni: <strong className="text-primary">{broadcastPreviewCount} ta</strong> foydalanuvchi
                  </div>
                )}

                <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top" style={{ borderColor: "var(--border-subtle)" }}>
                  <Button type="button" variant="secondary" size="sm" onClick={handlePreviewBroadcast} disabled={broadcastBusy}>
                    Qabul qiluvchilarni tekshirish
                  </Button>
                  <div className="d-flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowBroadcastModal(false)}>
                      Bekor qilish
                    </Button>
                    <Button type="submit" variant="primary" size="sm" icon={<IconSend size={14} />} disabled={broadcastBusy}>
                      {broadcastBusy ? "Yuborilmoqda..." : "Telegramdan Yuborish"}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW STORE */}
      {showCreateModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1055 }}
        >
          <div className="linear-card p-4" style={{ width: "640px", maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-2"
                  style={{ width: "32px", height: "32px", backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)" }}
                >
                  <IconBuildingSkyscraper size={18} />
                </div>
                <div>
                  <h5 className="fw-bold mb-0 text-primary">Yangi Do&apos;kon Ochish</h5>
                  <span className="text-secondary small">Platforma doirasida yangi mustaqil savdo do&apos;koni ochish</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm p-1 d-flex align-items-center justify-content-center rounded"
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
                onClick={() => setShowCreateModal(false)}
                aria-label="Yopish"
              >
                <IconX size={16} />
              </button>
            </div>

            {createStoreSuccess ? (
              <div className="text-center py-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                  style={{ width: "56px", height: "56px", backgroundColor: "var(--success-subtle)", color: "var(--success-text)" }}
                >
                  <IconCheck size={32} />
                </div>
                <h4 className="fw-bold mb-2 text-primary">Do&apos;kon Muvaffaqiyatli Ochildi!</h4>
                <p className="text-secondary small mb-4">
                  <strong>{createStoreSuccess.organization?.name}</strong> do&apos;koni tizimda yaratildi.
                </p>

                <div className="linear-card p-3 mb-4 text-start small">
                  <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-secondary">Do&apos;kon ID &amp; Slug:</span>
                    <span className="font-monospace text-primary fw-semibold">
                      #{createStoreSuccess.organization?.id} • {createStoreSuccess.organization?.slug}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-secondary">Egasi Pochtasi:</span>
                    <span className="font-monospace text-primary">
                      {createStoreSuccess.organization?.owner_email}
                    </span>
                  </div>
                  {createStoreSuccess.organization?.temporary_password && (
                    <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
                      <span className="text-secondary">Vaqtincha Parol:</span>
                      <span className="font-monospace fw-bold" style={{ color: "var(--warning-text)" }}>
                        {createStoreSuccess.organization?.temporary_password}
                      </span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-secondary">Tarif &amp; Valyuta:</span>
                    <span className="font-monospace" style={{ color: "var(--info-text)" }}>
                      {createStoreSuccess.organization?.plan} ({createStoreSuccess.organization?.currency})
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-center gap-2">
                  <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                    Yopish
                  </Button>
                  {onEnterStore && createStoreSuccess.organization && (
                    <Button
                      variant="primary"
                      icon={<IconArrowRight size={14} />}
                      onClick={() => {
                        setShowCreateModal(false);
                        onEnterStore(createStoreSuccess.organization);
                      }}
                    >
                      Do&apos;kon ichiga kirish
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="d-flex flex-column gap-3">
                {createStoreError && (
                  <div
                    className="p-2.5 rounded-2 d-flex align-items-center gap-2 small"
                    style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger-text)", border: "1px solid var(--danger-border)" }}
                  >
                    <IconAlertCircle size={16} />
                    <span>{createStoreError}</span>
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="text-secondary small fw-medium mb-1 d-block">Do&apos;kon Nomi *</label>
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="Masalan: Artel Elektronika"
                      value={createStoreName}
                      onChange={(e) => {
                        setCreateStoreName(e.target.value);
                        if (!createStoreSlug) {
                          setCreateStoreSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-|-$/g, "")
                          );
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="text-secondary small fw-medium mb-1 d-block">Identifikator (Slug) *</label>
                    <input
                      type="text"
                      className="linear-input font-monospace"
                      placeholder="artel-store"
                      value={createStoreSlug}
                      onChange={(e) => setCreateStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      required
                    />
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="text-secondary small fw-medium mb-1 d-block">Soha / Kategoriya</label>
                    <select
                      className="linear-input"
                      value={createStoreCategory}
                      onChange={(e) => setCreateStoreCategory(e.target.value)}
                    >
                      <option value="Elektronika va Texnika">Elektronika va Texnika</option>
                      <option value="Kiyim-kechak va Moda">Kiyim-kechak va Moda</option>
                      <option value="Go'zallik va Parfyumeriya">Go&apos;zallik va Parfyumeriya</option>
                      <option value="Avto ehtiyot qismlar">Avto ehtiyot qismlar</option>
                      <option value="Uy-ro'zg'or mollari">Uy-ro&apos;zg&apos;or mollari</option>
                      <option value="Restoran va Kafelar">Restoran va Kafelar</option>
                      <option value="Xizmat ko'rsatish">Xizmat ko&apos;rsatish</option>
                      <option value="Boshqa">Boshqa</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="text-secondary small fw-medium mb-1 d-block">Tarif</label>
                    <select
                      className="linear-input"
                      value={createStorePlan}
                      onChange={(e) => setCreateStorePlan(e.target.value)}
                    >
                      <option value="start">START</option>
                      <option value="pro">PRO (Tavsiya)</option>
                      <option value="ultra">ULTRA</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="text-secondary small fw-medium mb-1 d-block">Valyuta</label>
                    <select
                      className="linear-input"
                      value={createStoreCurrency}
                      onChange={(e) => setCreateStoreCurrency(e.target.value as "UZS" | "USD")}
                    >
                      <option value="UZS">UZS (so&apos;m)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="text-secondary small fw-medium mb-1 d-block">Egasi Pochtasi (Email) *</label>
                    <input
                      type="email"
                      className="linear-input"
                      placeholder="owner@store.uz"
                      value={createStoreEmail}
                      onChange={(e) => setCreateStoreEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="text-secondary small fw-medium mb-1 d-block">Parol (ixtiyoriy)</label>
                    <input
                      type="password"
                      className="linear-input"
                      placeholder="Bo'sh qolsa avtomatik yaratiladi"
                      value={createStorePassword}
                      onChange={(e) => setCreateStorePassword(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-secondary small fw-medium mb-1 d-block">Telegram Bot Token (ixtiyoriy)</label>
                  <input
                    type="text"
                    className="linear-input font-monospace"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                    value={createStoreBotToken}
                    onChange={(e) => setCreateStoreBotToken(e.target.value)}
                  />
                  <span className="text-tertiary small mt-1 d-block" style={{ fontSize: "0.72rem" }}>
                    @BotFather orqali olingan token. Keyinroq ham sozlamalardan ulash mumkin.
                  </span>
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top" style={{ borderColor: "var(--border-subtle)" }}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createStoreBusy}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={createStoreBusy}
                    icon={<IconPlus size={15} />}
                  >
                    {createStoreBusy ? "Do'kon ochilmoqda..." : "Do'konni Ochish"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
