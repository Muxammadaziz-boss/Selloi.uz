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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const handleCtaClick = (planCode: string) => {
    if (isAuthenticated) {
      window.location.href = `/settings/billing?plan=${planCode}`;
    } else {
      onOpenOnboarding(planCode);
    }
  };

  return (
    <section className="selloi-tarif-section selloi-reveal-item" id="tariflar" data-node-id="182:397">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="selloi-pricing-header">
          <p className="selloi-section-tag" data-node-id="182:399">
            {t.tag}
          </p>
          <h2 className="selloi-pricing-title" data-node-id="182:400">
            {t.title}
          </h2>
          <p className="selloi-pricing-desc" data-node-id="182:401">
            {t.desc}
          </p>

          {/* Billing Cycle Toggle */}
          <div className="selloi-billing-toggle-wrapper">
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
        </div>

        {/* 4-Plan Responsive Grid */}
        <div className="selloi-pricing-grid">
          {t.plans.map((plan) => {
            const isYearly = billingCycle === "yearly";
            const effectiveMonthlyUsd = isYearly
              ? Math.round(plan.priceYearlyUsd / 12)
              : plan.priceMonthlyUsd;

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
                    <span className="selloi-price-amount">${effectiveMonthlyUsd}</span>
                    <span className="selloi-price-period">{t.perMonth}</span>
                  </div>

                  <div className="selloi-price-local">
                    {isYearly ? (
                      <>
                        <span>{plan.priceYearlyUzs} so&apos;m {t.perYear}</span>
                        <div className="selloi-price-subtext">(${plan.priceYearlyUsd} / yil)</div>
                      </>
                    ) : (
                      <>
                        <span>{plan.priceMonthlyUzs} so&apos;m {t.perMonth}</span>
                        <div className="selloi-price-subtext">(${plan.priceMonthlyUsd} / oy)</div>
                      </>
                    )}
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
                  className={`selloi-plan-cta ${
                    plan.isPopular ? "selloi-plan-cta-popular" : "selloi-plan-cta-default"
                  }`}
                  onClick={() => handleCtaClick(plan.code)}
                >
                  <span>{plan.name} - {t.ctaSelect}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <p className="selloi-pricing-footer-note">{t.note}</p>
      </div>
    </section>
  );
}
