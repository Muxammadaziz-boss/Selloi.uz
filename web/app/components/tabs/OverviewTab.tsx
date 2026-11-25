"use client";

import React, { useMemo, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import { downloadCsvExport } from "../../lib/csvExport";
import {
  IconMessageDots,
  IconRobot,
  IconHeadset,
  IconBooks,
  IconShoppingCart,
  IconArrowUpRight,
  IconRefresh,
  IconCircleCheck,
  IconCpu,
  IconBrandTelegram,
  IconActivity,
  IconClock,
  IconRocket,
  IconPackage,
  IconChevronRight,
  IconDownload,
  IconSparkles,
  IconCreditCard,
  IconSend,
  IconBellRinging,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ActivityBarsChart, DonutChart } from "../ui/Charts";

export interface OverviewTabProps {
  overview: {
    conversations: number;
    ai_active: number;
    human_takeover: number;
    knowledge_posts: number;
    orders: number;
  } | null;
  conversations: Array<{
    id: number;
    customer_name: string;
    username?: string | null;
    chat_id: number;
    status: string;
    handoff_reason?: string | null;
    last_message_at?: string | null;
  }>;
  orders: Array<{
    id: string;
    customer: string;
    username: string;
    product: string;
    amount: string;
    status: string;
    date: string;
    channel: string;
  }>;
  channels: Array<{
    id: number;
    channel_username: string;
    title?: string | null;
    is_active: boolean;
    posts_count: number;
  }>;
  productsCount?: number;
  botConfigured?: boolean;
  aiModel?: string;
  storeName?: string;
  planCode?: string | null;
  sseConnected?: boolean;
  followupEnabled?: boolean;
  paymentProvider?: string | null;
  dailyReportEnabled?: boolean;
  dailyReportHour?: number;
  usageMessagesItem?: {
    used: number;
    limit: number;
    percentage: number;
  } | null;
  onSendDailyReportNow?: () => Promise<any>;
  onSelectConversation: (id: number) => void;
  onNavigateTab: (tabId: any, filter?: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function OverviewTab({
  overview,
  conversations,
  orders,
  channels,
  productsCount = 0,
  botConfigured = false,
  aiModel = "gemini-3.1-flash-lite",
  storeName = "Do'kon Boshqaruv Paneli",
  planCode = null,
  sseConnected = false,
  followupEnabled = false,
  paymentProvider = null,
  dailyReportEnabled = false,
  dailyReportHour = 21,
  usageMessagesItem = null,
  onSendDailyReportNow,
  onSelectConversation,
  onNavigateTab,
  onRefresh,
  loading,
}: OverviewTabProps) {
  const { language, t } = useLanguage();
  const [sendingReport, setSendingReport] = useState(false);

  const totalConversations = overview?.conversations ?? conversations.length;
  const aiActiveCount = overview?.ai_active ?? conversations.filter((c) => c.status === "ai_active").length;
  const takeoverCount = overview?.human_takeover ?? conversations.filter((c) => c.status === "human_takeover").length;
  const totalPosts = overview?.knowledge_posts ?? channels.reduce((acc, ch) => acc + (ch.posts_count || 0), 0);
  const totalOrders = overview?.orders ?? orders.length;

  const confirmedOrdersCount = orders.filter((o) =>
    ["confirmed", "paid", "completed"].includes((o.status || "").toLowerCase())
  ).length;
  const conversionRate = totalConversations > 0 ? ((totalOrders / totalConversations) * 100).toFixed(1) : "0.0";
  const aiPercentage = totalConversations > 0 ? Math.round((aiActiveCount / totalConversations) * 100) : 0;
  const humanPercentage = totalConversations > 0 ? Math.round((takeoverCount / totalConversations) * 100) : 0;

  const waitingTakeovers = useMemo(
    () => conversations.filter((c) => c.status === "human_takeover").slice(0, 3),
    [conversations]
  );

  // Build real 7-day conversation + order series
  const activity7Days = useMemo(() => {
    const days: Array<{ key: string; label: string; primary: number; secondary: number }> = [];
    const now = new Date();
    const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
      days.push({ key, label, primary: 0, secondary: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.key, d]));

    conversations.forEach((c) => {
      if (!c.last_message_at) return;
      const parsed = new Date(c.last_message_at);
      if (isNaN(parsed.getTime())) return;
      const k = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      const slot = dayMap.get(k);
      if (slot) slot.primary += 1;
    });

    orders.forEach((o) => {
      if (!o.date) return;
      const parsed = new Date(o.date);
      if (isNaN(parsed.getTime())) return;
      const k = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      const slot = dayMap.get(k);
      if (slot) slot.secondary += 1;
    });

    return days;
  }, [conversations, orders, language]);

  const setupSteps = [
    {
      id: "bot",
      done: botConfigured || totalConversations > 0,
      title: language === "uz" ? "Telegram Botni ulash" : language === "ru" ? "Подключить Telegram бота" : "Connect Telegram Bot",
      desc: language === "uz" ? "Bot tokenini kiriting va webhookni yoqing" : language === "ru" ? "Укажите токен бота и включите webhook" : "Enter bot token and enable webhook",
      tab: "settings",
      icon: IconBrandTelegram,
    },
    {
      id: "knowledge",
      done: channels.length > 0 || totalPosts > 0,
      title: language === "uz" ? "Kanal & Bilim bazasi" : language === "ru" ? "Канал и база знаний" : "Channel & Knowledge Base",
      desc: language === "uz" ? "Postlardan AI uchun bilim bazasi yarating" : language === "ru" ? "Синхронизируйте посты для ИИ" : "Sync channel posts for AI context",
      tab: "knowledge",
      icon: IconBooks,
    },
    {
      id: "products",
      done: productsCount > 0,
      title: language === "uz" ? "Mahsulotlar katalogi" : language === "ru" ? "Каталог товаров" : "Product Catalog",
      desc: language === "uz" ? "Narx va tavsiflar bilan mahsulot qo'shing" : language === "ru" ? "Добавьте товары с ценами" : "Add products with pricing and specs",
      tab: "products",
      icon: IconPackage,
    },
    {
      id: "chat",
      done: totalConversations > 0,
      title: language === "uz" ? "Birinchi mijoz suhbati" : language === "ru" ? "Первый диалог" : "First Customer Chat",
      desc: language === "uz" ? "AI sotuvchi javoblarini jonli kuzating" : language === "ru" ? "Следите за ответами ИИ в чате" : "Monitor live AI responses in Inbox",
      tab: "inbox",
      icon: IconMessageDots,
    },
  ];
  const completedSetupCount = setupSteps.filter((s) => s.done).length;
  const setupProgressPct = Math.round((completedSetupCount / setupSteps.length) * 100);

  const formatTime = (ts?: string | null) => {
    if (!ts) return "-";
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  const handleQuickReport = async () => {
    if (!onSendDailyReportNow) return;
    setSendingReport(true);
    try {
      await onSendDailyReportNow();
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Executive Store Hero Banner */}
      <div
        className="linear-card-elevated p-3.5"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 76, 99, 0.08) 0%, rgba(160, 202, 146, 0.05) 55%, var(--bg-surface) 100%)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h1 className="fw-bold mb-0 text-primary" style={{ fontSize: "1.22rem", letterSpacing: "-0.015em" }}>
                {storeName}
              </h1>
              {planCode && (
                <Badge variant="accent">{String(planCode).toUpperCase()}</Badge>
              )}
              <Badge variant={sseConnected ? "success" : "info"} dot>
                {sseConnected ? "Jonli SSE faol" : t("overview.badge_sync")}
              </Badge>
            </div>
            <p className="text-secondary small mb-0 mt-1">
              {t("overview.subtitle")}
            </p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              loading={loading}
              icon={<IconRefresh size={14} />}
            >
              {t("overview.btn_refresh")}
            </Button>
            {onSendDailyReportNow && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleQuickReport}
                disabled={sendingReport}
                icon={<IconSend size={14} />}
              >
                {sendingReport ? "Yuborilmoqda..." : "Telegram Hisobot"}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={orders.length === 0}
              icon={<IconDownload size={14} />}
              onClick={() =>
                downloadCsvExport(
                  `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["ID", "Mijoz", "Username", "Mahsulot", "Summa", "Holat", "Kanal", "Sana"],
                  orders.map((o) => [o.id, o.customer, o.username, o.product, o.amount, o.status, o.channel, o.date])
                )
              }
            >
              Buyurtmalar CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<IconMessageDots size={14} />}
              onClick={() => onNavigateTab("inbox", takeoverCount > 0 ? "human" : "all")}
            >
              Jonli Chatlar{takeoverCount > 0 ? ` (${takeoverCount})` : ""}
            </Button>
          </div>
        </div>

        {/* Quick Shortcut Pills */}
        <div
          className="d-flex flex-wrap align-items-center gap-2 mt-3 pt-2.5 border-top"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            type="button"
            className="linear-btn linear-btn-ghost py-1 px-2.5 small"
            onClick={() => onNavigateTab("products")}
          >
            <IconPackage size={14} />
            <span>Mahsulotlar ({productsCount})</span>
          </button>
          <button
            type="button"
            className="linear-btn linear-btn-ghost py-1 px-2.5 small"
            onClick={() => onNavigateTab("orders")}
          >
            <IconShoppingCart size={14} />
            <span>Buyurtmalar ({totalOrders})</span>
          </button>
          <button
            type="button"
            className="linear-btn linear-btn-ghost py-1 px-2.5 small"
            onClick={() => onNavigateTab("analytics")}
          >
            <IconActivity size={14} />
            <span>Tahlil &amp; Konversiya</span>
          </button>
          <button
            type="button"
            className="linear-btn linear-btn-ghost py-1 px-2.5 small"
            onClick={() => onNavigateTab("settings")}
          >
            <IconSparkles size={14} />
            <span>AI Playground &amp; Sozlamalar</span>
          </button>
        </div>
      </div>

      {/* Urgent Operator Attention Banner */}
      {!loading && waitingTakeovers.length > 0 && (
        <div
          className="linear-card p-3 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2.5"
          style={{
            backgroundColor: "rgba(232, 182, 106, 0.08)",
            borderColor: "var(--warning-border)",
          }}
        >
          <div className="d-flex align-items-center gap-2.5">
            <span
              className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
              style={{
                width: 34,
                height: 34,
                backgroundColor: "var(--warning-subtle)",
                color: "var(--warning-text)",
              }}
            >
              <IconBellRinging size={17} />
            </span>
            <div>
              <div className="fw-semibold text-primary small">
                {takeoverCount} ta mijoz operator javobini kutmoqda
              </div>
              <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                {waitingTakeovers.map((c) => c.customer_name).join(", ")}
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-1.5">
            {waitingTakeovers.map((c) => (
              <Button
                key={`attn-${c.id}`}
                variant="secondary"
                size="xs"
                onClick={() => {
                  onSelectConversation(c.id);
                  onNavigateTab("inbox");
                }}
              >
                {c.customer_name} &rarr;
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 4 Upgraded KPI Cards */}
      <div className="row g-3">
        {/* 1. Conversations */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            style={{ borderTop: "2px solid var(--accent)" }}
            onClick={() => onNavigateTab("inbox", "all")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  {t("overview.stat_total_chats")}
                </span>
                <Badge variant="accent">
                  <IconMessageDots size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                  {totalConversations}
                </div>
              )}
            </div>
            <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
              <span>AI boshqaruvida:</span>
              <strong style={{ color: "var(--success-text)" }}>{aiActiveCount} ({aiPercentage}%)</strong>
            </div>
          </div>
        </div>

        {/* 2. Orders & Conversion */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            style={{ borderTop: "2px solid var(--success)" }}
            onClick={() => onNavigateTab("orders")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  Buyurtmalar &amp; Savdo
                </span>
                <Badge variant="success">
                  <IconShoppingCart size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="fs-2 fw-bold font-monospace mb-1" style={{ color: "var(--success-text)" }}>
                  {totalOrders}{" "}
                  <span className="text-secondary small fs-6 fw-normal">ta</span>
                </div>
              )}
            </div>
            <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
              <span>Tasdiqlangan: <strong className="text-primary">{confirmedOrdersCount}</strong></span>
              <span>Konv: <strong style={{ color: "var(--success-text)" }}>{conversionRate}%</strong></span>
            </div>
          </div>
        </div>

        {/* 3. Human Takeover */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            style={{ borderTop: "2px solid var(--warning)" }}
            onClick={() => onNavigateTab("inbox", "human")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  {t("overview.stat_takeover")}
                </span>
                <Badge variant="warning">
                  <IconHeadset size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                  {takeoverCount}
                </div>
              )}
            </div>
            <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
              <span>{t("overview.stat_takeover_desc")}</span>
              <span className="text-warning fw-semibold">{humanPercentage}%</span>
            </div>
          </div>
        </div>

        {/* 4. Catalog & Knowledge */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            style={{ borderTop: "2px solid var(--info)" }}
            onClick={() => onNavigateTab("products")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-bold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  Katalog &amp; Bilim Bazasi
                </span>
                <Badge variant="info">
                  <IconBooks size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                  {productsCount}{" "}
                  <span className="text-secondary small fs-6 fw-normal">mahsulot</span>
                </div>
              )}
            </div>
            <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
              <span>Bilim postlari: <strong className="text-primary">{totalPosts}</strong></span>
              <span>Kanallar: <strong className="text-primary">{channels.length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Setup Checklist (Shown while merchant setup is in progress) */}
      {!loading && completedSetupCount < setupSteps.length && (
        <Card>
          <CardHeader
            actions={
              <Badge variant="accent">
                {completedSetupCount} / {setupSteps.length} ({setupProgressPct}%)
              </Badge>
            }
          >
            <div className="d-flex align-items-center gap-2">
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-2"
                style={{
                  width: 30,
                  height: 30,
                  backgroundColor: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                  color: "var(--accent)",
                }}
              >
                <IconRocket size={16} />
              </span>
              <div>
                <CardTitle>
                  {language === "uz" ? "Tezkor ishga tushirish bosqichlari" : language === "ru" ? "Быстрый старт магазина" : "Quick Launch Checklist"}
                </CardTitle>
                <div className="text-secondary small">
                  {language === "uz"
                    ? "Do'koningizni to'liq avtomatlashtirish uchun quyidagi bosqichlarni bajaring."
                    : language === "ru"
                    ? "Выполните эти шаги для полной автоматизации магазина."
                    : "Complete these steps to launch your AI sales assistant."}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="rounded-full overflow-hidden mb-3" style={{ height: 5, backgroundColor: "var(--border-subtle)" }}>
              <div
                style={{
                  width: `${setupProgressPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--accent), #FF7A8C)",
                  transition: "width 300ms ease",
                }}
              />
            </div>
            <div className="row g-2.5">
              {setupSteps.map((step) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.id} className="col-12 col-sm-6 col-xl-3">
                    <button
                      type="button"
                      onClick={() => onNavigateTab(step.tab)}
                      className="w-100 text-start p-3 rounded-2 border d-flex align-items-start gap-2.5 h-100 transition-all"
                      style={{
                        backgroundColor: step.done ? "rgba(160, 202, 146, 0.06)" : "var(--bg-surface-elevated)",
                        borderColor: step.done ? "var(--success-border)" : "var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-2 flex-shrink-0 mt-0.5"
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: step.done ? "var(--success-subtle)" : "var(--accent-subtle)",
                          color: step.done ? "var(--success-text)" : "var(--accent-text)",
                        }}
                      >
                        {step.done ? <IconCircleCheck size={16} /> : <StepIcon size={15} />}
                      </span>
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex align-items-center justify-content-between gap-1">
                          <span className={`small fw-semibold ${step.done ? "text-secondary text-decoration-line-through" : "text-primary"}`}>
                            {step.title}
                          </span>
                          {!step.done && <IconChevronRight size={14} className="text-secondary flex-shrink-0" />}
                        </div>
                        <div className="text-secondary mt-0.5" style={{ fontSize: "0.74rem", lineHeight: 1.35 }}>
                          {step.desc}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interactive 7-Day Activity & Breakdown Charts */}
      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <Card className="h-100">
            <CardHeader
              actions={
                <Button variant="ghost" size="sm" onClick={() => onNavigateTab("analytics")}>
                  Batafsil tahlil
                </Button>
              }
            >
              <CardTitle>7 Kunlik Suhbatlar va Buyurtmalar</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityBarsChart
                data={activity7Days}
                primaryLabel="Suhbatlar"
                secondaryLabel="Buyurtmalar"
                primaryColor="var(--accent, #FF4C63)"
                secondaryColor="var(--success, #A0CA92)"
                height={175}
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-12 col-lg-5">
          <Card className="h-100">
            <CardHeader actions={<Badge variant="info">{conversionRate}% konversiya</Badge>}>
              <CardTitle>Muloqot va Savdo Taqsimoti</CardTitle>
            </CardHeader>
            <CardContent className="d-flex align-items-center justify-content-center">
              <DonutChart
                segments={[
                  { label: "AI boshqaruvida", value: aiActiveCount, color: "var(--success, #A0CA92)" },
                  { label: "Operator kutilmoqda", value: takeoverCount, color: "var(--warning, #E8B66A)" },
                  { label: "Buyurtmalar", value: totalOrders, color: "var(--accent, #FF4C63)" },
                ]}
                centerValue={totalConversations}
                centerLabel="suhbat"
                size={145}
                strokeWidth={15}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Operational Grid: Recent Conversations + Automation & Recent Orders */}
      <div className="row g-4">
        {/* Recent Conversations Stream */}
        <div className="col-12 col-lg-8">
          <Card className="h-100">
            <CardHeader
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab("inbox")}
                  icon={<IconArrowUpRight size={14} />}
                >
                  {t("overview.view_all")}
                </Button>
              }
            >
              <CardTitle>{t("overview.recent_conversations")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {conversations.length === 0 ? (
                <EmptyState
                  icon={<IconMessageDots size={32} />}
                  title={t("overview.empty_conversations_title")}
                  description={t("overview.empty_conversations_desc")}
                />
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="d-none d-md-block table-responsive">
                    <table className="linear-table">
                      <thead>
                        <tr>
                          <th>{t("overview.th_customer")}</th>
                          <th>{t("overview.th_status")}</th>
                          <th>{t("overview.th_reason")}</th>
                          <th>{t("overview.th_time")}</th>
                          <th style={{ textAlign: "right" }}>{t("overview.th_action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversations.slice(0, 6).map((conv) => (
                          <tr key={conv.id}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold"
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    backgroundColor: "var(--accent-subtle)",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  {conv.customer_name ? conv.customer_name.charAt(0).toUpperCase() : "M"}
                                </div>
                                <div>
                                  <div className="fw-medium text-primary" style={{ fontSize: "0.82rem" }}>
                                    {conv.customer_name}
                                  </div>
                                  <div className="text-secondary" style={{ fontSize: "0.7rem" }}>
                                    {conv.username ? `@${conv.username}` : `Chat ID: ${conv.chat_id}`}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {conv.status === "ai_active" ? (
                                <Badge variant="success" dot>
                                  {t("topbar.ai_online")}
                                </Badge>
                              ) : (
                                <Badge variant="warning" dot>
                                  {t("topbar.role_moderator")}
                                </Badge>
                              )}
                            </td>
                            <td className="text-secondary small text-truncate" style={{ maxWidth: "200px" }}>
                              {conv.handoff_reason || (language === "uz" ? "Mijoz maslahat so'radi" : "Customer inquiry")}
                            </td>
                            <td className="text-secondary small">
                              <span className="d-flex align-items-center gap-1">
                                <IconClock size={12} />
                                {formatTime(conv.last_message_at)}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => {
                                  onSelectConversation(conv.id);
                                  onNavigateTab("inbox");
                                }}
                              >
                                {t("overview.btn_open")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="d-md-none d-flex flex-column">
                    {conversations.slice(0, 6).map((conv) => (
                      <div key={`mob-conv-${conv.id}`} className="p-3 border-bottom border-subtle d-flex flex-column gap-2">
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <div className="d-flex align-items-center gap-2 min-w-0">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0"
                              style={{ width: 30, height: 30, backgroundColor: "var(--accent-subtle)", fontSize: "0.78rem" }}
                            >
                              {conv.customer_name ? conv.customer_name.charAt(0).toUpperCase() : "M"}
                            </div>
                            <div className="min-w-0">
                              <div className="fw-semibold text-primary small text-truncate">{conv.customer_name}</div>
                              <div className="text-secondary" style={{ fontSize: "0.7rem" }}>
                                {conv.username ? `@${conv.username}` : `Chat ID: ${conv.chat_id}`}
                              </div>
                            </div>
                          </div>
                          {conv.status === "ai_active" ? (
                            <Badge variant="success" dot>{t("topbar.ai_online")}</Badge>
                          ) : (
                            <Badge variant="warning" dot>{t("topbar.role_moderator")}</Badge>
                          )}
                        </div>
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <span className="text-secondary small text-truncate">
                            {conv.handoff_reason || (language === "uz" ? "Mijoz maslahat so'radi" : "Customer inquiry")}
                          </span>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              onSelectConversation(conv.id);
                              onNavigateTab("inbox");
                            }}
                          >
                            {t("overview.btn_open")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Store Automation Hub + Recent Orders */}
        <div className="col-12 col-lg-4 d-flex flex-column gap-3">
          {/* AI Engine & Store Automation Card */}
          <Card>
            <CardHeader
              actions={
                <Button variant="ghost" size="sm" onClick={() => onNavigateTab("settings")}>
                  Sozlash
                </Button>
              }
            >
              <CardTitle>{t("overview.card_ai_engine")}</CardTitle>
            </CardHeader>
            <CardContent className="d-flex flex-column gap-2">
              <div
                className="d-flex align-items-center justify-content-between px-3 py-2 rounded-2 border"
                style={{ backgroundColor: "var(--bg-surface-elevated)", borderColor: "var(--border-subtle)" }}
              >
                <div className="d-flex align-items-center gap-2">
                  <IconCpu size={15} style={{ color: "var(--accent)" }} />
                  <span className="small text-secondary">{t("overview.ai_model")}</span>
                </div>
                <span className="small fw-semibold text-primary font-monospace">{aiModel}</span>
              </div>

              <div
                className="d-flex align-items-center justify-content-between px-3 py-2 rounded-2 border"
                style={{ backgroundColor: "var(--bg-surface-elevated)", borderColor: "var(--border-subtle)" }}
              >
                <div className="d-flex align-items-center gap-2">
                  <IconBrandTelegram size={15} style={{ color: "#229ed9" }} />
                  <span className="small text-secondary">{t("overview.telegram_bot")}</span>
                </div>
                <Badge variant={botConfigured || totalConversations > 0 ? "success" : "warning"} dot>
                  {botConfigured || totalConversations > 0 ? t("overview.bot_connected") : "Sozlanmagan"}
                </Badge>
              </div>

              <div
                className="d-flex align-items-center justify-content-between px-3 py-2 rounded-2 border cursor-pointer"
                style={{ backgroundColor: "var(--bg-surface-elevated)", borderColor: "var(--border-subtle)" }}
                onClick={() => onNavigateTab("settings")}
              >
                <div className="d-flex align-items-center gap-2">
                  <IconRobot size={15} style={{ color: "var(--info)" }} />
                  <span className="small text-secondary">Smart Follow-up</span>
                </div>
                <Badge variant={followupEnabled ? "success" : "default"}>
                  {followupEnabled ? "Yoqilgan" : "O'chirilgan"}
                </Badge>
              </div>

              <div
                className="d-flex align-items-center justify-content-between px-3 py-2 rounded-2 border cursor-pointer"
                style={{ backgroundColor: "var(--bg-surface-elevated)", borderColor: "var(--border-subtle)" }}
                onClick={() => onNavigateTab("settings")}
              >
                <div className="d-flex align-items-center gap-2">
                  <IconCreditCard size={15} style={{ color: "var(--success)" }} />
                  <span className="small text-secondary">Onlayn To&apos;lov</span>
                </div>
                <Badge variant={paymentProvider ? "info" : "default"}>
                  {paymentProvider ? paymentProvider.toUpperCase() : "O'chirilgan"}
                </Badge>
              </div>

              <div
                className="d-flex align-items-center justify-content-between px-3 py-2 rounded-2 border cursor-pointer"
                style={{ backgroundColor: "var(--bg-surface-elevated)", borderColor: "var(--border-subtle)" }}
                onClick={() => onNavigateTab("settings")}
              >
                <div className="d-flex align-items-center gap-2">
                  <IconSend size={15} style={{ color: "var(--warning)" }} />
                  <span className="small text-secondary">Kunlik Hisobot</span>
                </div>
                <Badge variant={dailyReportEnabled ? "success" : "default"}>
                  {dailyReportEnabled ? `${String(dailyReportHour).padStart(2, "0")}:00` : "O'chirilgan"}
                </Badge>
              </div>

              {usageMessagesItem && usageMessagesItem.limit > 0 && (
                <div
                  className="px-3 py-2.5 rounded-2 border mt-1"
                  style={{ backgroundColor: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}
                >
                  <div className="d-flex align-items-center justify-content-between small mb-1">
                    <span className="text-secondary">Oylik AI xabar limiti</span>
                    <span className="font-monospace fw-semibold text-primary">
                      {usageMessagesItem.used} / {usageMessagesItem.limit}
                    </span>
                  </div>
                  <div className="rounded-pill overflow-hidden" style={{ height: 5, backgroundColor: "var(--border-subtle)" }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.round(usageMessagesItem.percentage || 0))}%`,
                        height: "100%",
                        backgroundColor:
                          usageMessagesItem.percentage >= 85
                            ? "var(--danger, #EF4444)"
                            : "var(--accent, #FF4C63)",
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders Overview */}
          <Card>
            <CardHeader
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab("orders")}
                  icon={<IconArrowUpRight size={14} />}
                >
                  {t("overview.btn_view_catalog")}
                </Button>
              }
            >
              <CardTitle>{t("overview.recent_orders_title")} ({totalOrders})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="p-3 text-center text-secondary small">
                  {t("overview.empty_orders")}
                </div>
              ) : (
                <div className="d-flex flex-column">
                  {orders.slice(0, 4).map((ord) => (
                    <div
                      key={ord.id}
                      className="d-flex align-items-center justify-content-between p-2.5 border-bottom border-subtle cursor-pointer"
                      onClick={() => onNavigateTab("orders")}
                    >
                      <div className="text-truncate me-2">
                        <div className="fw-medium text-primary small text-truncate">{ord.customer}</div>
                        <div className="text-secondary small text-truncate" style={{ fontSize: "0.72rem" }}>
                          {ord.product}
                        </div>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <div className="fw-bold text-success small">{ord.amount}</div>
                        <Badge
                          variant={
                            ["confirmed", "paid", "completed"].includes((ord.status || "").toLowerCase())
                              ? "success"
                              : ord.status === "Processing"
                              ? "info"
                              : "warning"
                          }
                        >
                          {ord.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
