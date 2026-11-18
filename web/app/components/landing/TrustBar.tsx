"use client";

import React from "react";
import { TRUST_METRICS } from "./data";
import { Clock, Globe, Target, Zap } from "lucide-react";

export default function TrustBar() {
  const getIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Clock size={18} color="#C084FC" />;
      case 1:
        return <Globe size={18} color="#38BDF8" />;
      case 2:
        return <Target size={18} color="#34D399" />;
      case 3:
      default:
        return <Zap size={18} color="#FBBF24" />;
    }
  };

  return (
    <section className="py-2 position-relative z-2">
      <div className="selloi-container">
        <div
          className="p-4 p-md-4 rounded-4"
          style={{
            background: "#0D0E17",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div className="row g-4 align-items-center">
            {TRUST_METRICS.map((metric, idx) => (
              <div
                key={metric.value}
                className={`col-6 col-md-3 ${
                  idx !== TRUST_METRICS.length - 1
                    ? "border-end-md border-secondary border-opacity-25"
                    : ""
                }`}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: "#151624",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    {getIcon(idx)}
                  </div>
                  <div>
                    <div
                      className="fw-extrabold text-white"
                      style={{
                        fontSize: "clamp(1.4rem, 2.2vw, 1.85rem)",
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
                      className="text-secondary small"
                      style={{ fontSize: "0.76rem", color: "#94A3B8" }}
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
