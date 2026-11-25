"use client";

import React, { useState } from "react";
import {
  IconActivity,
  IconAlertCircle,
  IconArrowRight,
  IconBuildingSkyscraper,
  IconCheck,
  IconCpu,
  IconCreditCard,
  IconCrown,
  IconDatabase,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconServer,
  IconShieldLock,
  IconTrash,
  IconUserCheck,
  IconUserOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DonutChart } from "../ui/Charts";
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

interface PlatformOwnerTabProps {
  subTab?: "overview" | "stores" | "users" | "plans" | "usage" | "system" | "audit" | "payment-testing";
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
  onSwitchSubTab?: (subTab: "overview" | "stores" | "users" | "plans" | "usage" | "system" | "audit" | "payment-testing") => void;
  onCreateStore?: (payload: any) => Promise<any>;
  onUpdateStoreStatus?: (storeId: number, status: string) => Promise<void>;
  onDeleteStore?: (storeId: number) => Promise<void>;
  onAppointSiteAdmin?: (email: string, fullName?: string) => Promise<void>;
  onToggleSiteAdmin?: (userId: number, makeAdmin: boolean) => Promise<void>;
  onToggleUserStatus?: (userId: number, isActive: boolean) => Promise<void>;
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
}: PlatformOwnerTabProps) {
  const [storeSearch, setStoreSearch] = useState("");
  const [storeStatusFilter, setStoreStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admins" | "owners">("all");
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

  const filteredOrgs = organizations.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      o.slug.toLowerCase().includes(storeSearch.toLowerCase());
    if (!matchesSearch) return false;
    const orgStatus = (o.status || "active").toLowerCase();
    if (storeStatusFilter === "active") return orgStatus === "active";
    if (storeStatusFilter === "suspended") return orgStatus !== "active";
    return true;
  });

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase()));
    if (!matchesSearch) return false;
    if (userRoleFilter === "admins") return Boolean(u.is_platform_owner || u.is_platform_admin);
    if (userRoleFilter === "owners") return !u.is_platform_owner && !u.is_platform_admin;
    return true;
  });

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

  return (
    <div className="d-flex flex-column gap-4">
      {/* Platform Admin Header */}
      <div className="linear-card p-3.5">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
              style={{
                width: "44px",
                height: "44px",
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <IconCrown size={22} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="fw-bold mb-0 text-primary" style={{ fontSize: "1.15rem", letterSpacing: "-0.01em" }}>
                  {isCurrentUserOwner ? "Sayt Egasi Boshqaruv Markazi" : "Sayt Admini Boshqaruv Markazi"}
                </h2>
                <Badge variant="accent">
                  {isCurrentUserOwner ? "Owner" : "Sayt Admini"}
                </Badge>
                <Badge variant="default">
                  {(metrics?.total_organizations ?? organizations.length) || 0} ta do&apos;kon
                </Badge>
              </div>
              <p className="text-secondary small mb-0 mt-1">
                Barcha do&apos;konlar, foydalanuvchilar, AI xarajatlari va platforma sozlamalarini boshqarish markazi.
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={15} />}
              onClick={() => {
                resetCreateForm();
                setShowCreateModal(true);
              }}
            >
              Yangi Do&apos;kon Ochish
            </Button>
          </div>
        </div>
      </div>

      {/* SUBTAB: OVERVIEW */}
      {subTab === "overview" && (
        <div className="d-flex flex-column gap-4">
          {/* Top 4 Financial KPI Cards */}
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                      Oylik Takroriy Daromad (MRR)
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
                <div className="text-secondary small mt-2 pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  Yillik prognoz (ARR): <strong className="text-primary font-monospace">${metrics?.arr_usd?.toFixed(2) || "0.00"}</strong>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
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
                    <div className="fs-2 fw-bold font-monospace mb-1 text-primary">
                      {metrics?.gross_margin_percent?.toFixed(1) || "100"}%
                    </div>
                  )}
                </div>
                <div className="text-secondary small mt-2 pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  ARPU: <strong className="font-monospace" style={{ color: "var(--info-text)" }}>${metrics?.arpu_usd?.toFixed(2) || "0.00"}</strong> / mijoz
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                      Jami AI Xarajati
                    </span>
                    <Badge variant="warning">Compute Cost</Badge>
                  </div>
                  {loading ? (
                    <div className="skeleton-shimmer skeleton-title w-50 mb-1 mt-1" style={{ height: "28px" }} />
                  ) : (
                    <div className="fs-2 fw-bold font-monospace mb-1" style={{ color: "var(--warning-text)" }}>
                      ${metrics?.total_ai_cost_usd?.toFixed(2) || "0.00"}
                    </div>
                  )}
                </div>
                <div className="text-secondary small mt-2 pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  Bu oy: <strong className="text-primary font-monospace">{metrics?.total_ai_messages_this_month?.toLocaleString() || "0"}</strong> ta xabar
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="linear-card p-3.5 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.04em" }}>
                      Do'konlar Soni
                    </span>
                    <Badge variant="info">Tenants</Badge>
                  </div>
                  {loading ? (
                    <div className="skeleton-shimmer skeleton-title w-50 mb-1 mt-1" style={{ height: "28px" }} />
                  ) : (
                    <div className="fs-2 fw-bold font-monospace mb-1 text-primary">
                      {(metrics?.total_organizations ?? organizations.length) || 0}{" "}
                      <span className="text-secondary small fs-5 fw-normal">ta</span>
                    </div>
                  )}
                </div>
                <div className="text-secondary small mt-2 pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                  Faol: <strong style={{ color: "var(--success-text)" }}>{(metrics?.active_subscriptions ?? organizations.filter(o => o.subscription_status === "active").length) || 0} ta</strong> • Sinov: {metrics?.trial_organizations || 0} ta
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stores Overview & Plan Distribution */}
          <div className="row g-3">
            <div className="col-12 col-lg-8">
              <Card>
                <CardHeader
                  actions={
                    onSwitchSubTab && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconArrowRight size={14} />}
                        onClick={() => onSwitchSubTab("stores")}
                      >
                        Barcha do'konlar
                      </Button>
                    )
                  }
                >
                  <CardTitle>Eng Faol Do'konlar</CardTitle>
                </CardHeader>
                <div className="table-responsive">
                  <table className="linear-table">
                    <thead>
                      <tr>
                        <th>Do'kon</th>
                        <th>Tarif</th>
                        <th>Oylik Daromad</th>
                        <th>AI Xarajati</th>
                        <th>Marja</th>
                        <th className="text-end">Amal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        [...Array(4)].map((_, idx) => (
                          <tr key={`skel-store-${idx}`}>
                            <td>
                              <div className="skeleton-shimmer skeleton-text w-75 mb-1" style={{ height: "13px" }} />
                              <div className="skeleton-shimmer skeleton-text w-50" style={{ height: "10px" }} />
                            </td>
                            <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "18px", borderRadius: "10px" }} /></td>
                            <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "13px" }} /></td>
                            <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "13px" }} /></td>
                            <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "13px" }} /></td>
                            <td className="text-end"><div className="skeleton-shimmer skeleton-text ms-auto" style={{ width: "90px", height: "30px", borderRadius: "6px" }} /></td>
                          </tr>
                        ))
                      ) : organizations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-secondary">
                            Hozircha faol do'konlar mavjud emas.
                          </td>
                        </tr>
                      ) : (
                        organizations.slice(0, 5).map((org) => (
                          <tr key={org.id}>
                            <td>
                              <div className="fw-semibold text-primary">{org.name}</div>
                              <div className="text-secondary small font-monospace" style={{ fontSize: "0.75rem" }}>
                                {org.slug}
                              </div>
                            </td>
                            <td>
                              <Badge variant="accent">{org.plan.toUpperCase()}</Badge>
                            </td>
                            <td className="font-monospace fw-bold" style={{ color: "var(--success-text)" }}>
                              ${org.monthly_revenue_usd}
                            </td>
                            <td className="font-monospace" style={{ color: "var(--warning-text)" }}>
                              ${org.monthly_ai_cost_usd}
                            </td>
                            <td>
                              <span className="font-monospace fw-semibold text-primary">
                                {org.gross_margin_percent}%
                              </span>
                            </td>
                            <td className="text-end">
                              {onEnterStore && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={<IconArrowRight size={14} />}
                                  onClick={() => onEnterStore(org)}
                                >
                                  Do'konga kirish
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="col-12 col-lg-4">
              <Card className="h-100">
                <CardHeader>
                  <CardTitle>Tariflar Taqsimoti</CardTitle>
                </CardHeader>
                <CardContent>
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
                        centerLabel="ta do'kon"
                        size={140}
                        strokeWidth={15}
                      />
                    );
                  })()}
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
                <div style={{ minWidth: "200px" }}>
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
                  style={{ width: "auto", minWidth: "140px" }}
                  value={storeStatusFilter}
                  onChange={(e) => setStoreStatusFilter(e.target.value as any)}
                >
                  <option value="all">Barcha holatlar</option>
                  <option value="active">Faol do'konlar</option>
                  <option value="suspended">To'xtatilgan</option>
                </select>
                <Badge variant="accent">{filteredOrgs.length} ta do'kon</Badge>
              </div>
            }
          >
            <CardTitle>Barcha Do'konlar (Tenants Portfolio)</CardTitle>
          </CardHeader>
          {!loading && filteredOrgs.length === 0 ? (
            <EmptyState
              icon={<IconBuildingSkyscraper size={32} />}
              title="Mos keluvchi do'kon topilmadi"
              description="Qidiruv so'zi yoki holat filtrini o'zgartiring yoxud yangi do'kon oching."
            />
          ) : (
            <>
              <div className="d-none d-md-block table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th>Do'kon Nomi</th>
                      <th>Sohasi</th>
                      <th>Holat</th>
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
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "12px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "18px", borderRadius: "10px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "18px", borderRadius: "10px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "12px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: "14px" }} /></td>
                          <td className="text-end">
                            <div className="skeleton-shimmer skeleton-text ms-auto" style={{ width: "110px", height: "30px", borderRadius: "6px" }} />
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
                                  width: "28px",
                                  height: "28px",
                                  backgroundColor: "var(--accent-subtle)",
                                  color: "var(--accent-text)",
                                }}
                              >
                                <IconBuildingSkyscraper size={16} />
                              </div>
                              <div>
                                <div className="fw-semibold text-primary">{org.name}</div>
                                <div className="text-secondary small font-monospace" style={{ fontSize: "0.72rem" }}>
                                  #{org.id} • {org.slug}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="text-secondary small">{org.category || "Retail"}</td>
                          <td>
                            <Badge variant={isOrgActive ? "success" : "warning"} dot>
                              {isOrgActive ? "Faol" : orgStatus === "suspended" ? "To'xtatilgan" : orgStatus}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-1.5 flex-wrap">
                              <Badge variant="accent">{org.plan.toUpperCase()}</Badge>
                              <Badge
                                variant={
                                  org.subscription_status === "active"
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
                              {onEnterStore && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={<IconArrowRight size={14} />}
                                  onClick={() => onEnterStore(org)}
                                  title="Do'kon ichiga kirish"
                                >
                                  Do'konga kirish
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
                      To'liq ismi (ixtiyoriy)
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
                      placeholder="Email yoki ism bo'yicha qidirish..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="linear-input"
                    style={{ width: "auto", minWidth: "145px" }}
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value as any)}
                  >
                    <option value="all">Barcha rollar</option>
                    <option value="admins">Sayt Adminlari</option>
                    <option value="owners">Do'kon Egalari</option>
                  </select>
                  <Badge variant="accent">{filteredUsers.length} ta</Badge>
                </div>
              }
            >
              <CardTitle>Sayt Adminlari va Do'kon Egalari</CardTitle>
            </CardHeader>
            <div className="table-responsive">
              <table className="linear-table">
                <thead>
                  <tr>
                    <th>Foydalanuvchi</th>
                    <th>Telegram ID</th>
                    <th>Roli</th>
                    <th>Holati</th>
                    <th>Ro'yxatdan o'tgan</th>
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
                      <td className="font-monospace text-secondary small">
                        {u.telegram_user_id ? String(u.telegram_user_id) : "-"}
                      </td>
                      <td>
                        {u.is_platform_owner ? (
                          <Badge variant="accent">Sayt egasi (Owner)</Badge>
                        ) : u.is_platform_admin ? (
                          <Badge variant="info">Sayt Admini</Badge>
                        ) : (
                          <Badge variant="default">Do'kon egasi</Badge>
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
                      <td colSpan={isCurrentUserOwner ? 6 : 5} className="text-center py-4 text-secondary">
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
            <CardHeader actions={<Badge variant="accent">{organizations.length} ta do&apos;kon</Badge>}>
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
                <Badge variant="default">{filteredAuditLogs.length} ta yozuv</Badge>
              </div>
            }
          >
            <CardTitle>Xavfsizlik va Ma'muriy Audit Loglari</CardTitle>
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
                      <Badge variant="accent">{log.action}</Badge>
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
                  <h5 className="fw-bold mb-0 text-primary">Yangi Do'kon Ochish</h5>
                  <span className="text-secondary small">Platforma doirasida yangi mustaqil savdo do'koni ochish</span>
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
                <h4 className="fw-bold mb-2 text-primary">Do'kon Muvaffaqiyatli Ochildi!</h4>
                <p className="text-secondary small mb-4">
                  <strong>{createStoreSuccess.organization?.name}</strong> do'koni tizimda yaratildi.
                </p>

                <div className="linear-card p-3 mb-4 text-start small">
                  <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-secondary">Do'kon ID & Slug:</span>
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
                    <span className="text-secondary">Tarif & Valyuta:</span>
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
                      Do'kon ichiga kirish
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
                    <label className="text-secondary small fw-medium mb-1 d-block">Do'kon Nomi *</label>
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
                      <option value="Go'zallik va Parfyumeriya">Go'zallik va Parfyumeriya</option>
                      <option value="Avto ehtiyot qismlar">Avto ehtiyot qismlar</option>
                      <option value="Uy-ro'zg'or mollari">Uy-ro'zg'or mollari</option>
                      <option value="Restoran va Kafelar">Restoran va Kafelar</option>
                      <option value="Xizmat ko'rsatish">Xizmat ko'rsatish</option>
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
                      <option value="UZS">UZS (so'm)</option>
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
