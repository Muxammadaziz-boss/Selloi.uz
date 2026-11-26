"use client";

import React from "react";
import { SelloiTranslations } from "./selloiI18n";

interface FinalCTAProps {
  onOpenOnboarding: () => void;
  isAuthenticated?: boolean;
  isAdminSession?: boolean;
  t: SelloiTranslations["finalCta"];
}

export default function FinalCTA({
  onOpenOnboarding,
  isAuthenticated = false,
  isAdminSession = false,
  t,
}: FinalCTAProps) {
  const handleCtaClick = () => {
    if (isAuthenticated) {
      window.location.href = isAdminSession ? "/admin" : "/dashboard";
    } else {
      onOpenOnboarding();
    }
  };

  return (
    <section className="selloi-cta-section selloi-reveal-item" id="boshlash" data-node-id="182:439">
      <div className="selloi-container">
        <div className="selloi-cta-card">
          <div className="selloi-cta-header">
            <p className="selloi-cta-tag" data-node-id="182:440">
              {t.tag}
            </p>
            <h2 className="selloi-cta-title" data-node-id="182:441">
              <span>{t.titleLine1}</span>
              <br />
              <span>{t.titleLine2}</span>
            </h2>
            <p className="selloi-cta-desc" data-node-id="182:442">
              {t.desc}
            </p>
          </div>

          <div className="selloi-cta-footer">
            <button
              type="button"
              className="selloi-btn-glass selloi-cta-btn"
              data-node-id="173:115"
              onClick={handleCtaClick}
            >
              <span>{t.cta}</span>
            </button>
            <p className="selloi-cta-note" data-node-id="182:444">
              {t.note}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
