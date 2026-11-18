"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/app/lib/i18n";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import {
  ArrowRight,
  Send,
  Camera,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Zap,
  CheckCheck,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

interface HeroSectionProps {
  onOpenOnboarding: () => void;
}

export default function HeroSection({ onOpenOnboarding }: HeroSectionProps) {
  const { language } = useLanguage();
  const hero = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).hero;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setMousePos({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      ref={heroRef}
      className="position-relative overflow-hidden"
      style={{
        minHeight: "90vh",
        display: "flex",
        alignItems: "center",
        paddingTop: "32px",
        paddingBottom: "72px",
      }}
    >
      {/* Soft Ambient Illumination */}
      <div
        className="position-absolute"
        style={{
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "680px",
          height: "420px",
          background:
            "radial-gradient(ellipse 60% 45% at 50% 50%, rgba(99, 102, 241, 0.09), transparent 75%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="s-container position-relative" style={{ zIndex: 2 }}>
        <div className="row align-items-center g-5">
          {/* Left Column: Executive Value Proposition & Call to Action */}
          <div className="col-lg-6">
            {/* Pill Badge */}
            <div className="mb-4">
              <span className="s-pill">
                <Sparkles size={13} />
                <span>{hero.badge}</span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="s-heading-hero mb-4">
              {hero.headlinePrefix}{" "}
              <span className="s-gradient-purple d-block">
                {hero.headlineHighlight}
              </span>
            </h1>

            {/* Supporting Copy */}
            <p
              className="s-body-lg mb-5"
              style={{ maxWidth: "520px", color: "var(--s-text-secondary)" }}
            >
              {hero.description}
            </p>

            {/* CTA Buttons */}
            <div className="d-flex flex-wrap align-items-center gap-3 mb-5">
              <button onClick={onOpenOnboarding} className="s-btn-primary">
                <span>{hero.primaryCta}</span>
                <ArrowRight size={16} />
              </button>

              <a href="#imkoniyatlar" className="s-btn-secondary">
                <span>{hero.secondaryCta}</span>
              </a>
            </div>

            {/* Micro Trust Indicators */}
            <div
              className="pt-4 d-flex flex-wrap align-items-center gap-4"
              style={{
                borderTop: "1px solid var(--s-glass-border)",
                fontSize: "var(--s-text-sm)",
                color: "var(--s-text-muted)",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "20px",
                    height: "20px",
                    background: "rgba(99, 102, 241, 0.14)",
                    color: "var(--s-purple-bright)",
                  }}
                >
                  <CheckCircle2 size={13} />
                </div>
                <span>{hero.trust1}</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "20px",
                    height: "20px",
                    background: "rgba(2, 132, 199, 0.14)",
                    color: "var(--s-blue-soft)",
                  }}
                >
                  <Send size={11} />
                </div>
                <span>{hero.trust2}</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "20px",
                    height: "20px",
                    background: "rgba(16, 185, 129, 0.14)",
                    color: "var(--s-emerald)",
                  }}
                >
                  <ShieldCheck size={12} />
                </div>
                <span>{hero.trust3}</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Fidelity Telegram Autonomous Sales Engine Window */}
          <div className="col-lg-6 position-relative">
            <div
              className="position-relative d-flex align-items-center justify-content-center"
              style={{ minHeight: "540px" }}
            >
              {/* Main macOS Telegram Window Mockup */}
              <div
                className="s-app-window w-100 position-relative"
                style={{
                  maxWidth: "520px",
                  zIndex: 2,
                  transform: `perspective(1000px) rotateY(${mousePos.x * 2}deg) rotateX(${mousePos.y * -2}deg)`,
                  transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Titlebar with macOS Controls */}
                <div className="s-app-titlebar">
                  <div className="s-app-dots">
                    <span className="s-app-dot s-app-dot-red" />
                    <span className="s-app-dot s-app-dot-yellow" />
                    <span className="s-app-dot s-app-dot-green" />
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: "22px",
                        height: "22px",
                        background: "linear-gradient(135deg, #6366F1, #38BDF8)",
                        color: "#FFF",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      S
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#F1F5F9" }}>
                      Selloi AI Seller
                    </span>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#10B981",
                        boxShadow: "0 0 6px #10B981",
                      }}
                    />
                  </div>

                  <span
                    className="badge rounded-pill"
                    style={{
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "#10B981",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "3px 8px",
                    }}
                  >
                    24/7 Faol
                  </span>
                </div>

                {/* Chat Stream Body */}
                <div className="p-3 p-md-4 d-flex flex-column gap-3" style={{ background: "#090B10" }}>
                  {/* Message 1: Customer Inquiry with Photo */}
                  <div className="d-flex flex-column align-items-end">
                    <div
                      className="p-3 rounded-3"
                      style={{
                        maxWidth: "82%",
                        background: "#1E293B",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#F8FAFC",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                    >
                      {/* Photo Thumbnail Snippet */}
                      <div
                        className="d-flex align-items-center gap-2 p-2 rounded-2 mb-2"
                        style={{
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                        }}
                      >
                        <div
                          className="d-flex align-items-center justify-content-center rounded"
                          style={{
                            width: "32px",
                            height: "32px",
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "var(--s-blue-soft)",
                          }}
                        >
                          <Camera size={16} />
                        </div>
                        <div style={{ fontSize: "11px" }}>
                          <div className="fw-semibold text-white">IMG_2048.jpg</div>
                          <div style={{ color: "var(--s-text-muted)" }}>Qora krossovka</div>
                        </div>
                      </div>

                      <div>{hero.floatingCard1Msg}</div>

                      <div
                        className="d-flex align-items-center justify-content-end gap-1 mt-1"
                        style={{ fontSize: "10px", color: "var(--s-text-muted)" }}
                      >
                        <span>14:20</span>
                        <CheckCheck size={12} color="#38BDF8" />
                      </div>
                    </div>
                  </div>

                  {/* Message 2: Selloi AI Instant Response with SKU Card */}
                  <div className="d-flex flex-column align-items-start">
                    <div
                      className="p-3 rounded-3"
                      style={{
                        maxWidth: "88%",
                        background: "#111624",
                        border: "1px solid rgba(99, 102, 241, 0.25)",
                        color: "#F8FAFC",
                        fontSize: "13px",
                        lineHeight: 1.5,
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-secondary border-opacity-25">
                        <span
                          className="d-flex align-items-center gap-1.5 fw-semibold"
                          style={{ fontSize: "11px", color: "var(--s-purple-soft)" }}
                        >
                          <Zap size={12} /> Javob vaqti: 0.8s
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38BDF8",
                            fontSize: "10px",
                          }}
                        >
                          AI Vision
                        </span>
                      </div>

                      <p className="mb-2.5">
                        Assalomu alaykum! Ha, <strong>Air Runner Pro</strong> qora rangda 42 razmer omborimizda mavjud. Narxi 360,000 so‘m. Bepul yetkazib beramiz! 👟
                      </p>

                      {/* Verified SKU Card */}
                      <div
                        className="p-2.5 rounded-2 d-flex align-items-center justify-content-between"
                        style={{
                          background: "rgba(17, 24, 39, 0.85)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2.5">
                          <div
                            className="rounded d-flex align-items-center justify-content-center"
                            style={{
                              width: "36px",
                              height: "36px",
                              background: "rgba(99, 102, 241, 0.15)",
                              color: "var(--s-purple-soft)",
                            }}
                          >
                            <ShoppingBag size={18} />
                          </div>
                          <div>
                            <div className="fw-semibold text-white" style={{ fontSize: "12px" }}>
                              Air Runner Pro (42)
                            </div>
                            <div style={{ fontSize: "11px", color: "#10B981" }}>
                              ✓ Omborda 3 dona qoldi
                            </div>
                          </div>
                        </div>

                        <div className="text-end">
                          <div className="fw-bold text-white" style={{ fontSize: "13px" }}>
                            360,000 UZS
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--s-text-muted)" }}>
                            Yetkazish: 0 UZS
                          </div>
                        </div>
                      </div>

                      <div
                        className="d-flex align-items-center justify-content-end gap-1 mt-1.5"
                        style={{ fontSize: "10px", color: "var(--s-text-muted)" }}
                      >
                        <span>14:20</span>
                      </div>
                    </div>
                  </div>

                  {/* Message 3: Smart Order Instant Action Card */}
                  <div className="d-flex flex-column align-items-start">
                    <div
                      className="p-3 rounded-3 w-100"
                      style={{
                        maxWidth: "88%",
                        background: "#0D1322",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span
                          className="d-flex align-items-center gap-1.5 fw-bold"
                          style={{ fontSize: "12px", color: "#10B981" }}
                        >
                          <CheckCircle2 size={13} /> {hero.floatingCard3Title}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#10B981",
                            fontSize: "10px",
                          }}
                        >
                          {hero.floatingCard3Status}
                        </span>
                      </div>

                      <div className="d-flex align-items-center justify-content-between py-1 border-top border-bottom border-secondary border-opacity-25 my-1.5" style={{ fontSize: "12px" }}>
                        <span className="text-light">Air Runner Pro • 42</span>
                        <span className="fw-bold text-white">360,000 UZS</span>
                      </div>

                      {/* Payment Quick Actions */}
                      <div className="d-flex align-items-center gap-2 mt-2">
                        <span
                          className="badge py-1.5 px-2.5 rounded"
                          style={{
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38BDF8",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            fontSize: "10px",
                            cursor: "pointer",
                          }}
                        >
                          Payme
                        </span>
                        <span
                          className="badge py-1.5 px-2.5 rounded"
                          style={{
                            background: "rgba(99, 102, 241, 0.15)",
                            color: "#818CF8",
                            border: "1px solid rgba(99, 102, 241, 0.3)",
                            fontSize: "10px",
                            cursor: "pointer",
                          }}
                        >
                          Click
                        </span>
                        <span
                          className="badge py-1.5 px-2.5 rounded"
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            color: "#CBD5E1",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            fontSize: "10px",
                          }}
                        >
                          Naqd to‘lov
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orbiting Satellite Metric 1: Top Right */}
              <div
                className="position-absolute d-none d-md-flex align-items-center gap-2 px-3 py-2 rounded-3"
                style={{
                  top: "2%",
                  right: "-4%",
                  zIndex: 3,
                  background: "#0E121A",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                  transform: `translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0)`,
                  transition: "transform 0.15s ease-out",
                }}
              >
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "rgba(99, 102, 241, 0.15)",
                    color: "var(--s-purple-bright)",
                  }}
                >
                  <Zap size={13} />
                </div>
                <div>
                  <div className="fw-semibold text-white" style={{ fontSize: "11px" }}>
                    0.8s javob vaqti
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--s-text-muted)" }}>
                    Tungi navbatchilarsiz
                  </div>
                </div>
              </div>

              {/* Orbiting Satellite Metric 2: Bottom Left */}
              <div
                className="position-absolute d-none d-md-flex align-items-center gap-2 px-3 py-2 rounded-3"
                style={{
                  bottom: "4%",
                  left: "-5%",
                  zIndex: 3,
                  background: "#0E121A",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                  transform: `translate3d(${mousePos.x * -14}px, ${mousePos.y * -14}px, 0)`,
                  transition: "transform 0.15s ease-out",
                }}
              >
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "var(--s-blue-soft)",
                  }}
                >
                  <Camera size={13} />
                </div>
                <div>
                  <div className="fw-semibold text-white" style={{ fontSize: "11px" }}>
                    {hero.floatingCard2Title}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--s-blue-soft)" }}>
                    {hero.floatingCard2Sub}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Animated Scroll Indicator */}
      <div className="s-scroll-indicator">
        <span>{hero.scrollIndicator}</span>
        <div className="s-scroll-line" />
      </div>
    </section>
  );
}
