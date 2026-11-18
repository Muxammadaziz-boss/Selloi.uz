"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCheck,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Zap,
  Camera,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export default function HeroVisual() {
  const [activeStep, setActiveStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mediaQuery.matches);
    }

    // Sequence loop: 0 -> 1 -> 2 -> 3 -> 0
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev >= 3 ? 0 : prev + 1));
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="position-relative w-100 mx-auto" style={{ maxWidth: "540px" }}>
      {/* Top Floating Feature Badge: AI Vision */}
      <div
        className="d-flex align-items-center gap-2 px-3 py-1.5 position-absolute"
        style={{
          top: "-14px",
          right: "20px",
          zIndex: 10,
          background: "#11121C",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "100px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        }}
      >
        <Camera size={13} color="#38BDF8" />
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#F1F5F9" }}>
          AI Vision: 99.4% aniqlik
        </span>
      </div>

      {/* Main SaaS Interface Card (Telegram Sales Engine) */}
      <div
        className="rounded-4 overflow-hidden"
        style={{
          background: "#0E1019",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.65), 0 0 40px rgba(124, 58, 237, 0.12)",
        }}
      >
        {/* Telegram Header */}
        <div
          className="p-3 px-4 d-flex align-items-center justify-content-between"
          style={{
            background: "#131522",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center text-white fw-bold position-relative"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
                fontSize: "0.9rem",
              }}
            >
              S
              <span
                className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-dark"
                style={{ width: "9px", height: "9px" }}
              />
            </div>
            <div>
              <div className="fw-bold text-white d-flex align-items-center gap-1.5" style={{ fontSize: "0.92rem" }}>
                <span>Selloi AI Sotuvchi</span>
                <span className="badge bg-purple-subtle text-purple" style={{ fontSize: "0.62rem", padding: "1px 5px" }}>
                  Bot
                </span>
              </div>
              <div className="text-secondary small" style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                Telegram kanalingiz bilan sinxronlangan
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-1.5">
            <span
              className="d-inline-block rounded-circle bg-success"
              style={{ width: "6px", height: "6px" }}
            />
            <span className="small text-success fw-medium" style={{ fontSize: "0.75rem" }}>
              24/7 Faol
            </span>
          </div>
        </div>

        {/* Telegram Chat Viewport */}
        <div className="p-3.5 p-md-4 d-flex flex-column gap-3" style={{ minHeight: "360px" }}>
          {/* 1. Customer Message */}
          <div className="d-flex justify-content-end">
            <div
              className="p-2.5 px-3.5"
              style={{
                maxWidth: "85%",
                background: "#2A2050",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                borderRadius: "14px 14px 3px 14px",
                color: "#FFFFFF",
                fontSize: "0.86rem",
              }}
            >
              <div>Assalomu alaykum! Qora oversize xudi bormi? Razmer L</div>
              <div className="d-flex align-items-center justify-content-end gap-1 mt-1 text-white-50" style={{ fontSize: "0.65rem" }}>
                <span>12:42</span>
                <CheckCheck size={12} color="#38BDF8" />
              </div>
            </div>
          </div>

          {/* Typing State */}
          {!reducedMotion && activeStep === 1 && (
            <div className="d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#7C3AED",
                  color: "#FFF",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                }}
              >
                S
              </div>
              <div
                className="p-2 px-3 d-flex align-items-center gap-2 rounded-3"
                style={{ background: "#161826", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="small text-secondary" style={{ fontSize: "0.78rem" }}>
                  AI javob yozmoqda
                </span>
                <div className="selloi-typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          {/* 2. Selloi AI Response with Rich Product Card */}
          {(reducedMotion || activeStep >= 1) && (
            <div className="d-flex align-items-start gap-2.5">
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "#7C3AED",
                  color: "#FFF",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                }}
              >
                S
              </div>
              <div style={{ maxWidth: "88%" }}>
                {/* AI Text bubble */}
                <div
                  className="p-2.5 px-3 mb-2"
                  style={{
                    background: "#161826",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "14px 14px 14px 3px",
                    color: "#F1F5F9",
                    fontSize: "0.85rem",
                  }}
                >
                  Va alaykum assalom! Ha, <strong>Midnight Black Oversize Hoodie</strong> hozirda omborimizda mavjud.
                </div>

                {/* Inline Product Showcase Card */}
                <div
                  className="p-3 rounded-3"
                  style={{
                    background: "#121420",
                    border: "1px solid rgba(168, 85, 247, 0.25)",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                  }}
                >
                  <div className="d-flex gap-3 align-items-center mb-2.5">
                    {/* Product Preview Thumbnail */}
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-2"
                      style={{
                        width: "60px",
                        height: "60px",
                        background: "linear-gradient(135deg, #1E1F30 0%, #0D0E18 100%)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <ShoppingBag size={24} color="#C084FC" />
                    </div>

                    <div className="flex-grow-1">
                      <div className="fw-bold text-white" style={{ fontSize: "0.88rem" }}>
                        Oversize Hoodie (Qora)
                      </div>
                      <div className="text-secondary small mb-1" style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                        100% paxta • L razmer • Omborda: 3 dona
                      </div>
                      <div className="fw-bold text-success" style={{ fontSize: "0.92rem" }}>
                        240,000 so‘m
                      </div>
                    </div>
                  </div>

                  {/* Telegram Inline Action Buttons */}
                  <div className="d-grid gap-1.5 pt-2 border-top border-secondary border-opacity-25">
                    <button
                      className="btn btn-sm py-1.5 d-flex align-items-center justify-content-center gap-1.5 fw-semibold text-white"
                      style={{
                        background: "linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%)",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                      }}
                    >
                      <ShoppingBag size={13} />
                      <span>Xarid qilish (1 bosishda)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Customer Buy Action & Confirmation */}
          {(reducedMotion || activeStep >= 2) && (
            <div className="d-flex justify-content-end">
              <div
                className="p-2 px-3"
                style={{
                  background: "#2A2050",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  borderRadius: "12px 12px 2px 12px",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                }}
              >
                1 dona L razmer, Chilonzor 7 ga yetkazib bering
              </div>
            </div>
          )}

          {/* 4. Automated Instant Order Receipt Card */}
          {(reducedMotion || activeStep >= 3) && (
            <div
              className="p-3 rounded-3 mt-1"
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                marginLeft: "36px",
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-1.5">
                <span className="fw-bold text-success d-flex align-items-center gap-1.5" style={{ fontSize: "0.82rem" }}>
                  <CheckCircle2 size={14} /> Buyurtma #1042 qabul qilindi
                </span>
                <span className="badge bg-success-subtle text-success" style={{ fontSize: "0.68rem" }}>
                  Operatorga uzatildi
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-center text-light small" style={{ fontSize: "0.78rem" }}>
                <span className="text-secondary">Oversize Hoodie (L) • Chilonzor 7</span>
                <span className="text-white fw-bold">240,000 so‘m (Click)</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <div
          className="p-2.5 px-4 d-flex align-items-center justify-content-between"
          style={{
            background: "#0A0B12",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            fontSize: "0.75rem",
            color: "#94A3B8",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <Zap size={13} color="#38BDF8" />
            <span>Javob tezligi: <strong>0.6 soniya</strong></span>
          </div>
          <div className="d-flex align-items-center gap-1 text-secondary">
            <ShieldCheck size={13} color="#10B981" />
            <span>Telegram Bot API rasmiy ulangan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
