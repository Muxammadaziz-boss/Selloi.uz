"use client";

import React from "react";
import { useLanguage } from "@/app/lib/i18n";
import { TRUST_METRICS_BY_LANG } from "./data";
import { Clock, Globe, Target, Zap } from "lucide-react";

export default function TrustBar() {
  const { language } = useLanguage();
  const metrics = TRUST_METRICS_BY_LANG[language] || TRUST_METRICS_BY_LANG.uz;

  const getIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Clock size={20} color="var(--s-purple-soft)" />;
      case 1:
        return <Globe size={20} color="var(--s-cyan)" />;
      case 2:
        return <Target size={20} color="var(--s-emerald)" />;
      case 3:
      default:
        return <Zap size={20} color="var(--s-amber)" />;
    }
  };

  return (
    <section className="py-2 position-relative" style={{ zIndex: 3 }}>
      <div className="s-container">
        <div
          className="p-4 p-md-4 rounded-4 s-glass-card"
          style={{
            background: "rgba(17, 15, 29, 0.75)",
          }}
        >
          <div className="row g-4 align-items-center">
            {metrics.map((metric, idx) => (
              <div
                key={metric.value}
                className={`col-6 col-md-3 ${
                  idx !== metrics.length - 1
                    ? "border-end-md border-secondary border-opacity-25"
                    : ""
                }`}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid var(--s-glass-border)",
                    }}
                  >
                    {getIcon(idx)}
                  </div>
                  <div>
                    <div
                      className="fw-extrabold text-white"
                      style={{
                        fontSize: "clamp(1.5rem, 2.4vw, 1.95rem)",
                        letterSpacing: "-0.03em",
                        lineHeight: 1.1,
                      }}
                    >
                      {metric.value}
                    </div>
                    <div
                      className="fw-semibold text-light"
                      style={{ fontSize: "0.86rem" }}
                    >
                      {metric.label}
                    </div>
                    <div
                      className="small"
                      style={{ fontSize: "0.76rem", color: "var(--s-text-muted)" }}
                    >
                      {metric.sublabel}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
