"use client";

import React, { useState } from "react";
import { SelloiTariflarTranslations } from "./selloiI18n";

interface PricingSectionProps {
  onOpenOnboarding: (planCode?: string) => void;
  isAuthenticated?: boolean;
  t: SelloiTariflarTranslations;
}

export default function PricingSection({
  onOpenOnboarding,
  isAuthenticated = false,
  t,
}: PricingSectionProps) {
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const handleCtaClick = (planCode: string = "start") => {
    if (isAuthenticated) {
      window.location.href = `/settings/billing?plan=${planCode}`;
    } else {
      onOpenOnboarding(planCode);
    }
  };

  return (
    <section className="selloi-tarif-section selloi-reveal-item" id="tariflar" data-node-id="182:397">
      <div className="selloi-container">
        {/* Figma Desktop - 1 Canonical Tariff Banner Card (data-node-id="182:398") */}
        <div className="selloi-tarif-card" data-node-id="182:398">
          <div>
            <p className="selloi-section-tag" data-node-id="182:399">
              {t.tag}
            </p>
            <h2 className="selloi-tarif-title" data-node-id="182:400">
              {t.title}
            </h2>
            <p className="selloi-tarif-desc" data-node-id="182:401">
              {t.desc}
            </p>
          </div>

          <div className="selloi-tarif-footer">
            <div className="selloi-tarif-cta-group" style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="selloi-btn-glass selloi-tarif-btn"
                data-node-id="182:402"
                onClick={() => handleCtaClick("start")}
              >
                <span>{t.cta}</span>
              </button>

              {t.plans && t.plans.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPlanDetails(!showPlanDetails)}
                  className="selloi-tarif-details-toggle"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255, 255, 255, 0.7)",
                    fontSize: "14px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 500,
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFFFF")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)")}
                >
                  <span>{showPlanDetails ? "Tariflarni yashirish ▲" : "Tariflar taqqosini ko'rish ▼"}</span>
                </button>
              )}
            </div>

            <p className="selloi-tarif-note" data-node-id="182:403">
              {t.note}
            </p>
          </div>
        </div>

        {/* Detailed Tariff Comparison Grid (Expandable on user demand) */}
        {showPlanDetails && (
          <div className="selloi-pricing-drawer" style={{ marginTop: "32px", animation: "fadeIn 0.35s ease" }}>
            {/* Billing Cycle Toggle */}
            <div className="selloi-billing-toggle-wrapper" style={{ marginBottom: "24px", display: "flex", justifyContent: "center" }}>
              <div className="selloi-billing-toggle">
                <button
                  type="button"
                  className={`selloi-billing-btn ${billingCycle === "monthly" ? "active" : ""}`}
                  onClick={() => setBillingCycle("monthly")}
                >
                  {t.billingMonthly}
                </button>
                <button
                  type="button"
                  className={`selloi-billing-btn ${billingCycle === "yearly" ? "active" : ""}`}
                  onClick={() => setBillingCycle("yearly")}
                >
                  <span>{t.billingYearly}</span>
                  <span className="selloi-discount-tag">{t.yearlyDiscountBadge}</span>
                </button>
              </div>
            </div>

            {/* 3 Canonical Plans Grid */}
            <div className="selloi-pricing-grid">
              {t.plans.map((plan) => {
                const isYearly = billingCycle === "yearly";

                return (
                  <div
                    key={plan.code}
                    className={`selloi-plan-card ${plan.isPopular ? "popular" : ""}`}
                  >
                    {plan.isPopular && (
                      <div className="selloi-popular-badge">
                        {plan.badge || t.popularBadge}
                      </div>
                    )}

                    {/* Plan Header */}
                    <div className="selloi-plan-header">
                      <h3 className="selloi-plan-name">{plan.name}</h3>
                      <p className="selloi-plan-desc">{plan.description}</p>
                    </div>

                    {/* Price Display */}
                    <div className="selloi-plan-pricing">
                      <div className="selloi-price-row">
                        <span className="selloi-price-amount font-monospace" style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>
                          {isYearly ? plan.priceYearlyUzs : plan.priceMonthlyUzs}
                        </span>
                        <span className="selloi-price-period" style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "15px", marginLeft: "6px" }}>
                          so&apos;m {isYearly ? t.perYear : t.perMonth}
                        </span>
                      </div>

                      {/* Mega Discount 7-day pill */}
                      <div className="selloi-plan-promo">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        <span>{plan.promoBadge}</span>
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="selloi-plan-features">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="selloi-plan-feature-item">
                          <svg
                            className="selloi-plan-check-icon"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <button
                      type="button"
                      className={`selloi-btn-glass ${
                        plan.isPopular ? "selloi-plan-cta-popular" : "selloi-plan-cta-default"
                      }`}
                      style={{ width: "100%", height: "46px", fontSize: "15px" }}
                      onClick={() => handleCtaClick(plan.code)}
                    >
                      <span>{plan.name} - {t.ctaSelect}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
