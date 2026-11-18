"use client";

import React, { useState } from "react";
import { useLanguage } from "@/app/lib/i18n";
import { TESTIMONIALS_BY_LANG, PARTNER_LOGOS } from "./data";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import { Star, Quote, CheckCircle2, Store, Sparkles } from "lucide-react";

export default function SocialProofSection() {
  const { language } = useLanguage();
  const testimonials = TESTIMONIALS_BY_LANG[language] || TESTIMONIALS_BY_LANG.uz;
  const proofContent = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).socialProof;

  return (
    <section className="s-section position-relative overflow-hidden">
      <div className="s-container">
        {/* Partner Store Badges Strip */}
        <div className="text-center mb-5">
          <p
            className="small text-uppercase fw-semibold mb-3.5"
            style={{
              letterSpacing: "0.08em",
              color: "var(--s-text-muted)",
              fontSize: "var(--s-text-xs)",
            }}
          >
            {proofContent.partnerLabel}
          </p>

          <div className="d-flex flex-wrap align-items-center justify-content-center gap-2.5 gap-md-3">
            {PARTNER_LOGOS.map((partner) => (
              <div
                key={partner.name}
                className="px-3.5 py-2 rounded-pill d-flex align-items-center gap-2"
                style={{
                  background: "rgba(19, 17, 34, 0.7)",
                  border: "1px solid var(--s-glass-border)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <Store size={14} color="var(--s-purple-soft)" />
                <span className="fw-medium text-light small" style={{ fontSize: "0.82rem" }}>
                  {partner.label}
                </span>
                <span
                  className="badge rounded-pill text-secondary"
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    fontSize: "0.62rem",
                  }}
                >
                  {partner.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section Header */}
        <div className="text-center mb-5 pt-3">
          <div className="mb-3">
            <span className="s-pill">
              <Sparkles size={13} />
              <span>{proofContent.badge}</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            {proofContent.headingPrefix}{" "}
            <span className="s-gradient-purple">{proofContent.headingHighlight}</span>
          </h2>
          <p className="s-body-lg mx-auto" style={{ maxWidth: "600px" }}>
            {proofContent.subtitle}
          </p>
        </div>

        {/* 3D Cards Grid / Carousel */}
        <div className="row g-4 justify-content-center">
          {testimonials.map((t) => (
            <div key={t.id} className="col-lg-4">
              <div
                className="s-glass-card h-100 p-4 p-md-5 d-flex flex-column justify-content-between position-relative"
                style={{
                  minHeight: "320px",
                }}
              >
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "rgba(180, 74, 255, 0.15)",
                        color: "var(--s-purple-soft)",
                      }}
                    >
                      <Quote size={18} />
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          fill="#FBBF24"
                          color="#FBBF24"
                        />
                      ))}
                    </div>
                  </div>

                  <p
                    className="mb-4"
                    style={{
                      color: "#F1F5F9",
                      fontSize: "0.95rem",
                      lineHeight: 1.65,
                      fontStyle: "italic",
                    }}
                  >
                    “{t.quote}”
                  </p>
                </div>

                <div
                  className="pt-3 d-flex align-items-center justify-content-between"
                  style={{ borderTop: "1px solid var(--s-glass-border)" }}
                >
                  <div>
                    <div
                      className="fw-bold text-white d-flex align-items-center gap-1.5"
                      style={{ fontSize: "0.88rem" }}
                    >
                      <span>{t.author}</span>
                      <CheckCircle2 size={13} color="var(--s-cyan)" />
                    </div>
                    <div className="small" style={{ color: "var(--s-text-muted)", fontSize: "0.78rem" }}>
                      {t.role}
                    </div>
                  </div>
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: "rgba(180, 74, 255, 0.15)",
                      color: "var(--s-purple-soft)",
                      fontSize: "0.7rem",
                      padding: "4px 10px",
                    }}
                  >
                    {t.stats}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
