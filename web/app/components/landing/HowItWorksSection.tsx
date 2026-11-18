"use client";

import React from "react";
import { useLanguage } from "@/app/lib/i18n";
import { HOW_IT_WORKS_BY_LANG } from "./data";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import { UserPlus, Send, Bot, Sparkles } from "lucide-react";

export default function HowItWorksSection() {
  const { language } = useLanguage();
  const stepsData = HOW_IT_WORKS_BY_LANG[language] || HOW_IT_WORKS_BY_LANG.uz;
  const howContent = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).howItWorks;

  const icons = [UserPlus, Send, Bot];
  const colors = ["var(--s-purple-soft)", "var(--s-cyan)", "var(--s-emerald)"];
  const bgs = [
    "rgba(180, 74, 255, 0.15)",
    "rgba(56, 189, 248, 0.15)",
    "rgba(16, 185, 129, 0.15)",
  ];

  const steps = stepsData.map((item, idx) => ({
    ...item,
    icon: icons[idx] || Bot,
    color: colors[idx] || "var(--s-purple-soft)",
    bg: bgs[idx] || "rgba(180, 74, 255, 0.15)",
  }));

  return (
    <section id="boshlash" className="s-section position-relative overflow-hidden">
      {/* Background Volumetric Glow */}
      <div
        className="position-absolute"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "900px",
          height: "450px",
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(147, 3, 197, 0.1), transparent 70%)",
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
              <span>{howContent.badge}</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            {howContent.headingPrefix}{" "}
            <span className="s-gradient-purple">{howContent.headingHighlight}</span>
          </h2>
          <p className="s-body-lg mx-auto" style={{ maxWidth: "600px" }}>
            {howContent.subtitle}
          </p>
        </div>

        {/* Cinematic 3-Step Journey Connected Through Animated Energy Path */}
        <div className="position-relative py-3">
          {/* Animated Purple Energy Path Line on desktop */}
          <div
            className="d-none d-lg-block position-absolute"
            style={{
              top: "60px",
              left: "16%",
              right: "16%",
              height: "2px",
              background:
                "linear-gradient(90deg, rgba(147,3,197,0.3) 0%, rgba(180,74,255,0.8) 50%, rgba(56,189,248,0.5) 100%)",
              boxShadow: "0 0 16px rgba(180,74,255,0.4)",
              zIndex: 1,
            }}
          />

          <div className="row g-4 position-relative z-2">
            {steps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="col-lg-4 text-center">
                  {/* Floating 3D Step Orb */}
                  <div
                    className="mx-auto mb-4 d-flex align-items-center justify-content-center position-relative"
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "rgba(19, 17, 34, 0.95)",
                      border: "1px solid rgba(180, 74, 255, 0.4)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.6), 0 0 20px rgba(147,3,197,0.25)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 900,
                        fontSize: "1.15rem",
                        color: "#FFFFFF",
                        letterSpacing: "-0.5px",
                      }}
                    >
                      {item.step}
                    </span>
                  </div>

                  {/* Glass Card */}
                  <div
                    className="s-glass-card p-4 mx-auto h-100 d-flex flex-column justify-content-between"
                    style={{
                      maxWidth: "380px",
                      minHeight: "240px",
                    }}
                  >
                    <div>
                      <div
                        className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "14px",
                          background: item.bg,
                          color: item.color,
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <Icon size={24} />
                      </div>
                      <h3
                        className="s-heading-card text-white mb-2"
                        style={{ fontSize: "1.15rem" }}
                      >
                        {item.title}
                      </h3>
                      <p className="s-body small mb-3">
                        {item.description}
                      </p>
                    </div>

                    <div>
                      <span
                        className="s-pill"
                        style={{
                          padding: "3px 12px",
                          fontSize: "0.72rem",
                        }}
                      >
                        {item.badge}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
