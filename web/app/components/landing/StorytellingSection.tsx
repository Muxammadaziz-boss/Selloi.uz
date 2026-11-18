"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/app/lib/i18n";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import {
  MessageSquare,
  Camera,
  CheckCircle2,
  Send,
  Headphones,
  Check,
  Scan,
  CreditCard,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function StorytellingSection() {
  const { language } = useLanguage();
  const story = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).storytelling;

  const [activeStep, setActiveStep] = useState<number>(2);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-cycle through the 3 stages if not hovered by user
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 4500);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <section
      id="sotuv-jarayoni"
      className="s-section position-relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Ambient Glow */}
      <div
        className="position-absolute"
        style={{
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "900px",
          height: "500px",
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(147, 3, 197, 0.1), transparent 70%)",
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
              <span>{story.badge}</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            {story.headingPrefix}{" "}
            <span className="s-gradient-purple">{story.headingHighlight}</span>
          </h2>
          <p
            className="s-body-lg mx-auto"
            style={{ maxWidth: "640px" }}
          >
            {story.subtitle}
          </p>

          {/* Interactive Stage Selector Tabs */}
          <div className="d-inline-flex align-items-center gap-2 p-1.5 rounded-pill mt-4"
            style={{
              background: "rgba(19, 17, 34, 0.8)",
              border: "1px solid var(--s-glass-border)",
              backdropFilter: "blur(12px)",
            }}
          >
            {[
              { num: 1, label: story.tab1, icon: MessageSquare },
              { num: 2, label: story.tab2, icon: Camera },
              { num: 3, label: story.tab3, icon: CheckCircle2 },
            ].map((st) => {
              const Icon = st.icon;
              const isActive = activeStep === st.num;
              return (
                <button
                  key={st.num}
                  onClick={() => setActiveStep(st.num)}
                  className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill border-0"
                  style={{
                    background: isActive
                      ? "linear-gradient(180deg, var(--s-purple-bright) 0%, var(--s-purple) 100%)"
                      : "transparent",
                    color: isActive ? "#FFFFFF" : "var(--s-text-muted)",
                    fontSize: "var(--s-text-sm)",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: isActive ? "0 4px 16px var(--s-purple-glow)" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon size={14} />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Glowing Data Pathway Header Line */}
        <div
          className="d-none d-lg-block position-relative mx-auto mb-4"
          style={{ maxWidth: "80%", height: "2px" }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, rgba(147,3,197,0.2) 0%, rgba(65,105,255,0.6) 50%, rgba(16,185,129,0.4) 100%)",
            }}
          />
          <div
            className="position-absolute top-50 translate-middle-y"
            style={{
              left: activeStep === 1 ? "16%" : activeStep === 2 ? "50%" : "84%",
              width: "40px",
              height: "4px",
              borderRadius: "4px",
              background: "var(--s-purple-soft)",
              boxShadow: "0 0 16px var(--s-purple-bright)",
              transition: "left 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        {/* 3 Step 3D Interactive Visual Cards */}
        <div className="row g-4 align-items-stretch position-relative">
          {/* STAGE 01 — AI CONVERSATION */}
          <div className="col-lg-4 d-flex">
            <div
              className={`s-glass-card w-100 p-4 p-xl-4 d-flex flex-column justify-content-between ${
                activeStep === 1 ? "border-purple" : ""
              }`}
              style={{
                borderColor:
                  activeStep === 1
                    ? "var(--s-purple-bright)"
                    : "var(--s-glass-border)",
                boxShadow:
                  activeStep === 1
                    ? "0 16px 40px rgba(0,0,0,0.6), 0 0 30px rgba(147, 3, 197, 0.2)"
                    : undefined,
                transform: activeStep === 1 ? "translateY(-4px)" : undefined,
                cursor: "pointer",
              }}
              onClick={() => setActiveStep(1)}
            >
              <div>
                {/* Stage Header */}
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "rgba(180, 74, 255, 0.15)",
                        border: "1px solid rgba(180, 74, 255, 0.35)",
                        color: "var(--s-purple-soft)",
                        fontWeight: 800,
                        fontSize: "0.95rem",
                      }}
                    >
                      01
                    </div>
                    <div>
                      <h3 className="s-heading-card text-white mb-0">
                        {story.stage1Title}
                      </h3>
                      <p className="mb-0 small" style={{ color: "var(--s-text-muted)" }}>
                        {story.stage1Sub}
                      </p>
                    </div>
                  </div>
                  <span className="s-pill" style={{ padding: "3px 10px", fontSize: "0.7rem" }}>
                    LLM 24/7
                  </span>
                </div>

                {/* 3D Chat Simulation */}
                <div
                  className="p-3 my-3 rounded-3"
                  style={{
                    background: "rgba(7, 6, 15, 0.7)",
                    border: "1px solid var(--s-glass-border)",
                  }}
                >
                  {/* Customer Message */}
                  <div className="d-flex align-items-start gap-2 mb-3">
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
                      style={{
                        width: "28px",
                        height: "28px",
                        background: "var(--s-blue)",
                        color: "#FFF",
                      }}
                    >
                      <Send size={12} />
                    </div>
                    <div
                      className="p-2.5 px-3 rounded-4"
                      style={{
                        background: "rgba(22, 24, 38, 0.9)",
                        fontSize: "0.84rem",
                        color: "#F1F5F9",
                        maxWidth: "88%",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {story.stage1UserMsg}
                      <div className="text-end mt-1 text-white-50" style={{ fontSize: "0.65rem" }}>
                        12:40 • Yetkazildi ✓✓
                      </div>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="d-flex align-items-start gap-2">
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
                      style={{
                        width: "28px",
                        height: "28px",
                        background: "var(--s-purple)",
                        color: "#FFF",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                      }}
                    >
                      S
                    </div>
                    <div
                      className="p-2.5 px-3 rounded-4"
                      style={{
                        background: "rgba(35, 18, 55, 0.8)",
                        border: "1px solid rgba(180, 74, 255, 0.35)",
                        fontSize: "0.84rem",
                        color: "#FFFFFF",
                        maxWidth: "88%",
                      }}
                    >
                      {story.stage1AiMsg}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div
                className="pt-3 d-flex align-items-center justify-content-between"
                style={{
                  borderTop: "1px solid var(--s-glass-border)",
                  fontSize: "var(--s-text-xs)",
                  color: "var(--s-text-muted)",
                }}
              >
                <span>{story.stage1Footer}</span>
                <span className="text-success fw-medium">{story.stage1Latency}</span>
              </div>
            </div>
          </div>

          {/* STAGE 02 — AI VISION */}
          <div className="col-lg-4 d-flex">
            <div
              className={`s-glass-card w-100 p-4 p-xl-4 d-flex flex-column justify-content-between ${
                activeStep === 2 ? "border-purple" : ""
              }`}
              style={{
                borderColor:
                  activeStep === 2
                    ? "var(--s-cyan)"
                    : "var(--s-glass-border)",
                boxShadow:
                  activeStep === 2
                    ? "0 16px 40px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.2)"
                    : undefined,
                transform: activeStep === 2 ? "translateY(-4px)" : undefined,
                cursor: "pointer",
              }}
              onClick={() => setActiveStep(2)}
            >
              <div>
                {/* Stage Header */}
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        color: "var(--s-cyan)",
                        fontWeight: 800,
                        fontSize: "0.95rem",
                      }}
                    >
                      02
                    </div>
                    <div>
                      <h3 className="s-heading-card text-white mb-0">
                        {story.stage2Title}
                      </h3>
                      <p className="mb-0 small" style={{ color: "var(--s-text-muted)" }}>
                        {story.stage2Sub}
                      </p>
                    </div>
                  </div>
                  <span className="s-pill s-pill-blue" style={{ padding: "3px 10px", fontSize: "0.7rem" }}>
                    CV 2.0
                  </span>
                </div>

                {/* Laser Scanning Product Card with Detection Grid */}
                <div
                  className="p-3 my-3 rounded-3 position-relative overflow-hidden"
                  style={{
                    background: "rgba(7, 6, 15, 0.7)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  <div className="s-laser-line" />

                  <div className="row g-3 align-items-center">
                    <div className="col-5">
                      <div
                        className="d-flex align-items-center justify-content-center position-relative rounded-3 p-3"
                        style={{
                          height: "105px",
                          background: "rgba(22, 24, 38, 0.8)",
                          border: "1px dashed rgba(56, 189, 248, 0.4)",
                        }}
                      >
                        <Headphones size={38} color="var(--s-cyan)" />
                        <div
                          className="position-absolute top-0 start-0 m-1.5 p-1 badge bg-dark text-info"
                          style={{ fontSize: "0.6rem" }}
                        >
                          <Scan size={9} className="me-1" /> {story.stage2Result}
                        </div>
                      </div>
                    </div>

                    <div className="col-7">
                      <div className="d-flex flex-column gap-1.5 small" style={{ fontSize: "0.78rem" }}>
                        <div className="fw-bold text-white">{story.stage2Product}</div>
                        <div className="d-flex align-items-center gap-1.5" style={{ color: "var(--s-text-secondary)" }}>
                          <Check size={12} color="var(--s-emerald)" />
                          <span>{story.stage2Found}</span>
                        </div>
                        <div className="d-flex align-items-center gap-1.5" style={{ color: "var(--s-text-secondary)" }}>
                          <Check size={12} color="var(--s-emerald)" />
                          <span>{story.stage2Color}</span>
                        </div>
                        <div className="d-flex align-items-center gap-1.5" style={{ color: "var(--s-text-secondary)" }}>
                          <Check size={12} color="var(--s-emerald)" />
                          <span>{story.stage2Stock}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div
                className="pt-3 d-flex align-items-center justify-content-between"
                style={{
                  borderTop: "1px solid var(--s-glass-border)",
                  fontSize: "var(--s-text-xs)",
                  color: "var(--s-text-muted)",
                }}
              >
                <span>{story.stage2Footer}</span>
                <span className="text-info fw-medium">{story.stage2Accuracy}</span>
              </div>
            </div>
          </div>

          {/* STAGE 03 — SMART ORDER */}
          <div className="col-lg-4 d-flex">
            <div
              className={`s-glass-card w-100 p-4 p-xl-4 d-flex flex-column justify-content-between ${
                activeStep === 3 ? "border-purple" : ""
              }`}
              style={{
                borderColor:
                  activeStep === 3
                    ? "var(--s-emerald)"
                    : "var(--s-glass-border)",
                boxShadow:
                  activeStep === 3
                    ? "0 16px 40px rgba(0,0,0,0.6), 0 0 30px rgba(16, 185, 129, 0.2)"
                    : undefined,
                transform: activeStep === 3 ? "translateY(-4px)" : undefined,
                cursor: "pointer",
              }}
              onClick={() => setActiveStep(3)}
            >
              <div>
                {/* Stage Header */}
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        color: "var(--s-emerald)",
                        fontWeight: 800,
                        fontSize: "0.95rem",
                      }}
                    >
                      03
                    </div>
                    <div>
                      <h3 className="s-heading-card text-white mb-0">
                        {story.stage3Title}
                      </h3>
                      <p className="mb-0 small" style={{ color: "var(--s-text-muted)" }}>
                        {story.stage3Sub}
                      </p>
                    </div>
                  </div>
                  <span
                    className="badge rounded-pill text-success"
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      fontSize: "0.68rem",
                      padding: "4px 10px",
                    }}
                  >
                    CRM Sync
                  </span>
                </div>

                {/* 3D Order Summary Card */}
                <div
                  className="p-3 my-3 rounded-3"
                  style={{
                    background: "rgba(7, 6, 15, 0.7)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom border-secondary border-opacity-25">
                    <span
                      className="fw-bold text-success d-flex align-items-center gap-1.5"
                      style={{ fontSize: "0.82rem" }}
                    >
                      <CheckCircle2 size={14} /> {story.stage3Order}
                    </span>
                    <span className="badge bg-success-subtle text-success" style={{ fontSize: "0.68rem" }}>
                      {story.stage3Status}
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-1.5 small" style={{ fontSize: "0.8rem" }}>
                    <div className="d-flex justify-content-between">
                      <span style={{ color: "var(--s-text-muted)" }}>Mahsulot:</span>
                      <span className="text-white">{story.stage3ItemLabel}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span style={{ color: "var(--s-text-muted)" }}>Mijoz:</span>
                      <span className="text-white">{story.stage3CustomerLabel}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span style={{ color: "var(--s-text-muted)" }}>Manzil:</span>
                      <span className="text-white">{story.stage3AddressLabel}</span>
                    </div>
                    <div className="d-flex justify-content-between pt-1 border-top border-secondary border-opacity-25">
                      <span style={{ color: "var(--s-text-muted)" }}>To‘lov:</span>
                      <span className="text-success fw-bold">{story.stage3PaymentLabel}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div
                className="pt-3 d-flex align-items-center justify-content-between"
                style={{
                  borderTop: "1px solid var(--s-glass-border)",
                  fontSize: "var(--s-text-xs)",
                  color: "var(--s-text-muted)",
                }}
              >
                <span>{story.stage3Footer}</span>
                <span className="text-success fw-medium">Click, Payme</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
