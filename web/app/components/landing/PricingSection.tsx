"use client";

import React, { useState } from "react";
import CountUpNumber from "./CountUpNumber";
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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const handleCtaClick = (planCode: string = "start") => {
    if (isAuthenticated) {
      window.location.href = `/settings/billing?plan=${planCode}&cycle=${billingCycle}`;
    } else {
      onOpenOnboarding(planCode);
    }
  };

  const getNumericPrice = (str: string | number) => {
    if (typeof str === "number") return str;
    return parseInt(String(str).replace(/\D/g, ""), 10) || 0;
  };

  return (
    <section className="selloi-tarif-section selloi-reveal-item" id="tariflar" data-node-id="182:397">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="selloi-pricing-header" style={{ textAlign: "center", marginBottom: "40px" }}>
          <p className="selloi-section-tag" style={{ margin: "0 auto 12px auto" }}>
            {t.tag}
          </p>
          <h2 className="selloi-pricing-main-title" style={{ fontSize: "38px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 14px 0", letterSpacing: "-0.5px" }}>
            {t.title}
          </h2>
          <p className="selloi-pricing-main-desc" style={{ fontSize: "17px", color: "rgba(255, 255, 255, 0.7)", maxWidth: "680px", margin: "0 auto", lineHeight: 1.6 }}>
            {t.desc}
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="selloi-billing-toggle-wrapper" style={{ marginBottom: "36px", display: "flex", justifyContent: "center" }}>
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

        {/* 3 Canonical Plans Grid - ALWAYS VISIBLE, NEVER HIDDEN */}
        <div className="selloi-pricing-grid">
          {t.plans.map((plan) => {
            const isYearly = billingCycle === "yearly";
            const priceValue = isYearly
              ? getNumericPrice(plan.priceYearlyUzs)
              : getNumericPrice(plan.priceMonthlyUzs);

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

                {/* Price Display with CountUp Animation */}
                <div className="selloi-plan-pricing">
                  <div className="selloi-price-row">
                    <CountUpNumber
                      value={priceValue}
                      className="selloi-price-amount font-monospace"
                      duration={1100}
                    />
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
    </section>
  );
}
