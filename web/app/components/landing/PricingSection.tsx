"use client";

import React, { useState } from "react";
import { useLanguage } from "@/app/lib/i18n";
import { PRICING_PLANS_BY_LANG, COMPARISON_BY_LANG } from "./data";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

interface PricingSectionProps {
  onOpenOnboarding: () => void;
}

export default function PricingSection({ onOpenOnboarding }: PricingSectionProps) {
  const { language } = useLanguage();
  const plans = PRICING_PLANS_BY_LANG[language] || PRICING_PLANS_BY_LANG.uz;
  const comparison = COMPARISON_BY_LANG[language] || COMPARISON_BY_LANG.uz;
  const pricingContent = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).pricing;

  const [isAnnual, setIsAnnual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  return (
    <section id="tariflar" className="s-section position-relative">
      {/* Background Glow */}
      <div
        className="position-absolute"
        style={{
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "800px",
          height: "400px",
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
              <span>{pricingContent.badge}</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            {pricingContent.headingPrefix}{" "}
            <span className="s-gradient-purple">{pricingContent.headingHighlight}</span>
          </h2>
          <p className="s-body-lg mx-auto mb-4" style={{ maxWidth: "620px" }}>
            {pricingContent.subtitle}
          </p>

          {/* Billing Switcher (Monthly vs Annual) */}
          <div className="s-pricing-toggle">
            <button
              onClick={() => setIsAnnual(false)}
              className={!isAnnual ? "active" : ""}
            >
              {pricingContent.monthly}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={isAnnual ? "active" : ""}
            >
              <span>{pricingContent.annual}</span>
              <span
                className="badge rounded-pill ms-1.5"
                style={{
                  background: isAnnual ? "rgba(255,255,255,0.2)" : "rgba(16, 185, 129, 0.2)",
                  color: isAnnual ? "#FFFFFF" : "var(--s-emerald)",
                  fontSize: "0.68rem",
                  padding: "2px 8px",
                }}
              >
                {pricingContent.annualGift}
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="row g-4 align-items-stretch justify-content-center mb-5">
          {plans.map((plan) => {
            const isPro = plan.isPopular;
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`col-lg-4 d-flex ${isPro ? "order-first order-lg-0" : ""}`}
              >
                <div
                  className={`s-glass-card w-100 p-4 p-xl-5 d-flex flex-column justify-content-between position-relative ${
                    isPro ? "s-glow-purple" : ""
                  }`}
                  style={{
                    borderColor: isPro
                      ? "var(--s-purple-bright)"
                      : "var(--s-glass-border)",
                    transform: isPro ? "scale(1.02)" : "none",
                    zIndex: isPro ? 2 : 1,
                    background: isPro
                      ? "rgba(22, 18, 38, 0.85)"
                      : "rgba(19, 17, 34, 0.65)",
                  }}
                >
                  {/* Pro Recommended Ribbon */}
                  {isPro && (
                    <div className="position-absolute top-0 end-0 mt-3 me-3">
                      <span
                        className="s-pill"
                        style={{
                          background: "linear-gradient(180deg, var(--s-purple-bright) 0%, var(--s-purple) 100%)",
                          color: "#FFFFFF",
                          border: "none",
                          fontSize: "0.72rem",
                          letterSpacing: "0.04em",
                          boxShadow: "0 2px 10px var(--s-purple-glow)",
                        }}
                      >
                        {pricingContent.recommended}
                      </span>
                    </div>
                  )}

                  <div>
                    {/* Plan Header */}
                    <div className="mb-3">
                      <h3
                        className="s-heading-card text-white mb-1"
                        style={{ fontSize: "1.35rem" }}
                      >
                        {plan.name}
                      </h3>
                      <p
                        className="s-body small mb-3"
                        style={{ minHeight: "36px" }}
                      >
                        {plan.tagline}
                      </p>
                    </div>

                    {/* Price Block */}
                    <div
                      className="mb-4 pb-3"
                      style={{ borderBottom: "1px solid var(--s-glass-border)" }}
                    >
                      <div className="d-flex align-items-baseline gap-2">
                        <span
                          className="fw-extrabold text-white"
                          style={{
                            fontSize: "clamp(2rem, 3vw, 2.5rem)",
                            letterSpacing: "-0.03em",
                            lineHeight: 1,
                          }}
                        >
                          {price}
                        </span>
                        {price !== "Kelishuv asosida" && (
                          <span className="small" style={{ color: "var(--s-text-muted)" }}>
                            {plan.priceNote}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 d-flex align-items-center gap-1.5">
                        <ShieldCheck size={14} color="var(--s-emerald)" />
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
                            color: f.included ? "#E2E8F0" : "var(--s-text-muted)",
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
                              <Check size={11} color="var(--s-emerald)" />
                            ) : (
                              <X size={11} color="var(--s-text-dim)" />
                            )}
                          </div>
                          <span
                            style={{
                              textDecoration: f.included ? "none" : "line-through",
                              fontSize: "0.86rem",
                            }}
                          >
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
                      className={`w-100 ${
                        isPro ? "s-btn-primary" : "s-btn-secondary"
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
            className="s-btn-secondary px-3.5 py-2 d-inline-flex align-items-center gap-2"
            style={{ fontSize: "0.88rem" }}
          >
            <span>
              {showComparison
                ? pricingContent.compareClose
                : pricingContent.compareOpen}
            </span>
            {showComparison ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Comparison Table */}
        {showComparison && (
          <div
            className="p-4 p-md-5 rounded-4 mt-3 s-glass-card"
            style={{ overflowX: "auto" }}
          >
            <table className="s-comparison-table">
              <thead>
                <tr>
                  <th style={{ width: "40%", color: "#FFFFFF", fontSize: "0.95rem" }}>
                    {pricingContent.thFeature}
                  </th>
                  <th style={{ width: "20%", textAlign: "center", color: "#FFFFFF", fontSize: "0.95rem" }}>
                    START
                  </th>
                  <th style={{ width: "20%", textAlign: "center", color: "var(--s-purple-soft)", fontSize: "0.95rem" }}>
                    PRO ({pricingContent.recommended})
                  </th>
                  <th style={{ width: "20%", textAlign: "center", color: "var(--s-cyan)", fontSize: "0.95rem" }}>
                    ULTRA
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((cat, ci) => (
                  <React.Fragment key={ci}>
                    <tr>
                      <td
                        colSpan={4}
                        className="fw-bold text-uppercase pt-4 pb-2"
                        style={{
                          color: "var(--s-purple-soft)",
                          fontSize: "0.74rem",
                          letterSpacing: "0.06em",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
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
                              <Check size={15} color="var(--s-emerald)" className="mx-auto" />
                            ) : (
                              <X size={15} color="var(--s-text-dim)" className="mx-auto" />
                            )
                          ) : (
                            <span style={{ color: "var(--s-text-muted)" }}>{row.start}</span>
                          )}
                        </td>
                        <td className="text-center small py-2.5 fw-semibold text-white">
                          {typeof row.pro === "boolean" ? (
                            row.pro ? (
                              <Check size={15} color="var(--s-emerald)" className="mx-auto" />
                            ) : (
                              <X size={15} color="var(--s-text-dim)" className="mx-auto" />
                            )
                          ) : (
                            <span className="text-white">{row.pro}</span>
                          )}
                        </td>
                        <td className="text-center small py-2.5 fw-semibold text-info">
                          {typeof row.ultra === "boolean" ? (
                            row.ultra ? (
                              <Check size={15} color="var(--s-emerald)" className="mx-auto" />
                            ) : (
                              <X size={15} color="var(--s-text-dim)" className="mx-auto" />
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
