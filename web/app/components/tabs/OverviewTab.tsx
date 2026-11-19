"use client";

import React from "react";
import { useLanguage } from "../../lib/i18n";
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
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../layout/PageHeader";

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
  aiModel?: string;
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
  aiModel = "gemini-3.1-flash-lite",
  onSelectConversation,
  onNavigateTab,
  onRefresh,
  loading,
}: OverviewTabProps) {
  const { language, t } = useLanguage();
  const totalConversations = overview?.conversations ?? conversations.length;
  const aiActiveCount = overview?.ai_active ?? conversations.filter((c) => c.status === "ai_active").length;
  const takeoverCount = overview?.human_takeover ?? conversations.filter((c) => c.status === "human_takeover").length;
  const totalPosts = overview?.knowledge_posts ?? (channels.reduce((acc, ch) => acc + (ch.posts_count || 0), 0));
  const totalOrders = overview?.orders ?? orders.length;

  const aiPercentage = totalConversations > 0 ? Math.round((aiActiveCount / totalConversations) * 100) : 0;
  const humanPercentage = totalConversations > 0 ? Math.round((takeoverCount / totalConversations) * 100) : 0;

  const formatTime = (ts?: string | null) => {
    if (!ts) return "-";
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.overview")}
        title={t("overview.title")}
        description={t("overview.subtitle")}
        badge={{ text: t("overview.badge_sync"), variant: "success" }}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            loading={loading}
            icon={<IconRefresh size={14} />}
          >
            {t("overview.btn_refresh")}
          </Button>
        }
      />

      {/* 4 Linear KPI Metrics */}
      <div className="row g-3 mb-4">
        {/* Total Conversations */}
        {/* Total Chats */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            onClick={() => onNavigateTab("inbox", "all")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  {t("overview.stat_total_chats")}
                </span>
                <Badge variant="accent">
                  <IconMessageDots size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
                  {totalConversations}
                </div>
              )}
            </div>
            {loading ? (
              <div className="skeleton-shimmer skeleton-text w-75 mt-1" />
            ) : (
              <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                <span>{t("overview.stat_total_chats_desc")}</span>
                <span className="text-primary fw-medium">100%</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Active */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            onClick={() => onNavigateTab("inbox", "ai")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  {t("overview.stat_ai_active")}
                </span>
                <Badge variant="success">
                  <IconRobot size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
                  {aiActiveCount}
                </div>
              )}
            </div>
            {loading ? (
              <div className="skeleton-shimmer skeleton-text w-75 mt-1" />
            ) : (
              <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                <span>{t("overview.stat_ai_active_desc")}</span>
                <span className="text-success fw-medium">{aiPercentage}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Human Takeover */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            onClick={() => onNavigateTab("inbox", "human")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  {t("overview.stat_takeover")}
                </span>
                <Badge variant="warning">
                  <IconHeadset size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
                  {takeoverCount}
                </div>
              )}
            </div>
            {loading ? (
              <div className="skeleton-shimmer skeleton-text w-75 mt-1" />
            ) : (
              <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                <span>{t("overview.stat_takeover_desc")}</span>
                <span className="text-warning fw-medium">{humanPercentage}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Knowledge Base Posts */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="linear-card p-3.5 cursor-pointer transition-all h-100 d-flex flex-column justify-content-between"
            onClick={() => onNavigateTab("knowledge")}
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  {t("overview.stat_posts")}
                </span>
                <Badge variant="info">
                  <IconBooks size={12} />
                </Badge>
              </div>
              {loading ? (
                <div className="skeleton-shimmer skeleton-title w-50 mb-2 mt-1" style={{ height: "28px" }} />
              ) : (
                <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
                  {totalPosts}
                </div>
              )}
            </div>
            {loading ? (
              <div className="skeleton-shimmer skeleton-text w-75 mt-1" />
            ) : (
              <div className="text-secondary small d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: "var(--border-subtle)", fontSize: "0.78rem" }}>
                <span>{t("overview.stat_posts_desc")}</span>
                <span className="text-primary fw-medium">{channels.length} {language === "uz" ? "ta" : "channels"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Conversations & Sidebar Details */}
      <div className="row g-4">
        {/* Recent Conversations Stream */}
        <div className="col-12 col-lg-8">
          <Card>
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
                <div className="table-responsive">
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Info: System Status & Recent Orders */}
        <div className="col-12 col-lg-4 d-flex flex-column gap-3">
          {/* AI Engine Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("overview.card_ai_engine")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="d-flex flex-column" style={{ gap: "8px" }}>
                <div
                  className="d-flex align-items-center justify-content-between px-3 py-2.5 rounded-2 border"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                    borderRadius: "8px",
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "26px", height: "26px", backgroundColor: "var(--accent-subtle)", borderRadius: "6px" }}
                    >
                      <IconCpu size={15} style={{ color: "var(--accent)" }} />
                    </div>
                    <span className="small text-secondary">{t("overview.ai_model")}</span>
                  </div>
                  <span className="small fw-semibold text-primary font-monospace">{aiModel}</span>
                </div>

                <div
                  className="d-flex align-items-center justify-content-between px-3 py-2.5 rounded-2 border"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                    borderRadius: "8px",
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "26px", height: "26px", backgroundColor: "rgba(34, 158, 217, 0.15)", borderRadius: "6px" }}
                    >
                      <IconBrandTelegram size={15} style={{ color: "#229ed9" }} />
                    </div>
                    <span className="small text-secondary">{t("overview.telegram_bot")}</span>
                  </div>
                  <Badge variant="success" dot>{t("overview.bot_connected")}</Badge>
                </div>

                <div
                  className="d-flex align-items-center justify-content-between px-3 py-2.5 rounded-2 border"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                    borderRadius: "8px",
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "26px", height: "26px", backgroundColor: "var(--success-subtle)", borderRadius: "6px" }}
                    >
                      <IconActivity size={15} style={{ color: "var(--success)" }} />
                    </div>
                    <span className="small text-secondary">{t("overview.avg_response")}</span>
                  </div>
                  <span className="small fw-semibold text-primary">{t("overview.avg_response_val")}</span>
                </div>
              </div>
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
                  {orders.slice(0, 3).map((ord) => (
                    <div
                      key={ord.id}
                      className="d-flex align-items-center justify-content-between p-2.5 border-bottom border-subtle"
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
                            ord.status === "Confirmed" || ord.status === "Completed"
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
