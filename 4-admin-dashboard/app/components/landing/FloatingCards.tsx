"use client";

import React, { useState, useEffect } from "react";
import {
  Camera,
  Send,
  Clock,
  BarChart3,
  CheckCheck,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default function FloatingCards() {
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mediaQuery.matches);
    }

    // Sequence timer: 0 -> 1 -> 2 -> 3 -> 4 -> 0
    const interval = setInterval(() => {
      setStep((prev) => (prev >= 4 ? 0 : prev + 1));
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none"
      style={{ overflow: "hidden" }}
    >
      {/* 1. Top-Left Badge: AI Vision */}
      <div
        className="position-absolute selloi-float-1"
        style={{
          top: "12px",
          left: "14px",
          zIndex: 5,
        }}
      >
        <div
          className="d-flex align-items-center gap-2 px-3 py-1.5"
          style={{
            background: "rgba(16, 17, 30, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(168, 85, 247, 0.4)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(124, 58, 237, 0.25)",
          }}
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              background: "rgba(124, 58, 237, 0.25)",
              color: "#C084FC",
            }}
          >
            <Camera size={14} />
          </div>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#FFFFFF" }}>
            AI Vision
          </span>
        </div>
      </div>

      {/* 2. Top-Right Badge: Telegram Connected */}
      <div
        className="position-absolute selloi-float-2"
        style={{
          top: "16px",
          right: "14px",
          zIndex: 5,
        }}
      >
        <div
          className="d-flex align-items-center gap-2 px-3 py-1.5"
          style={{
            background: "rgba(16, 17, 30, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(56, 189, 248, 0.2)",
          }}
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              background: "rgba(56, 189, 248, 0.25)",
              color: "#38BDF8",
            }}
          >
            <Send size={13} />
          </div>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#FFFFFF" }}>
            Telegram Connected
          </span>
        </div>
      </div>

      {/* 3. Middle-Left Badge: 24/7 Active */}
      <div
        className="position-absolute selloi-float-3 d-none d-sm-block"
        style={{
          bottom: "235px",
          left: "12px",
          zIndex: 5,
        }}
      >
        <div
          className="d-flex align-items-center gap-2 px-3 py-1.5"
          style={{
            background: "rgba(16, 17, 30, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              background: "rgba(255, 255, 255, 0.08)",
              color: "#38BDF8",
            }}
          >
            <Clock size={13} />
          </div>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#FFFFFF" }}>
            24/7 Active
          </span>
        </div>
      </div>

      {/* 4. Middle-Right Badge: Smart Sales */}
      <div
        className="position-absolute selloi-float-1 d-none d-sm-block"
        style={{
          bottom: "220px",
          right: "12px",
          zIndex: 5,
        }}
      >
        <div
          className="d-flex align-items-center gap-2 px-3 py-1.5"
          style={{
            background: "rgba(16, 17, 30, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(168, 85, 247, 0.35)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(124, 58, 237, 0.2)",
          }}
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              background: "rgba(168, 85, 247, 0.25)",
              color: "#C084FC",
            }}
          >
            <BarChart3 size={14} />
          </div>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#FFFFFF" }}>
            Smart Sales
          </span>
        </div>
      </div>

      {/* 5. Animated Interactive Telegram Chat Mockup (Strictly Bounded Inside Container) */}
      <div
        className="position-absolute"
        style={{
          bottom: "8px",
          left: "10px",
          right: "10px",
          zIndex: 8,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, rgba(20, 21, 38, 0.95) 0%, rgba(11, 12, 22, 0.98) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(168, 85, 247, 0.35)",
            borderRadius: "18px",
            padding: "14px 16px",
            boxShadow: "0 18px 45px rgba(0, 0, 0, 0.65), 0 0 35px rgba(124, 58, 237, 0.22)",
          }}
        >
          {/* Telegram Header */}
          <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom border-secondary border-opacity-25">
            <div className="d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center position-relative"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #A855F7 0%, #6B21A8 100%)",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  boxShadow: "0 0 10px rgba(168, 85, 247, 0.5)",
                }}
              >
                S
                <span
                  className="position-absolute bottom-0 end-0 p-1 bg-success border border-dark rounded-circle"
                  style={{ width: "8px", height: "8px" }}
                />
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.1 }}>
                  Selloi AI
                </div>
                <div style={{ fontSize: "0.7rem", color: "#38BDF8" }}>
                  bot • 24/7 faol
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-1.5">
              <span className="badge bg-purple-subtle text-purple" style={{ fontSize: "0.65rem", padding: "3px 7px" }}>
                <Sparkles size={9} className="me-1" /> Jonli simulyatsiya
              </span>
            </div>
          </div>

          {/* Sequential Chat Conversation */}
          <div
            className="d-flex flex-column gap-2"
            style={{ minHeight: "155px" }}
          >
            {/* Step 0+: Customer Inquiry */}
            {(reducedMotion || step >= 0) && (
              <div className="d-flex justify-content-end">
                <div
                  className="p-2 px-3"
                  style={{
                    maxWidth: "88%",
                    background: "rgba(124, 58, 237, 0.35)",
                    border: "1px solid rgba(168, 85, 247, 0.35)",
                    borderRadius: "14px 14px 2px 14px",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  <div>Assalomu alaykum, qora rangli xudi bormi?</div>
                  <div
                    className="d-flex align-items-center justify-content-end gap-1 mt-1"
                    style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.7)" }}
                  >
                    <span>12:42</span>
                    <CheckCheck size={12} color="#38BDF8" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: AI Typing Indicator */}
            {!reducedMotion && step === 1 && (
              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#7C3AED",
                    color: "#FFFFFF",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                  }}
                >
                  S
                </div>
                <div
                  className="p-2 px-3 d-flex align-items-center gap-2"
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px 12px 12px 2px",
                    fontSize: "0.78rem",
                    color: "#CBD5E1",
                  }}
                >
                  <span className="small text-muted me-1">Selloi AI yozmoqda</span>
                  <div className="selloi-typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2+: AI Answer */}
            {(reducedMotion || step >= 2) && (
              <div className="d-flex align-items-start gap-2">
                <div
                  className="d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#7C3AED",
                    color: "#FFFFFF",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                  }}
                >
                  S
                </div>
                <div
                  className="p-2 px-3"
                  style={{
                    maxWidth: "88%",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "14px 14px 14px 2px",
                    color: "#F8FAFC",
                    fontSize: "0.82rem",
                  }}
                >
                  <div>
                    Va alaykum assalom! Ha, mavjud. 100% paxtali, ichi issiq fleece. M, L, XL razmerlari bor. Narxi 240,000 so‘m. 🛍️
                  </div>
                  <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                    <span
                      className="badge bg-purple-subtle text-purple border border-purple-subtle"
                      style={{ fontSize: "0.62rem", padding: "2px 5px" }}
                    >
                      <ShoppingBag size={9} className="me-1" /> Omborda bor
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "#94A3B8" }}>12:42</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3+: Customer replies with size */}
            {(reducedMotion || step >= 3) && (
              <div className="d-flex justify-content-end">
                <div
                  className="p-1.5 px-3"
                  style={{
                    maxWidth: "85%",
                    background: "rgba(124, 58, 237, 0.35)",
                    border: "1px solid rgba(168, 85, 247, 0.35)",
                    borderRadius: "12px 12px 2px 12px",
                    color: "#FFFFFF",
                    fontSize: "0.8rem",
                  }}
                >
                  <div>L razmeridan 1 dona olaman</div>
                  <div
                    className="d-flex align-items-center justify-content-end gap-1 mt-0.5"
                    style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.7)" }}
                  >
                    <span>12:43</span>
                    <CheckCheck size={11} color="#38BDF8" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: AI Order Card Created */}
            {(reducedMotion || step >= 4) && (
              <div
                className="p-2 px-3 mt-1"
                style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  borderRadius: "12px",
                  fontSize: "0.78rem",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-bold text-success d-flex align-items-center gap-1">
                    <CheckCircle2 size={13} /> Buyurtma qabul qilindi #1042
                  </span>
                  <span className="text-white fw-bold">240,000 so‘m</span>
                </div>
                <div className="text-secondary small">
                  Oversize Black Hoodie (L) • To‘lov: Click / Naqd
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
