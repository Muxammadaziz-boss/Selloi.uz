"use client";

import React from "react";
import { ArrowRight, ShieldCheck, Zap, Bot } from "lucide-react";

interface FinalCTAProps {
  onOpenOnboarding: () => void;
}

export default function FinalCTA({ onOpenOnboarding }: FinalCTAProps) {
  return (
    <section className="selloi-section position-relative">
      <div className="selloi-container">
        <div
          className="p-4 p-md-5 rounded-4 position-relative overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #131422 0%, #0E0F1A 100%)",
            border: "1px solid rgba(168, 85, 247, 0.35)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div className="row align-items-center g-4 position-relative z-2">
            {/* Left: Clean Selloi Emblem */}
            <div className="col-md-2 d-none d-md-flex justify-content-center">
              <div
                className="d-flex align-items-center justify-content-center rounded-3"
                style={{
                  width: "68px",
                  height: "68px",
                  background: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
                  boxShadow: "0 8px 24px rgba(124, 58, 237, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: "34px",
                    fontWeight: 900,
                    color: "#FFFFFF",
                  }}
                >
                  S
                </span>
              </div>
            </div>

            {/* Center: Headline & Subtitle */}
            <div className="col-md-6 col-lg-7 text-center text-md-start">
              <h3
                className="display-6 fw-bold mb-2 text-white"
                style={{
                  letterSpacing: "-0.03em",
                  lineHeight: 1.2,
                  fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)",
                }}
              >
                Biznesingizga yangi avlod AI sotuvchisini tanishtiring.
              </h3>
              <p className="text-secondary mb-3 small" style={{ color: "#CBD5E1", fontSize: "0.95rem" }}>
                Kechasi ham, dam olish kunlarida ham barcha xaridorlarga professional xizmat ko‘rsating va buyurtmalarni avtomatik qabul qiling.
              </p>
              <div className="d-flex flex-wrap align-items-center gap-3 text-secondary small" style={{ fontSize: "0.82rem" }}>
                <span className="d-flex align-items-center gap-1.5 text-light">
                  <ShieldCheck size={14} color="#10B981" /> 7 kun bepul sinov
                </span>
                <span>•</span>
                <span className="d-flex align-items-center gap-1.5 text-light">
                  <Zap size={14} color="#38BDF8" /> 2 daqiqada ulanish
                </span>
                <span>•</span>
                <span>Kredit karta talab qilinmaydi</span>
              </div>
            </div>

            {/* Right: Action Button */}
            <div className="col-md-4 col-lg-3 text-center text-md-end">
              <button
                onClick={onOpenOnboarding}
                className="selloi-btn-primary px-4 py-3 w-100"
                style={{ fontSize: "1rem" }}
              >
                <span>7 kun bepul boshlash</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
