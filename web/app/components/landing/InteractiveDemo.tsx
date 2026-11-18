"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/app/lib/i18n";
import { DEMO_SCENARIOS_BY_LANG } from "./data";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import {
  Send,
  CheckCheck,
  Camera,
  CheckCircle2,
  ShoppingBag,
  Sparkles,
  Bot,
  Zap,
} from "lucide-react";

export default function InteractiveDemo() {
  const { language } = useLanguage();
  const scenarios = DEMO_SCENARIOS_BY_LANG[language] || DEMO_SCENARIOS_BY_LANG.uz;
  const demoContent = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).demo;

  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0].id);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedResponse, setDisplayedResponse] = useState("");
  const [showOrder, setShowOrder] = useState(false);

  const scenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  // If scenario id doesn't match on language change, default to first
  useEffect(() => {
    if (!scenarios.some((s) => s.id === activeScenarioId)) {
      setActiveScenarioId(scenarios[0].id);
    }
  }, [scenarios, activeScenarioId]);

  // Animate simulated typing when switching scenarios
  useEffect(() => {
    setIsTyping(true);
    setDisplayedResponse("");
    setShowOrder(false);

    const typingTimer = setTimeout(() => {
      setIsTyping(false);
      setDisplayedResponse(scenario.aiResponse);
      if (scenario.hasOrderCard) {
        setShowOrder(true);
      }
    }, 900);

    return () => clearTimeout(typingTimer);
  }, [activeScenarioId, scenario]);

  return (
    <section className="s-section position-relative">
      {/* Background Volumetric Aura */}
      <div
        className="position-absolute"
        style={{
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "800px",
          height: "500px",
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(99, 102, 241, 0.06), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="s-container position-relative" style={{ zIndex: 2 }}>
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="s-pill">
              <Sparkles size={13} />
              <span>{demoContent.badge}</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            {demoContent.headingPrefix}{" "}
            <span className="s-gradient-purple">{demoContent.headingHighlight}</span>
          </h2>
          <p
            className="s-body-lg mx-auto"
            style={{ maxWidth: "620px" }}
          >
            {demoContent.subtitle}
          </p>
        </div>

        {/* 3D Depth Demo Container */}
        <div
          className="mx-auto rounded-4 overflow-hidden position-relative"
          style={{
            maxWidth: "880px",
            background: "#0B0E14",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
          }}
        >
          {/* Top Scenario Navigation Bar */}
          <div
            className="p-3 d-flex flex-wrap gap-2 border-bottom border-secondary border-opacity-25"
            style={{ background: "#0E121A" }}
          >
            {scenarios.map((sc) => {
              const isActive = sc.id === activeScenarioId;
              return (
                <button
                  key={sc.id}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill border-0"
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    background: isActive
                      ? "linear-gradient(180deg, var(--s-purple-bright) 0%, var(--s-purple) 100%)"
                      : "rgba(255, 255, 255, 0.05)",
                    color: isActive ? "#FFFFFF" : "var(--s-text-muted)",
                    boxShadow: isActive ? "0 4px 16px var(--s-purple-glow)" : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{sc.icon}</span>
                  <span>{sc.tabLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Telegram Simulator Chat Area */}
          <div className="p-4 p-md-5">
            {/* Telegram Header */}
            <div
              className="d-flex align-items-center justify-content-between pb-3 mb-4"
              style={{ borderBottom: "1px solid var(--s-glass-border)" }}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center text-white fw-bold position-relative"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--s-purple-bright) 0%, var(--s-purple) 100%)",
                    fontSize: "0.95rem",
                  }}
                >
                  S
                  <span
                    className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-dark"
                    style={{ width: "9px", height: "9px" }}
                  />
                </div>
                <div>
                  <div className="fw-bold text-white d-flex align-items-center gap-1.5" style={{ fontSize: "0.95rem" }}>
                    <span>Selloi AI Assistant</span>
                    <span className="badge rounded-pill" style={{ background: "rgba(99,102,241,0.2)", color: "var(--s-purple-soft)", fontSize: "0.65rem" }}>
                      Bot
                    </span>
                  </div>
                  <div className="small text-info d-flex align-items-center gap-1.5" style={{ fontSize: "0.75rem" }}>
                    <span
                      className="d-inline-block rounded-circle bg-success"
                      style={{ width: "6px", height: "6px" }}
                    />
                    {demoContent.onlineStatus}
                  </div>
                </div>
              </div>
              <span className="s-pill" style={{ padding: "4px 12px", fontSize: "0.72rem" }}>
                {demoContent.liveBadge}
              </span>
            </div>

            {/* Messages Container */}
            <div className="d-flex flex-column gap-3" style={{ minHeight: "260px" }}>
              {/* User message */}
              <div className="d-flex justify-content-end">
                <div
                  className="p-3 px-3.5 rounded-4"
                  style={{
                    maxWidth: "80%",
                    background: "#1E293B",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "16px 16px 3px 16px",
                    color: "#FFFFFF",
                    fontSize: "0.92rem",
                    lineHeight: 1.5,
                  }}
                >
                  {scenario.userHasImage && (
                    <div
                      className="p-2 mb-2 rounded-3 d-flex align-items-center gap-2"
                      style={{
                        background: "rgba(15, 17, 28, 0.8)",
                        border: "1px dashed rgba(56, 189, 248, 0.4)",
                      }}
                    >
                      <Camera size={16} color="var(--s-cyan)" />
                      <span className="small text-info" style={{ fontSize: "0.8rem" }}>
                        {scenario.userImageDesc}
                      </span>
                    </div>
                  )}
                  <div>{scenario.userMessage}</div>
                  <div
                    className="d-flex align-items-center justify-content-end gap-1 mt-1 text-white-50 small"
                    style={{ fontSize: "0.68rem" }}
                  >
                    <span>12:44</span>
                    <CheckCheck size={13} color="var(--s-cyan)" />
                  </div>
                </div>
              </div>

              {/* AI Response message or Typing indicator */}
              {isTyping ? (
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      background: "var(--s-purple)",
                      color: "#FFF",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    S
                  </div>
                  <div
                    className="p-2.5 px-3.5 d-flex align-items-center gap-2 rounded-4"
                    style={{
                      background: "rgba(19, 17, 34, 0.9)",
                      border: "1px solid var(--s-glass-border)",
                    }}
                  >
                    <span className="small text-secondary" style={{ fontSize: "0.8rem" }}>
                      {demoContent.typingStatus}
                    </span>
                    <div className="s-typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="d-flex align-items-start gap-2.5">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "var(--s-purple)",
                      color: "#FFFFFF",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                    }}
                  >
                    S
                  </div>
                  <div
                    className="p-3 px-3.5 rounded-4"
                    style={{
                      maxWidth: "85%",
                      background: "rgba(19, 17, 34, 0.9)",
                      border: "1px solid var(--s-glass-border)",
                      borderRadius: "16px 16px 16px 3px",
                      color: "#F1F5F9",
                      fontSize: "0.92rem",
                      lineHeight: 1.5,
                    }}
                  >
                    <div>{displayedResponse}</div>
                    <div
                      className="d-flex align-items-center justify-content-between gap-3 mt-2 pt-1.5"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <span
                        className="badge rounded-pill"
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          color: "var(--s-purple-soft)",
                          fontSize: "0.7rem",
                        }}
                      >
                        <ShoppingBag size={10} className="me-1" /> {demoContent.autoReplyBadge}
                      </span>
                      <span className="small" style={{ fontSize: "0.68rem", color: "var(--s-text-muted)" }}>
                        12:44
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Card if present */}
              {showOrder && scenario.orderData && (
                <div
                  className="p-3 px-3.5 rounded-4 mt-2"
                  style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    maxWidth: "85%",
                    marginLeft: "40px",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-success border-opacity-25">
                    <span
                      className="fw-bold text-success d-flex align-items-center gap-1.5"
                      style={{ fontSize: "0.85rem" }}
                    >
                      <CheckCircle2 size={15} /> {scenario.orderData.title}
                    </span>
                    <span className="badge bg-success-subtle text-success fw-semibold" style={{ fontSize: "0.65rem" }}>
                      {scenario.orderData.status}
                    </span>
                  </div>
                  <div className="d-flex flex-column gap-1 small text-light" style={{ fontSize: "0.8rem" }}>
                    <div>
                      <strong>Tovar:</strong> {scenario.orderData.item}
                    </div>
                    <div>
                      <strong>Narx:</strong>{" "}
                      <span className="text-success fw-bold">{scenario.orderData.price}</span>
                    </div>
                    <div>
                      <strong>Yetkazish:</strong> {scenario.orderData.size}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar Placeholder */}
            <div
              className="mt-4 p-2 px-3 rounded-pill d-flex align-items-center justify-content-between"
              style={{
                background: "rgba(7, 6, 15, 0.8)",
                border: "1px solid var(--s-glass-border)",
              }}
            >
              <span className="small ps-2" style={{ fontSize: "0.82rem", color: "var(--s-text-muted)" }}>
                {demoContent.inputPlaceholder}
              </span>
              <div
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{
                  width: "32px",
                  height: "32px",
                  background: "linear-gradient(180deg, var(--s-purple-bright) 0%, var(--s-purple) 100%)",
                  color: "#FFFFFF",
                }}
              >
                <Send size={13} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
