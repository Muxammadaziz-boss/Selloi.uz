"use client";

import React from "react";
import { UserPlus, Send, Bot, Zap } from "lucide-react";
import { HOW_IT_WORKS_STEPS } from "./data";

export default function HowItWorksSection() {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "user-plus":
        return <UserPlus size={22} color="#C084FC" />;
      case "send":
        return <Send size={22} color="#38BDF8" />;
      case "bot":
        return <Bot size={22} color="#34D399" />;
      default:
        return <Zap size={22} color="#C084FC" />;
    }
  };

  return (
    <section id="boshlash" className="selloi-section position-relative">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="selloi-pill-badge">
              <Zap size={12} />
              <span>BOSHLASH</span>
            </span>
          </div>
          <h2 className="selloi-section-title mb-3 text-white">
            Selloi bilan boshlash juda oson
          </h2>
          <p
            className="text-secondary mx-auto"
            style={{ maxWidth: "600px", fontSize: "1.08rem", color: "#CBD5E1" }}
          >
            Hech qanday murakkab texnik sozlamalarsiz, 3 ta oddiy qadamda AI sotuvchingizni Telegram do‘koningizga ulang.
          </p>
        </div>

        {/* Connected 3-Step Horizontal Timeline */}
        <div className="position-relative py-2">
          {/* Subtle horizontal connector line on desktop */}
          <div
            className="d-none d-lg-block position-absolute"
            style={{
              top: "40px",
              left: "18%",
              right: "18%",
              height: "1px",
              background: "linear-gradient(90deg, rgba(124, 58, 237, 0.3) 0%, rgba(168, 85, 247, 0.7) 50%, rgba(56, 189, 248, 0.4) 100%)",
              zIndex: 1,
            }}
          />

          <div className="row g-4 position-relative z-2">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div key={item.step} className="col-lg-4 text-center">
                {/* Step Circle Badge */}
                <div
                  className="mx-auto mb-4 d-flex align-items-center justify-content-center"
                  style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "50%",
                    background: "#161826",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    fontSize: "1.05rem",
                    border: "1px solid rgba(168, 85, 247, 0.4)",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                  }}
                >
                  {item.step}
                </div>

                {/* Step Card */}
                <div
                  className="selloi-card p-4 mx-auto h-100 d-flex flex-column justify-content-between"
                  style={{
                    maxWidth: "360px",
                    minHeight: "210px",
                    background: "#0E1019",
                  }}
                >
                  <div>
                    <div
                      className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: "#161826",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      {getIcon(item.icon)}
                    </div>
                    <h3
                      className="fw-bold mb-2 text-white"
                      style={{ fontSize: "1.15rem", letterSpacing: "-0.2px" }}
                    >
                      {item.title}
                    </h3>
                    <p
                      className="text-secondary mb-3"
                      style={{ fontSize: "0.9rem", lineHeight: 1.55, color: "#CBD5E1" }}
                    >
                      {item.description}
                    </p>
                  </div>

                  <div>
                    <span className="badge bg-purple-subtle text-purple border border-purple-subtle" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
                      {item.badge}
                    </span>
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
