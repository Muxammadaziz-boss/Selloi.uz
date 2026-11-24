"use client";

import React from "react";
import CountUpNumber from "./CountUpNumber";
import { SelloiSinabKorishTranslations } from "./selloiI18n";
import { Sparkles, CheckCircle2, Zap, ArrowRight } from "lucide-react";

interface TrialSectionProps {
  onOpenOnboarding: (planCode?: string) => void;
  isAuthenticated?: boolean;
  t: SelloiSinabKorishTranslations;
}

export default function TrialSection({
  onOpenOnboarding,
  isAuthenticated = false,
  t,
}: TrialSectionProps) {
  const handleTrialClick = (planCode: string = "start") => {
    if (isAuthenticated) {
      window.location.href = `/settings/billing?plan=${planCode}&trial=true`;
    } else {
      onOpenOnboarding(planCode);
    }
  };

  return (
    <section
      className="selloi-trial-section selloi-reveal-item"
      id="sinab-korish"
      data-node-id="182:397-trial"
    >
      <div className="selloi-container">
        <div className="selloi-trial-card">
          {/* Left Column: Description & Features */}
          <div className="selloi-trial-content">
            <div className="selloi-trial-badge-row">
              <span className="selloi-section-tag" style={{ margin: 0 }}>
                {t.tag}
              </span>
              <span className="selloi-trial-glow-pill">
                <Sparkles size={13} style={{ color: "var(--selloi-accent)" }} />
                <span>{t.badge}</span>
              </span>
            </div>

            <h2 className="selloi-trial-title">{t.title}</h2>
            <p className="selloi-trial-desc">{t.desc}</p>

            <div className="selloi-trial-features">
              <div className="selloi-trial-feature-item">
                <CheckCircle2 size={16} className="text-success" style={{ flexShrink: 0 }} />
                <span>{t.feature1}</span>
              </div>
              <div className="selloi-trial-feature-item">
                <CheckCircle2 size={16} className="text-success" style={{ flexShrink: 0 }} />
                <span>{t.feature2}</span>
              </div>
              <div className="selloi-trial-feature-item">
                <CheckCircle2 size={16} className="text-success" style={{ flexShrink: 0 }} />
                <span>{t.feature3}</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3 Trial Tiers & CTA */}
          <div className="selloi-trial-plans-box">
            <div className="selloi-trial-plans-grid">
              {/* START Trial Card */}
              <div
                className="selloi-trial-plan-item"
                onClick={() => handleTrialClick("start")}
                role="button"
                tabIndex={0}
              >
                <div className="selloi-trial-plan-header">
                  <span className="selloi-trial-plan-name">{t.startLabel}</span>
                  <span className="selloi-trial-plan-sub">7 kun</span>
                </div>
                <div className="selloi-trial-plan-price font-monospace">
                  <CountUpNumber value={t.startPrice} />
                  <span className="selloi-trial-plan-curr">{t.currency}</span>
                </div>
              </div>

              {/* PRO Trial Card (Featured) */}
              <div
                className="selloi-trial-plan-item featured"
                onClick={() => handleTrialClick("pro")}
                role="button"
                tabIndex={0}
              >
                <div className="selloi-trial-plan-header">
                  <span className="selloi-trial-plan-name">
                    <Zap size={13} style={{ marginRight: "4px", color: "var(--selloi-accent)" }} />
                    {t.proLabel}
                  </span>
                  <span className="selloi-trial-plan-sub">7 kun</span>
                </div>
                <div className="selloi-trial-plan-price font-monospace">
                  <CountUpNumber value={t.proPrice} />
                  <span className="selloi-trial-plan-curr">{t.currency}</span>
                </div>
              </div>

              {/* ULTRA Trial Card */}
              <div
                className="selloi-trial-plan-item"
                onClick={() => handleTrialClick("ultra")}
                role="button"
                tabIndex={0}
              >
                <div className="selloi-trial-plan-header">
                  <span className="selloi-trial-plan-name">{t.ultraLabel}</span>
                  <span className="selloi-trial-plan-sub">7 kun</span>
                </div>
                <div className="selloi-trial-plan-price font-monospace">
                  <CountUpNumber value={t.ultraPrice} />
                  <span className="selloi-trial-plan-curr">{t.currency}</span>
                </div>
              </div>
            </div>

            <div className="selloi-trial-action-row">
              <button
                type="button"
                className="selloi-btn-glass selloi-trial-btn"
                onClick={() => handleTrialClick("start")}
              >
                <span>{t.cta}</span>
                <ArrowRight size={16} style={{ marginLeft: "8px" }} />
              </button>
              <p className="selloi-trial-note">{t.note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
