"use client";

import React from "react";
import HeroVisual from "./HeroVisual";
import { ArrowRight, Send, Layers, CheckCircle2, Bot } from "lucide-react";

interface HeroSectionProps {
  onOpenOnboarding: () => void;
}

export default function HeroSection({ onOpenOnboarding }: HeroSectionProps) {
  return (
    <section className="position-relative pt-4 pb-5 overflow-hidden">
      <div className="selloi-container">
        <div className="row align-items-center g-5 py-4 py-lg-5">
          {/* Left Column: Headline, Value Proposition & CTAs */}
          <div className="col-lg-6 z-2">
            {/* Precision Eyebrow Badge */}
            <div className="mb-3.5">
              <span className="selloi-pill-badge">
                <Bot size={13} color="#C084FC" />
                <span>TELEGRAM AI SALES ENGINE</span>
              </span>
            </div>

            {/* Confident, Tight Headline */}
            <h1
              className="display-4 fw-bold mb-4 text-white"
              style={{
                letterSpacing: "-0.04em",
                lineHeight: 1.12,
                fontSize: "clamp(2.3rem, 4.8vw, 3.75rem)",
              }}
            >
              Telegram do‘koningiz uchun 24/7 ishlovchi{" "}
              <span className="selloi-gradient-purple">
                Sun’iy Intellekt sotuvchisi
              </span>
            </h1>

            {/* High-Contrast Description */}
            <p
              className="lead mb-4"
              style={{
                color: "#CBD5E1",
                fontSize: "1.15rem",
                lineHeight: 1.65,
                maxWidth: "540px",
              }}
            >
              Mijozlaringiz bilan o‘zbek tilida erkin muloqot qiladi, fotosuratdagi
              mahsulotlarni bir soniyada taniydi, buyurtmalarni shakllantiradi va
              savdongizni to‘liq avtomatlashtiradi.
            </p>

            {/* Action Buttons (Linear style) */}
            <div className="d-flex flex-wrap align-items-center gap-3 mb-5">
              <button
                onClick={onOpenOnboarding}
                className="selloi-btn-primary"
                style={{ fontSize: "1.02rem", padding: "13px 28px" }}
              >
                <span>7 kun bepul boshlash</span>
                <ArrowRight size={16} />
              </button>

              <a
                href="#sotuv-jarayoni"
                className="selloi-btn-secondary"
                style={{ fontSize: "1.02rem", padding: "13px 26px" }}
              >
                <span>Imkoniyatlarni ko‘rish</span>
              </a>
            </div>

            {/* Trust Indicators Bar */}
            <div
              className="pt-4 border-top border-secondary border-opacity-25 d-flex flex-wrap align-items-center gap-4"
              style={{ color: "#CBD5E1", fontSize: "0.88rem" }}
            >
              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "22px",
                    height: "22px",
                    background: "rgba(124, 58, 237, 0.2)",
                    color: "#C084FC",
                  }}
                >
                  <CheckCircle2 size={13} />
                </div>
                <span>O‘zbek tilida tabiiy muloqot</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "22px",
                    height: "22px",
                    background: "rgba(56, 189, 248, 0.2)",
                    color: "#38BDF8",
                  }}
                >
                  <Send size={12} />
                </div>
                <span>Telegram Bot & Kanal integratsiyasi</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "22px",
                    height: "22px",
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#34D399",
                  }}
                >
                  <Layers size={12} />
                </div>
                <span>Kredit karta talab etilmaydi</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Fidelity Product Showcase */}
          <div className="col-lg-6 position-relative z-2">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
