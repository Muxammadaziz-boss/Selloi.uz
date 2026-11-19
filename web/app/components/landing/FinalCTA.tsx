"use client";

import React from "react";
import { useLanguage } from "@/app/lib/i18n";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import { ArrowRight, ShieldCheck, Zap, Sparkles, CheckCircle2 } from "lucide-react";

interface FinalCTAProps {
  onOpenOnboarding: () => void;
}

export default function FinalCTA({ onOpenOnboarding }: FinalCTAProps) {
  const { language } = useLanguage();
  const ctaContent = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).finalCta;

  return (
    <section className="s-section position-relative overflow-hidden">
      <div className="s-container position-relative" style={{ zIndex: 2 }}>
        <div
          className="p-5 p-md-5 rounded-4 position-relative overflow-hidden s-glass-card"
          style={{
            borderColor: "rgba(255, 255, 255, 0.12)",
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, #0F1420 0%, #0A0D15 100%)",
          }}
        >
          {/* Subtle Top Specular Ambient Line */}
          <div
            className="position-absolute"
            style={{
              top: 0,
              left: "20%",
              right: "20%",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent)",
              pointerEvents: "none",
            }}
          />

          <div className="row align-items-center g-4 position-relative" style={{ zIndex: 3 }}>
            <div className="col-lg-8 text-center text-lg-start">
              <div className="mb-3">
                <span className="s-pill">
                  <Sparkles size={13} />
                  <span>{ctaContent.badge}</span>
                </span>
              </div>

              <h2
                className="s-heading-section text-white mb-3"
                style={{ fontSize: "clamp(2rem, 3.6vw, 2.75rem)" }}
              >
                {ctaContent.headingPrefix}{" "}
                <span className="s-gradient-purple d-block">
                  {ctaContent.headingHighlight}
                </span>
              </h2>

              <p
                className="s-body-lg mb-4"
                style={{ maxWidth: "560px", color: "var(--s-text-secondary)" }}
              >
                {ctaContent.subtitle}
              </p>

              <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start gap-4 small">
                <span className="d-flex align-items-center gap-1.5 text-light">
                  <CheckCircle2 size={15} color="var(--s-emerald)" /> {ctaContent.trust1}
                </span>
                <span style={{ color: "var(--s-text-muted)" }}>•</span>
                <span className="d-flex align-items-center gap-1.5 text-light">
                  <Zap size={15} color="var(--s-blue-soft)" /> {ctaContent.trust2}
                </span>
                <span style={{ color: "var(--s-text-muted)" }}>•</span>
                <span style={{ color: "var(--s-text-secondary)" }}>
                  {ctaContent.trust3}
                </span>
              </div>
            </div>

            <div className="col-lg-4 text-center text-lg-end">
              <button
                onClick={onOpenOnboarding}
                className="s-btn-primary px-4 py-3"
                style={{ fontSize: "1.05rem" }}
              >
                <span>{ctaContent.primaryCta}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
