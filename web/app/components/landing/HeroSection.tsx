"use client";

import React, { useState, useEffect, useRef } from "react";
import ThreeAICore from "./ThreeAICore";
import {
  ArrowRight,
  Send,
  Camera,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Zap,
  CheckCheck,
} from "lucide-react";

interface HeroSectionProps {
  onOpenOnboarding: () => void;
}

export default function HeroSection({ onOpenOnboarding }: HeroSectionProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setMousePos({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      ref={heroRef}
      className="position-relative overflow-hidden"
      style={{
        minHeight: "92vh",
        display: "flex",
        alignItems: "center",
        paddingTop: "40px",
        paddingBottom: "80px",
      }}
    >
      {/* Background Volumetric Lighting */}
      <div
        className="position-absolute"
        style={{
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "700px",
          height: "500px",
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(147, 3, 197, 0.16), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="s-container position-relative" style={{ zIndex: 2 }}>
        <div className="row align-items-center g-5">
          {/* Left Column: Story & Call to Action */}
          <div className="col-lg-6">
            {/* Pill Badge */}
            <div className="mb-4">
              <span className="s-pill">
                <Sparkles size={13} />
                <span>INTELLIGENCE IN MOTION</span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="s-heading-hero mb-4">
              Telegram do‘koningiz uchun{" "}
              <span className="s-gradient-purple d-block">
                24/7 ishlovchi AI sotuvchi.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p
              className="s-body-lg mb-5"
              style={{ maxWidth: "540px", color: "var(--s-text-secondary)" }}
            >
              Mijozlaringiz bilan muloqot qiladigan, mahsulotlarni taniydigan va
              buyurtmalarni avtomatik boshqaradigan yangi avlod sun’iy intellekti.
            </p>

            {/* CTA Buttons */}
            <div className="d-flex flex-wrap align-items-center gap-3 mb-5">
              <button onClick={onOpenOnboarding} className="s-btn-primary">
                <span>7 kun bepul boshlash</span>
                <ArrowRight size={16} />
              </button>

              <a href="#imkoniyatlar" className="s-btn-secondary">
                <span>Imkoniyatlarni ko‘rish</span>
              </a>
            </div>

            {/* Micro Trust Indicators */}
            <div
              className="pt-4 d-flex flex-wrap align-items-center gap-4"
              style={{
                borderTop: "1px solid var(--s-glass-border)",
                fontSize: "var(--s-text-sm)",
                color: "var(--s-text-muted)",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "20px",
                    height: "20px",
                    background: "rgba(180, 74, 255, 0.15)",
                    color: "var(--s-purple-bright)",
                  }}
                >
                  <CheckCircle2 size={13} />
                </div>
                <span>O‘zbek tilida erkin</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "20px",
                    height: "20px",
                    background: "rgba(65, 105, 255, 0.15)",
                    color: "var(--s-blue-soft)",
                  }}
                >
                  <Send size={11} />
                </div>
                <span>Telegram Bot & Kanal</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "20px",
                    height: "20px",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "var(--s-emerald)",
                  }}
                >
                  <Zap size={11} />
                </div>
                <span>Kredit karta talab etilmaydi</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D AI Core & Orbiting Holographic Cards */}
          <div className="col-lg-6 position-relative">
            <div
              className="position-relative d-flex align-items-center justify-content-center"
              style={{ minHeight: "520px" }}
            >
              {/* 3D Core WebGL Canvas */}
              <div
                style={{
                  width: "100%",
                  height: "520px",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <ThreeAICore intensity={1.1} />
              </div>

              {/* Floating Orbiting Glass Card 1: Telegram Customer Query (Top Left) */}
              <div
                className="position-absolute d-none d-md-flex align-items-center gap-2.5 p-3 rounded-4"
                style={{
                  top: "12%",
                  left: "-4%",
                  zIndex: 4,
                  background: "rgba(19, 17, 34, 0.82)",
                  border: "1px solid rgba(180, 74, 255, 0.35)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
                  transform: `translate3d(${mousePos.x * -16}px, ${mousePos.y * -16}px, 0)`,
                  transition: "transform 0.15s ease-out",
                  maxWidth: "240px",
                }}
              >
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                  style={{
                    width: "32px",
                    height: "32px",
                    background: "var(--s-blue)",
                    color: "#FFF",
                  }}
                >
                  <Send size={14} />
                </div>
                <div className="small">
                  <div className="fw-semibold text-white" style={{ fontSize: "0.8rem" }}>
                    "Qora oversize xudi bormi?"
                  </div>
                  <div
                    className="d-flex align-items-center gap-1 mt-0.5"
                    style={{ fontSize: "0.7rem", color: "var(--s-text-muted)" }}
                  >
                    <span>12:44</span>
                    <CheckCheck size={12} color="var(--s-cyan)" />
                  </div>
                </div>
              </div>

              {/* Floating Orbiting Glass Card 2: AI Vision Scanner (Top Right) */}
              <div
                className="position-absolute d-none d-md-flex align-items-center gap-2.5 p-2.5 px-3 rounded-pill"
                style={{
                  top: "6%",
                  right: "4%",
                  zIndex: 4,
                  background: "rgba(19, 17, 34, 0.85)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                  transform: `translate3d(${mousePos.x * 20}px, ${mousePos.y * 20}px, 0)`,
                  transition: "transform 0.15s ease-out",
                }}
              >
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: "28px",
                    height: "28px",
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "var(--s-cyan)",
                  }}
                >
                  <Camera size={14} />
                </div>
                <div>
                  <div className="fw-bold text-white" style={{ fontSize: "0.78rem" }}>
                    AI Vision: 99.4%
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--s-cyan)" }}>
                    Rasm tahlil qilindi
                  </div>
                </div>
              </div>

              {/* Floating Orbiting Glass Card 3: Smart Order Confirmation (Bottom Right) */}
              <div
                className="position-absolute d-none d-md-flex flex-column gap-1.5 p-3 rounded-4"
                style={{
                  bottom: "10%",
                  right: "-2%",
                  zIndex: 4,
                  background: "rgba(19, 17, 34, 0.85)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 20px 45px rgba(0,0,0,0.6)",
                  transform: `translate3d(${mousePos.x * -24}px, ${mousePos.y * -24}px, 0)`,
                  transition: "transform 0.15s ease-out",
                  minWidth: "220px",
                }}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <span
                    className="fw-bold text-success d-flex align-items-center gap-1"
                    style={{ fontSize: "0.78rem" }}
                  >
                    <CheckCircle2 size={13} /> Buyurtma #1042
                  </span>
                  <span
                    className="badge rounded-pill text-success"
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      fontSize: "0.65rem",
                    }}
                  >
                    Avtomatik
                  </span>
                </div>
                <div
                  className="text-white fw-medium"
                  style={{ fontSize: "0.8rem" }}
                >
                  Hoodie L • 240,000 so‘m
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--s-text-muted)" }}>
                  Click orqali to‘landi
                </div>
              </div>

              {/* Floating Orbiting Glass Card 4: Product Pill (Bottom Left) */}
              <div
                className="position-absolute d-none d-md-flex align-items-center gap-2 p-2 px-3 rounded-pill"
                style={{
                  bottom: "8%",
                  left: "6%",
                  zIndex: 4,
                  background: "rgba(19, 17, 34, 0.85)",
                  border: "1px solid rgba(180, 74, 255, 0.3)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
                  transform: `translate3d(${mousePos.x * 14}px, ${mousePos.y * 14}px, 0)`,
                  transition: "transform 0.15s ease-out",
                }}
              >
                <ShoppingBag size={14} color="var(--s-purple-soft)" />
                <span className="fw-semibold text-white" style={{ fontSize: "0.76rem" }}>
                  Katalog sinxronlangan
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Animated Scroll Indicator */}
      <div className="s-scroll-indicator">
        <span>IMKONIYATLAR</span>
        <div className="s-scroll-line" />
      </div>
    </section>
  );
}
