"use client";

import React from "react";
import { SelloiTranslations } from "./selloiI18n";

interface PricingSectionProps {
  onOpenOnboarding: () => void;
  isAuthenticated?: boolean;
  t: SelloiTranslations["tariflar"];
}

export default function PricingSection({
  onOpenOnboarding,
  isAuthenticated = false,
  t,
}: PricingSectionProps) {
  const handleCtaClick = () => {
    if (isAuthenticated) {
      window.location.href = "/dashboard";
    } else {
      onOpenOnboarding();
    }
  };

  return (
    <section className="selloi-tarif-section selloi-reveal-item" id="tariflar" data-node-id="182:397">
      <div className="selloi-container">
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
            <button
              type="button"
              className="selloi-btn-glass selloi-tarif-btn"
              data-node-id="182:402"
              onClick={handleCtaClick}
            >
              <span>{t.cta}</span>
            </button>
            <p className="selloi-tarif-note" data-node-id="182:403">
              {t.note}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
