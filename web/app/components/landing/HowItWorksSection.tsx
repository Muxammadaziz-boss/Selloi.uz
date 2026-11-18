"use client";

import React from "react";
import { UserPlus, Send, Bot, Sparkles, Zap, ArrowRight, ShieldCheck } from "lucide-react";

export default function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Ro‘yxatdan o‘ting",
      description: "1 daqiqada o‘z do‘kon hisobingizni oching va qulay boshqaruv paneliga kiring.",
      badge: "1 daqiqa",
      icon: UserPlus,
      color: "var(--s-purple-soft)",
      bg: "rgba(180, 74, 255, 0.15)",
    },
    {
      step: "02",
      title: "Telegram'ni ulang",
      description: "Bot tokeningizni kiriting va do‘kon kanalingizni ko‘rsating. Katalog avtomatik o‘qiladi.",
      badge: "Avtomatik sinxronizatsiya",
      icon: Send,
      color: "var(--s-cyan)",
      bg: "rgba(56, 189, 248, 0.15)",
    },
    {
      step: "03",
      title: "AI sotuvchini faollashtiring",
      description: "AI sotuvchingiz mijozlaringiz bilan kechayu kunduz professional muloqotni boshlaydi.",
      badge: "24/7 faol",
      icon: Bot,
      color: "var(--s-emerald)",
      bg: "rgba(16, 185, 129, 0.15)",
    },
  ];

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
              <span>3 ODDIY QADAM</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            Selloi bilan boshlash{" "}
            <span className="s-gradient-purple">juda oson</span>
          </h2>
          <p className="s-body-lg mx-auto" style={{ maxWidth: "600px" }}>
            Hech qanday murakkab texnik sozlamalarsiz, 3 ta oddiy qadamda AI sotuvchingizni
            Telegram do‘koningizga ulang.
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
