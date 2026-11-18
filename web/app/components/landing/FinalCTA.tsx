"use client";

import React from "react";
import ThreeAICore from "./ThreeAICore";
import { ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";

interface FinalCTAProps {
  onOpenOnboarding: () => void;
}

export default function FinalCTA({ onOpenOnboarding }: FinalCTAProps) {
  return (
    <section className="s-section position-relative overflow-hidden">
      <div className="s-container position-relative" style={{ zIndex: 2 }}>
        <div
          className="p-5 p-md-5 rounded-4 position-relative overflow-hidden s-glass-card"
          style={{
            borderColor: "rgba(180, 74, 255, 0.4)",
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.7), 0 0 80px rgba(147, 3, 197, 0.2)",
            background: "rgba(17, 15, 29, 0.85)",
          }}
        >
          {/* Glowing 3D AI Core in Background */}
          <div
            className="position-absolute"
            style={{
              top: "50%",
              right: "-5%",
              transform: "translateY(-50%)",
              width: "480px",
              height: "480px",
              opacity: 0.65,
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <ThreeAICore intensity={0.8} />
          </div>

          {/* Volumetric Radial Glow */}
          <div
            className="position-absolute"
            style={{
              top: "50%",
              left: "40%",
              transform: "translate(-50%, -50%)",
              width: "600px",
              height: "400px",
              background:
                "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(147, 3, 197, 0.2), transparent 70%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          <div className="row align-items-center g-4 position-relative" style={{ zIndex: 3 }}>
            <div className="col-lg-8 text-center text-lg-start">
              <div className="mb-3">
                <span className="s-pill">
                  <Sparkles size={13} />
                  <span>24/7 AVTOMATIK SAVDO</span>
                </span>
              </div>

              <h2
                className="s-heading-section text-white mb-3"
                style={{ fontSize: "clamp(2rem, 3.8vw, 3rem)" }}
              >
                Biznesingizni yangi avlod{" "}
                <span className="s-gradient-purple d-block">
                  AI bilan rivojlantiring.
                </span>
              </h2>

              <p
                className="s-body-lg mb-4"
                style={{ maxWidth: "560px", color: "var(--s-text-secondary)" }}
              >
                Kechasi ham, dam olish kunlarida ham barcha xaridorlarga professional xizmat
                ko‘rsating va buyurtmalarni avtomatik qabul qiling.
              </p>

              <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start gap-4 small">
                <span className="d-flex align-items-center gap-1.5 text-light">
                  <ShieldCheck size={16} color="var(--s-emerald)" /> 7 kun bepul sinov
                </span>
                <span style={{ color: "var(--s-text-muted)" }}>•</span>
                <span className="d-flex align-items-center gap-1.5 text-light">
                  <Zap size={16} color="var(--s-cyan)" /> 2 daqiqada sozlash
                </span>
                <span style={{ color: "var(--s-text-muted)" }}>•</span>
                <span style={{ color: "var(--s-text-secondary)" }}>
                  Kredit karta talab etilmaydi
                </span>
              </div>
            </div>

            <div className="col-lg-4 text-center text-lg-end">
              <button
                onClick={onOpenOnboarding}
                className="s-btn-primary px-4 py-3"
                style={{ fontSize: "1.05rem" }}
              >
                <span>7 kun bepul boshlash</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
