"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  IconAlertCircle,
  IconBolt,
  IconDatabase,
  IconExternalLink,
  IconHeadset,
  IconPackage,
  IconPhoto,
  IconRobot,
  IconSend,
  IconSparkles,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import { useLanguage } from "../../lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export interface PlaygroundEvidenceItem {
  id: number;
  telegram_message_id: number;
  channel_username: string;
  snippet: string;
  has_photo: boolean;
  source_url?: string | null;
}

export interface PlaygroundApiResponse {
  ok: boolean;
  reply: string;
  intent?: string | null;
  handoff?: boolean;
  reason?: string | null;
  order_created?: boolean;
  order_data?: Record<string, any> | null;
  attach_photo?: boolean;
  source_post_id?: number | null;
  latency_ms?: number;
  evidence?: PlaygroundEvidenceItem[];
}

export interface PlaygroundTurn {
  id: string;
  role: "customer" | "assistant";
  text: string;
  intent?: string | null;
  handoff?: boolean;
  reason?: string | null;
  order_created?: boolean;
  order_data?: Record<string, any> | null;
  attach_photo?: boolean;
  source_post_id?: number | null;
  latency_ms?: number;
  evidence?: PlaygroundEvidenceItem[];
  isError?: boolean;
}

export interface AiPlaygroundPanelProps {
  activeOrgId: number;
  aiModel: string;
  aiTemperature: number;
  customPromptInput: string;
  onRunPlayground?: (payload: {
    message: string;
    history: Array<{ direction: "customer" | "assistant"; text: string }>;
    custom_system_prompt?: string;
    ai_temperature?: number;
    ai_model?: string;
  }) => Promise<PlaygroundApiResponse>;
}

export function AiPlaygroundPanel({
  activeOrgId,
  aiModel,
  aiTemperature,
  customPromptInput,
  onRunPlayground,
}: AiPlaygroundPanelProps) {
  const { t } = useLanguage();
  const [turns, setTurns] = useState<PlaygroundTurn[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns([]);
    setExpandedEvidenceId(null);
  }, [activeOrgId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, running]);

  const starterPrompts = [
    t("playground.chip_hello"),
    t("playground.chip_price"),
    t("playground.chip_delivery"),
    t("playground.chip_order"),
  ];

  const handleSend = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || running || !onRunPlayground) return;

    const historyForApi = turns
      .filter((item) => !item.isError)
      .slice(-10)
      .map((item) => ({
        direction: item.role,
        text: item.text,
      }));

    const userTurn: PlaygroundTurn = {
      id: `u-${Date.now()}`,
      role: "customer",
      text,
    };

    setTurns((prev) => [...prev, userTurn]);
    if (rawText === undefined) setInput("");
    setRunning(true);

    try {
      const res = await onRunPlayground({
        message: text,
        history: historyForApi,
        custom_system_prompt: customPromptInput,
        ai_temperature: aiTemperature,
        ai_model: aiModel,
      });
      const aiTurn: PlaygroundTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.reply || "-",
        intent: res.intent,
        handoff: res.handoff,
        reason: res.reason,
        order_created: res.order_created,
        order_data: res.order_data,
        attach_photo: res.attach_photo,
        source_post_id: res.source_post_id,
        latency_ms: res.latency_ms,
        evidence: res.evidence || [],
      };
      setTurns((prev) => [...prev, aiTurn]);
    } catch (err: any) {
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: err?.message || t("playground.error_generic"),
          isError: true,
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card id="ai-playground">
      <CardHeader
        actions={
          <div className="d-flex align-items-center gap-1.5">
            <Badge variant="accent" dot>{t("playground.live_preview")}</Badge>
            {turns.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTurns([]);
                  setExpandedEvidenceId(null);
                }}
                icon={<IconTrash size={13} />}
                title={t("playground.btn_clear")}
              >
                {t("playground.btn_clear")}
              </Button>
            )}
          </div>
        }
      >
        <CardTitle className="d-flex align-items-center gap-2">
          <IconSparkles size={16} style={{ color: "var(--accent)" }} />
          <span>{t("playground.title")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-secondary small mb-3" style={{ fontSize: "0.78rem" }}>
          {t("playground.subtitle")}
        </p>

        {/* Quick starter chips */}
        <div className="d-flex flex-wrap gap-1.5 mb-3">
          {starterPrompts.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={running || !onRunPlayground}
              onClick={() => void handleSend(chip)}
              className="btn-linear px-2.5 py-1"
              style={{
                fontSize: "0.74rem",
                borderRadius: "999px",
                backgroundColor: "var(--bg-surface-elevated)",
                color: "var(--text-primary)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Simulated Conversation Stream */}
        <div
          ref={scrollRef}
          className="rounded-2 p-3 mb-3 d-flex flex-column gap-2.5"
          style={{
            backgroundColor: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
            minHeight: "260px",
            maxHeight: "380px",
            overflowY: "auto",
          }}
        >
          {turns.length === 0 ? (
            <div className="my-auto text-center py-4 px-2">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: "var(--bg-surface-elevated)",
                  color: "var(--accent)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <IconRobot size={20} />
              </div>
              <div className="small fw-medium text-primary mb-1">{t("playground.empty_title")}</div>
              <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                {t("playground.empty_desc")}
              </div>
            </div>
          ) : (
            turns.map((turn) => {
              const isCustomer = turn.role === "customer";
              const isEvidenceOpen = expandedEvidenceId === turn.id;
              return (
                <div
                  key={turn.id}
                  className={`d-flex flex-column ${isCustomer ? "align-items-end" : "align-items-start"}`}
                >
                  <div
                    className="d-flex align-items-center gap-1 mb-1 text-secondary"
                    style={{ fontSize: "0.68rem" }}
                  >
                    {isCustomer ? <IconUser size={11} /> : <IconRobot size={11} />}
                    <span>{isCustomer ? t("playground.role_customer") : t("playground.role_bot")}</span>
                    {!isCustomer && turn.latency_ms !== undefined && (
                      <span className="font-monospace ms-1 d-inline-flex align-items-center gap-0.5">
                        <IconBolt size={10} />
                        {turn.latency_ms} ms
                      </span>
                    )}
                  </div>

                  <div
                    className="px-3 py-2 rounded-2 small"
                    style={{
                      maxWidth: "92%",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      backgroundColor: turn.isError
                        ? "rgba(239, 68, 68, 0.12)"
                        : isCustomer
                        ? "var(--accent)"
                        : "var(--bg-surface-elevated)",
                      color: isCustomer ? "#ffffff" : turn.isError ? "var(--danger)" : "var(--text-primary)",
                      border: turn.isError
                        ? "1px solid rgba(239, 68, 68, 0.35)"
                        : isCustomer
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    }}
                  >
                    {turn.text}
                  </div>

                  {/* AI Diagnostics Row */}
                  {!isCustomer && !turn.isError && (
                    <div className="d-flex flex-wrap align-items-center gap-1.5 mt-1.5" style={{ maxWidth: "94%" }}>
                      {turn.intent && (
                        <Badge variant="default">{turn.intent}</Badge>
                      )}
                      {turn.handoff && (
                        <Badge variant="warning">
                          <IconHeadset size={11} className="me-1" />
                          {t("playground.badge_handoff")}
                        </Badge>
                      )}
                      {turn.attach_photo && (
                        <Badge variant="info">
                          <IconPhoto size={11} className="me-1" />
                          #{turn.source_post_id}
                        </Badge>
                      )}
                      {turn.order_created && (
                        <Badge variant="success">
                          <IconPackage size={11} className="me-1" />
                          {t("playground.badge_order")}
                        </Badge>
                      )}
                      {turn.evidence && turn.evidence.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedEvidenceId(isEvidenceOpen ? null : turn.id)}
                          className="btn-linear px-2 py-0.5 d-inline-flex align-items-center gap-1"
                          style={{ fontSize: "0.7rem" }}
                        >
                          <IconDatabase size={11} />
                          <span>
                            {t("playground.sources_count", { count: turn.evidence.length })}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Simulated Order Preview */}
                  {turn.order_created && turn.order_data && (
                    <div
                      className="mt-1.5 p-2 rounded-2 w-100 small"
                      style={{
                        maxWidth: "94%",
                        backgroundColor: "rgba(34, 197, 94, 0.08)",
                        border: "1px solid rgba(34, 197, 94, 0.25)",
                        fontSize: "0.74rem",
                      }}
                    >
                      <div className="fw-semibold text-success mb-1">{t("playground.simulated_order_title")}</div>
                      <div className="text-secondary">
                        {turn.order_data.customer_name || "-"} / {turn.order_data.phone || "-"}
                      </div>
                      <div className="text-primary">{turn.order_data.product_summary || "-"}</div>
                    </div>
                  )}

                  {/* Handoff Reason Preview */}
                  {turn.handoff && turn.reason && (
                    <div
                      className="mt-1 d-flex align-items-center gap-1 text-warning"
                      style={{ fontSize: "0.72rem" }}
                    >
                      <IconAlertCircle size={12} />
                      <span>{turn.reason}</span>
                    </div>
                  )}

                  {/* Expandable RAG Evidence List */}
                  {isEvidenceOpen && turn.evidence && turn.evidence.length > 0 && (
                    <div
                      className="mt-1.5 p-2 rounded-2 w-100 d-flex flex-column gap-1.5"
                      style={{
                        maxWidth: "94%",
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "0.72rem",
                      }}
                    >
                      {turn.evidence.map((ev) => (
                        <div key={ev.id} className="pb-1 border-bottom border-subtle last:border-0">
                          <div className="d-flex align-items-center justify-content-between text-secondary mb-0.5">
                            <span className="font-monospace">@{ev.channel_username} #{ev.telegram_message_id}</span>
                            {ev.source_url && (
                              <a
                                href={ev.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-accent d-inline-flex align-items-center gap-0.5 text-decoration-none"
                              >
                                <IconExternalLink size={11} />
                              </a>
                            )}
                          </div>
                          <div className="text-primary">{ev.snippet || "-"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {running && (
            <div className="text-secondary small fst-italic">{t("playground.thinking")}</div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="d-flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("playground.input_placeholder")}
            disabled={running || !onRunPlayground}
            className="linear-input flex-grow-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={running}
            disabled={!input.trim() || !onRunPlayground}
            icon={<IconSend size={14} />}
          >
            {t("playground.btn_send")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
