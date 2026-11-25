"use client";

import React, { useState } from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconUsers,
  IconSearch,
  IconMessageDots,
  IconClock,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../layout/PageHeader";

export interface CustomerConversationItem {
  id: number;
  customer_name: string;
  username?: string | null;
  chat_id: number;
  status: string;
  last_message_at?: string | null;
}

export interface CustomersTabProps {
  conversations: CustomerConversationItem[];
  onSelectConversation: (id: number) => void;
  onNavigateInbox: () => void;
  loading?: boolean;
}

export function CustomersTab({
  conversations,
  onSelectConversation,
  onNavigateInbox,
  loading = false,
}: CustomersTabProps) {
  const { language, t } = useLanguage();
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      String(c.chat_id).includes(q)
    );
  });

  const formatTime = (ts?: string | null) => {
    if (!ts) return "-";
    try {
      const d = new Date(ts);
      return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.customers")}
        title={t("customers.title")}
        description={t("customers.subtitle")}
        badge={{
          text: language === "uz" ? `${conversations.length} ta mijoz` : `${conversations.length} customers`,
          variant: "accent",
        }}
      />

      <Card>
        <CardHeader
          actions={
            <div className="position-relative" style={{ width: "220px" }}>
              <IconSearch
                size={14}
                className="position-absolute start-0 ms-2.5 top-50 translate-middle-y text-secondary"
              />
              <input
                type="text"
                placeholder={t("customers.search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="linear-input ps-5 py-1"
                style={{ fontSize: "0.78rem" }}
              />
            </div>
          }
        >
          <CardTitle>{t("customers.card_title")} ({loading ? "..." : filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && filtered.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={32} />}
              title={search.trim() ? "Mijoz topilmadi" : "Hozircha mijozlar mavjud emas"}
              description={
                search.trim()
                  ? `"${search}" so'rovi bo'yicha hech qanday mijoz topilmadi.`
                  : "Telegram botingizga mijozlar xabar yozganda yoki buyurtma berganda, ular bu yerda avtomatik paydo bo'ladi."
              }
            />
          ) : (
            <>
              <div className="d-none d-md-block table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th>{t("customers.th_name")}</th>
                      <th>{t("customers.th_username")}</th>
                      <th className="d-none d-sm-table-cell">{t("customers.th_chat_id")}</th>
                      <th>{t("customers.th_status")}</th>
                      <th className="d-none d-md-table-cell">{t("customers.th_last_active")}</th>
                      <th style={{ textAlign: "right" }}>{t("customers.th_action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={`skel-cust-${i}`}>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="skeleton-shimmer" style={{ width: 30, height: 30, borderRadius: "50%" }} />
                              <div className="skeleton-shimmer skeleton-text w-50" style={{ height: 14 }} />
                            </div>
                          </td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: 12 }} /></td>
                          <td className="d-none d-sm-table-cell"><div className="skeleton-shimmer skeleton-text w-50" style={{ height: 12 }} /></td>
                          <td><div className="skeleton-shimmer skeleton-text w-50" style={{ height: 18, borderRadius: 10 }} /></td>
                          <td className="d-none d-md-table-cell"><div className="skeleton-shimmer skeleton-text w-50" style={{ height: 12 }} /></td>
                          <td style={{ textAlign: "right" }}>
                            <div className="skeleton-shimmer skeleton-text ms-auto" style={{ width: 80, height: 28, borderRadius: 6 }} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      filtered.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0"
                                style={{
                                  width: "30px",
                                  height: "30px",
                                  backgroundColor: "var(--accent-subtle)",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {c.customer_name ? c.customer_name.charAt(0).toUpperCase() : "M"}
                              </div>
                              <span className="fw-medium text-primary small text-truncate" style={{ maxWidth: 160 }}>
                                {c.customer_name}
                              </span>
                            </div>
                          </td>
                          <td className="text-secondary small">
                            {c.username ? `@${c.username}` : "-"}
                          </td>
                          <td className="font-monospace text-secondary small d-none d-sm-table-cell">
                            {c.chat_id}
                          </td>
                          <td>
                            {c.status === "ai_active" ? (
                              <Badge variant="success" dot>{t("customers.status_ai")}</Badge>
                            ) : (
                              <Badge variant="warning" dot>{t("customers.status_operator")}</Badge>
                            )}
                          </td>
                          <td className="text-secondary small d-none d-md-table-cell">
                            <span className="d-flex align-items-center gap-1">
                              <IconClock size={12} />
                              {formatTime(c.last_message_at)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                onSelectConversation(c.id);
                                onNavigateInbox();
                              }}
                              icon={<IconMessageDots size={14} />}
                            >
                              {t("customers.btn_open_chat")}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="d-md-none d-flex flex-column">
                {loading
                  ? [...Array(4)].map((_, i) => (
                      <div key={`skel-mob-cust-${i}`} className="p-3 border-bottom border-subtle space-y-2">
                        <div className="skeleton-shimmer skeleton-text w-50" style={{ height: 14 }} />
                        <div className="skeleton-shimmer skeleton-text w-75" style={{ height: 12 }} />
                      </div>
                    ))
                  : filtered.map((c) => (
                      <div key={`mob-cust-${c.id}`} className="p-3 border-bottom border-subtle d-flex flex-column gap-2">
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <div className="d-flex align-items-center gap-2 min-w-0">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0"
                              style={{ width: 32, height: 32, backgroundColor: "var(--accent-subtle)", fontSize: "0.82rem" }}
                            >
                              {c.customer_name ? c.customer_name.charAt(0).toUpperCase() : "M"}
                            </div>
                            <div className="min-w-0">
                              <div className="fw-semibold text-primary small text-truncate">{c.customer_name}</div>
                              <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
                                {c.username ? `@${c.username}` : `ID: ${c.chat_id}`}
                              </div>
                            </div>
                          </div>
                          {c.status === "ai_active" ? (
                            <Badge variant="success" dot>{t("customers.status_ai")}</Badge>
                          ) : (
                            <Badge variant="warning" dot>{t("customers.status_operator")}</Badge>
                          )}
                        </div>
                        <div className="d-flex align-items-center justify-content-between pt-1">
                          <span className="text-secondary d-flex align-items-center gap-1" style={{ fontSize: "0.72rem" }}>
                            <IconClock size={12} />
                            {formatTime(c.last_message_at)}
                          </span>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              onSelectConversation(c.id);
                              onNavigateInbox();
                            }}
                            icon={<IconMessageDots size={13} />}
                          >
                            {t("customers.btn_open_chat")}
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
  );
}
