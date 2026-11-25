"use client";

import React, { useState } from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconBooks,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconExternalLink,
  IconSparkles,
  IconBrandTelegram,
  IconFilter,
  IconSearch,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../layout/PageHeader";

export interface ConnectedChannelItem {
  id: number;
  channel_username: string;
  title?: string | null;
  is_active: boolean;
  posts_count: number;
  last_synced_at?: string | null;
}

export interface KnowledgePostItem {
  id: number;
  channel_username: string;
  telegram_message_id: number;
  text: string;
  image_description: string;
  source_url?: string | null;
}

export interface KnowledgeTabProps {
  channels: ConnectedChannelItem[];
  posts: KnowledgePostItem[];
  channelFilter: string;
  setChannelFilter: (val: string) => void;
  newChannelInput: string;
  setNewChannelInput: (val: string) => void;
  onConnectChannel: (e: React.FormEvent) => void;
  onSyncChannel: (username?: string) => void;
  onDeleteChannel: (username: string) => void;
  onDeletePost: (id: number, messageId: number) => void;
  onExtractProducts: () => void;
  onOpenPlayground?: () => void;
  busy: boolean;
}

export function KnowledgeTab({
  channels,
  posts,
  channelFilter,
  setChannelFilter,
  newChannelInput,
  setNewChannelInput,
  onConnectChannel,
  onSyncChannel,
  onDeleteChannel,
  onDeletePost,
  onExtractProducts,
  onOpenPlayground,
  busy,
}: KnowledgeTabProps) {
  const { language, t } = useLanguage();
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid?: boolean;
    title?: string;
    username?: string;
    subscribers_count?: number | null;
    error?: string;
  } | null>(null);

  const handleVerifyChannel = async () => {
    const raw = newChannelInput.trim();
    if (!raw) return;
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch("/api/proxy?path=/admin/channels/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: raw }),
      });
      const data = await res.json();
      setVerificationResult(data);
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        error: err.message || "Telegram bilan bog'lanishda xatolik",
      });
    } finally {
      setVerifying(false);
    }
  };

  const filteredPosts = posts.filter(
    (p) => channelFilter === "all" || p.channel_username === channelFilter
  );

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
        breadcrumbs={t("breadcrumb.knowledge")}
        title={t("knowledge.title")}
        description={t("knowledge.subtitle")}
        badge={{
          text: language === "uz" ? `${channels.length} ta faol kanal` : `${channels.length} active channels`,
          variant: "accent",
        }}
        actions={
          <div className="d-flex align-items-center flex-wrap gap-2">
            {onOpenPlayground && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenPlayground}
                icon={<IconSparkles size={14} style={{ color: "var(--accent)" }} />}
              >
                {t("playground.open_btn")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onExtractProducts}
              disabled={busy || posts.length === 0}
              icon={<IconSparkles size={14} style={{ color: "var(--accent)" }} />}
            >
              {t("knowledge.btn_extract")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSyncChannel()}
              disabled={busy || channels.length === 0}
              loading={busy}
              icon={<IconRefresh size={14} />}
            >
              {t("knowledge.btn_sync_all")}
            </Button>
          </div>
        }
      />

      {/* Connected Channels Management Card */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("knowledge.card_channels")} ({channels.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Add Channel Form with Verification */}
          <form
            onSubmit={(e) => {
              setVerificationResult(null);
              onConnectChannel(e);
            }}
            className="mb-3"
          >
            <div className="d-flex flex-column flex-sm-row gap-2">
              <input
                type="text"
                aria-label="Telegram channel username or URL"
                placeholder={t("knowledge.input_placeholder")}
                value={newChannelInput}
                onChange={(e) => {
                  setNewChannelInput(e.target.value);
                  setVerificationResult(null);
                }}
                disabled={busy}
                className="linear-input flex-grow-1"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy || verifying || !newChannelInput.trim()}
                loading={verifying}
                onClick={handleVerifyChannel}
                icon={<IconSearch size={15} />}
              >
                {t("knowledge.btn_verify")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !newChannelInput.trim()}
                icon={<IconPlus size={15} />}
              >
                {t("knowledge.btn_connect")}
              </Button>
            </div>

            {/* Verification Result Feedback */}
            {verificationResult && (
              <div className="mt-2.5">
                {verificationResult.valid ? (
                  <div
                    className="p-2.5 px-3 rounded-2 d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#10b981",
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <IconCheck size={18} className="flex-shrink-0" />
                      <div className="small">
                        <strong className="text-white">{verificationResult.title}</strong>
                        <span className="opacity-80 ms-2 font-monospace">@{verificationResult.username}</span>
                        {verificationResult.subscribers_count != null && (
                          <span
                            className="ms-2 badge rounded-pill"
                            style={{
                              backgroundColor: "rgba(16, 185, 129, 0.2)",
                              color: "#10b981",
                              fontSize: "0.72rem",
                            }}
                          >
                            {verificationResult.subscribers_count.toLocaleString()} {t("knowledge.subscribers")}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="small text-secondary fw-medium" style={{ fontSize: "0.78rem" }}>
                      ✓ {t("knowledge.verified_channel")}
                    </span>
                  </div>
                ) : (
                  <div
                    className="p-2.5 px-3 rounded-2 d-flex align-items-center gap-2"
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                    }}
                  >
                    <IconAlertCircle size={18} className="flex-shrink-0" />
                    <span className="small">{verificationResult.error || "Kanal topilmadi"}</span>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Channels Table */}
          <div className="table-responsive">
            <table className="linear-table">
              <thead>
                <tr>
                  <th>{t("knowledge.th_channel")}</th>
                  <th>{t("knowledge.th_status")}</th>
                  <th>{t("knowledge.th_posts_count")}</th>
                  <th>{t("knowledge.th_last_sync")}</th>
                  <th style={{ textAlign: "right" }}>{t("knowledge.th_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {channels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4 small">
                      {t("knowledge.empty")}
                    </td>
                  </tr>
                ) : (
                  channels.map((ch) => (
                    <tr key={ch.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <IconBrandTelegram size={16} style={{ color: "#229ed9" }} />
                          <span className="font-monospace fw-semibold text-primary">@{ch.channel_username}</span>
                          <a
                            href={`https://t.me/${ch.channel_username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-secondary small d-flex align-items-center gap-0.5"
                          >
                            <IconExternalLink size={12} /> {t("knowledge.btn_open_link")}
                          </a>
                        </div>
                      </td>
                      <td>
                        <Badge variant="success" dot>Faol</Badge>
                      </td>
                      <td className="fw-medium text-primary">
                        {ch.posts_count} ta post
                      </td>
                      <td className="text-secondary small">
                        {formatTime(ch.last_synced_at)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="d-flex align-items-center justify-content-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => onSyncChannel(ch.channel_username)}
                            disabled={busy}
                            icon={<IconRefresh size={13} />}
                          >
                            Sinxron
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => onDeleteChannel(ch.channel_username)}
                            disabled={busy}
                            icon={<IconTrash size={13} />}
                          >
                            O'chirish
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Posts List & Filters */}
      <Card>
        <CardHeader
          actions={
            channels.length > 1 && (
              <div className="d-flex align-items-center gap-1.5">
                <IconFilter size={14} className="text-secondary" />
                <select
                  aria-label="Kanal bo'yicha saralash"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="linear-input py-1"
                  style={{ width: "auto", fontSize: "0.78rem" }}
                >
                  <option value="all">Barcha kanallar ({posts.length})</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.channel_username}>
                      @{ch.channel_username} ({posts.filter((p) => p.channel_username === ch.channel_username).length})
                    </option>
                  ))}
                </select>
              </div>
            )
          }
        >
          <CardTitle>
            Sinxronlangan Postlar Bazasi ({filteredPosts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-responsive">
            <table className="linear-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>ID</th>
                  <th>Post Matni</th>
                  <th>Kanal</th>
                  <th>AI Rasm Tahlili (Vision)</th>
                  <th>Havola</th>
                  <th style={{ width: "60px", textAlign: "right" }}>Amal</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-5 small">
                      Postlar mavjud emas. Yuqoridagi kanallarni sinxronlang.
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((p) => (
                    <tr key={p.id}>
                      <td className="text-secondary font-monospace small">
                        #{p.telegram_message_id}
                      </td>
                      <td style={{ maxWidth: "380px" }}>
                        <div className="text-truncate fw-medium text-primary small">
                          {p.text ? p.text.slice(0, 110) + "..." : "Matn mavjud emas"}
                        </div>
                      </td>
                      <td>
                        <Badge variant="accent">@{p.channel_username}</Badge>
                      </td>
                      <td className="text-secondary small text-truncate" style={{ maxWidth: "260px" }}>
                        {p.image_description || "Rasm tavsifi yo'q"}
                      </td>
                      <td>
                        {p.source_url ? (
                          <a
                            href={p.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-secondary small d-flex align-items-center gap-1"
                          >
                            <IconExternalLink size={12} /> Post
                          </a>
                        ) : (
                          <span className="text-secondary small">-</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Button
                          variant="danger"
                          size="xs"
                          aria-label={`Post #${p.telegram_message_id} ni o'chirish`}
                          onClick={() => onDeletePost(p.id, p.telegram_message_id)}
                          disabled={busy}
                          icon={<IconTrash size={13} />}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
