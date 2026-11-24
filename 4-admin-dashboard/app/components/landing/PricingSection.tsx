"use client";

import React, { useState } from "react";
import { ADVANCED_PRICING_PLANS, COMPARISON_FEATURES } from "./data";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface PricingSectionProps {
  onOpenOnboarding: () => void;
}

export default function PricingSection({ onOpenOnboarding }: PricingSectionProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  return (
    <section id="tariflar" className="selloi-section position-relative">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="selloi-pill-badge">
              <span>TARIFLAR</span>
            </span>
          </div>
          <h2 className="selloi-section-title mb-3 text-white">
            Sizning biznesingiz uchun mos tarifni tanlang
          </h2>
          <p
            className="text-secondary mx-auto mb-4"
            style={{ maxWidth: "620px", fontSize: "1.08rem", color: "#CBD5E1" }}
          >
            Har qanday hajmda savdo qiluvchi Telegram do‘konlar uchun moslashuvchan narxlar. Barcha tariflarda 7 kunlik sinov!
          </p>

          {/* Billing Switcher (Monthly vs Annual) */}
          <div
            className="d-inline-flex align-items-center gap-1.5 p-1 rounded-2"
            style={{ background: "#0E1019", border: "1px solid rgba(255, 255, 255, 0.08)" }}
          >
            <button
              onClick={() => setIsAnnual(false)}
              className={`btn btn-sm rounded-2 px-3 py-1.5 fw-semibold ${
                !isAnnual ? "btn-primary text-white" : "text-secondary"
              }`}
              style={{
                fontSize: "0.82rem",
                background: !isAnnual ? "#7C3AED" : "transparent",
                border: "none",
              }}
            >
              Oylik to‘lov
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`btn btn-sm rounded-2 px-3 py-1.5 fw-semibold d-flex align-items-center gap-1.5 ${
                isAnnual ? "btn-primary text-white" : "text-secondary"
              }`}
              style={{
                fontSize: "0.82rem",
                background: isAnnual ? "#7C3AED" : "transparent",
                border: "none",
              }}
            >
              <span>Yillik to‘lov</span>
              <span className="badge bg-success text-white" style={{ fontSize: "0.65rem" }}>
                2 oy sovg‘a (-17%) [TO‘LDIRING]
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="row g-4 align-items-stretch justify-content-center mb-5">
          {ADVANCED_PRICING_PLANS.map((plan) => {
            const isPro = plan.isPopular;
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`col-lg-4 d-flex ${isPro ? "order-first order-lg-0" : ""}`}
              >
                <div
                  className="selloi-card w-100 p-4 p-xl-5 d-flex flex-column justify-content-between position-relative"
                  style={{
                    background: isPro ? "#111322" : "#0E1019",
                    borderColor: isPro
                      ? "rgba(168, 85, 247, 0.45)"
                      : "rgba(255, 255, 255, 0.08)",
                    boxShadow: isPro
                      ? "0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
                      : "0 8px 24px rgba(0, 0, 0, 0.35)",
                    transform: isPro ? "scale(1.02)" : "none",
                    zIndex: isPro ? 2 : 1,
                  }}
                >
                  {/* Pro Recommended Ribbon */}
                  {isPro && (
                    <div className="position-absolute top-0 end-0 mt-3 me-3">
                      <span
                        className="badge bg-purple text-white px-2.5 py-1 rounded-1 fw-bold"
                        style={{
                          background: "#7C3AED",
                          fontSize: "0.72rem",
                          letterSpacing: "0.04em",
                        }}
                      >
                        ★ TAVSIYA ETILADI
                      </span>
                    </div>
                  )}

                  <div>
                    {/* Plan Header */}
                    <div className="mb-3">
                      <h3
                        className="fw-bold mb-1 text-white"
                        style={{ fontSize: "1.35rem", letterSpacing: "-0.3px" }}
                      >
                        {plan.name}
                      </h3>
                      <p
                        className="text-secondary small mb-3"
                        style={{ color: "#94A3B8", minHeight: "36px" }}
                      >
                        {plan.tagline}
                      </p>
                    </div>

                    {/* Price Block */}
                    <div className="mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                      <div className="d-flex align-items-baseline gap-2">
                        <span
                          className="fw-extrabold text-white"
                          style={{
                            fontSize: "clamp(1.9rem, 2.8vw, 2.5rem)",
                            letterSpacing: "-0.03em",
                            lineHeight: 1,
                          }}
                        >
                          {price}
                        </span>
                        {price !== "Kelishuv asosida" && (
                          <span className="text-secondary small">
                            {plan.priceNote}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 d-flex align-items-center gap-1.5">
                        <ShieldCheck size={13} color="#10B981" />
                        <span className="small text-success fw-medium" style={{ fontSize: "0.8rem" }}>
                          {plan.trialBadge}
                        </span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="d-flex flex-column gap-2.5 mb-5">
                      {plan.features.map((f, i) => (
                        <div
                          key={i}
                          className="d-flex align-items-start gap-2.5 small"
                          style={{
                            color: f.included ? "#E2E8F0" : "#64748B",
                          }}
                        >
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 mt-0.5"
                            style={{
                              width: "16px",
                              height: "16px",
                              background: f.included
                                ? "rgba(16, 185, 129, 0.2)"
                                : "rgba(255, 255, 255, 0.04)",
                            }}
                          >
                            {f.included ? (
                              <Check size={11} color="#10B981" />
                            ) : (
                              <X size={11} color="#64748B" />
                            )}
                          </div>
                          <span style={{ textDecoration: f.included ? "none" : "line-through", fontSize: "0.86rem" }}>
                            {f.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div>
                    <button
                      onClick={onOpenOnboarding}
                      className={`w-100 py-2.5 ${
                        isPro ? "selloi-btn-primary" : "selloi-btn-secondary"
                      }`}
                      style={{ fontSize: "0.95rem" }}
                    >
                      <span>{plan.ctaLabel}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapsible Comparison Trigger */}
        <div className="text-center mb-4">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="selloi-btn-secondary px-3.5 py-2 d-inline-flex align-items-center gap-2"
            style={{ fontSize: "0.88rem" }}
          >
            <span>
              {showComparison
                ? "Solishtirish jadvalini yopish"
                : "Barcha tariflarni to‘liq solishtirish"}
            </span>
            {showComparison ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Comparison Table */}
        {showComparison && (
          <div
            className="p-4 p-md-5 rounded-3 mt-3"
            style={{
              background: "#0E1019",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              overflowX: "auto",
            }}
          >
            <table className="selloi-comparison-table">
              <thead>
                <tr>
                  <th style={{ width: "40%", color: "#FFFFFF", fontSize: "0.95rem" }}>
                    Imkoniyatlar va funksiyalar
                  </th>
                  <th style={{ width: "20%", textAlign: "center", color: "#FFFFFF", fontSize: "0.95rem" }}>
                    START
                  </th>
                  <th style={{ width: "20%", textAlign: "center", color: "#C084FC", fontSize: "0.95rem" }}>
                    PRO (Tavsiya)
                  </th>
                  <th style={{ width: "20%", textAlign: "center", color: "#38BDF8", fontSize: "0.95rem" }}>
                    ULTRA
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((cat, ci) => (
                  <React.Fragment key={ci}>
                    <tr>
                      <td
                        colSpan={4}
                        className="fw-bold text-uppercase pt-4 pb-2"
                        style={{
                          color: "#C084FC",
                          fontSize: "0.74rem",
                          letterSpacing: "0.06em",
                          borderBottom: "1px solid rgba(168, 85, 247, 0.2)",
                        }}
                      >
                        {cat.category}
                      </td>
                    </tr>
                    {cat.items.map((row, ri) => (
                      <tr key={ri}>
                        <td className="text-light small py-2.5">{row.name}</td>
                        <td className="text-center small py-2.5">
                          {typeof row.start === "boolean" ? (
                            row.start ? (
                              <Check size={15} color="#10B981" className="mx-auto" />
                            ) : (
                              <X size={15} color="#64748B" className="mx-auto" />
                            )
                          ) : (
                            <span className="text-secondary">{row.start}</span>
                          )}
                        </td>
                        <td className="text-center small py-2.5 fw-semibold text-white">
                          {typeof row.pro === "boolean" ? (
                            row.pro ? (
                              <Check size={15} color="#10B981" className="mx-auto" />
                            ) : (
                              <X size={15} color="#64748B" className="mx-auto" />
                            )
                          ) : (
                            <span className="text-white">{row.pro}</span>
                          )}
                        </td>
                        <td className="text-center small py-2.5 fw-semibold text-info">
                          {typeof row.ultra === "boolean" ? (
                            row.ultra ? (
                              <Check size={15} color="#10B981" className="mx-auto" />
                            ) : (
                              <X size={15} color="#64748B" className="mx-auto" />
                            )
                          ) : (
                            <span>{row.ultra}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
