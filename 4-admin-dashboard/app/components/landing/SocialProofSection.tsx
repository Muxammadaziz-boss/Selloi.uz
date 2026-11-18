"use client";

import React from "react";
import { TESTIMONIALS, PARTNER_LOGOS } from "./data";
import { Star, Quote, CheckCircle2, Store } from "lucide-react";

export default function SocialProofSection() {
  return (
    <section className="selloi-section position-relative">
      <div className="selloi-container">
        {/* Partner Store Badges Strip */}
        <div className="text-center mb-5">
          <p
            className="text-secondary small text-uppercase fw-semibold mb-3.5"
            style={{ letterSpacing: "0.08em", color: "#94A3B8", fontSize: "0.78rem" }}
          >
            Telegram tarmog‘idagi faol do‘konlar va brendlar
          </p>

          <div className="d-flex flex-wrap align-items-center justify-content-center gap-2.5 gap-md-3">
            {PARTNER_LOGOS.map((partner) => (
              <div
                key={partner.name}
                className="px-3.5 py-2 rounded-2 d-flex align-items-center gap-2"
                style={{
                  background: "#0D0E17",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <Store size={14} color="#A855F7" />
                <span className="fw-medium text-light small" style={{ fontSize: "0.82rem" }}>
                  {partner.label}
                </span>
                <span
                  className="badge bg-secondary bg-opacity-25 text-secondary"
                  style={{ fontSize: "0.62rem" }}
                >
                  {partner.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section Header */}
        <div className="text-center mb-5 pt-3">
          <div className="mb-3">
            <span className="selloi-pill-badge">
              <span>FIKRLAR VA NATIJALAR</span>
            </span>
          </div>
          <h2 className="selloi-section-title mb-3 text-white">
            Do‘kon egalarining haqiqiy tajribalari
          </h2>
          <p
            className="text-secondary mx-auto"
            style={{ maxWidth: "600px", fontSize: "1.08rem", color: "#CBD5E1" }}
          >
            Biznesini avtomatlashtirgan va sotuvlarini oshirgan tadbirkorlar nima deydi?
          </p>
        </div>

        {/* 3 Testimonials Cards Grid */}
        <div className="row g-4">
          {TESTIMONIALS.map((t) => (
            <div key={t.id} className="col-lg-4">
              <div
                className="selloi-card h-100 p-4 p-md-5 d-flex flex-column justify-content-between position-relative"
                style={{
                  background: "#0E1019",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "#181A28",
                        color: "#C084FC",
                      }}
                    >
                      <Quote size={16} />
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          fill="#FBBF24"
                          color="#FBBF24"
                        />
                      ))}
                    </div>
                  </div>

                  <p
                    className="mb-4"
                    style={{
                      color: "#F1F5F9",
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                    }}
                  >
                    “{t.quote}”
                  </p>
                </div>

                <div className="pt-3 border-top border-secondary border-opacity-25">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <div className="fw-bold text-white d-flex align-items-center gap-1.5" style={{ fontSize: "0.88rem" }}>
                        <span>{t.author}</span>
                        <CheckCircle2 size={12} color="#38BDF8" />
                      </div>
                      <div className="small text-secondary" style={{ color: "#94A3B8", fontSize: "0.78rem" }}>
                        {t.role}
                      </div>
                    </div>
                    <span className="badge bg-purple-subtle text-purple" style={{ fontSize: "0.7rem" }}>
                      {t.stats}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
