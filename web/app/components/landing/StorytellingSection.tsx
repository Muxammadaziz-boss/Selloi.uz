"use client";

import React, { useState } from "react";
import {
  Camera,
  CheckCircle2,
  ShoppingBag,
  Send,
  Headphones,
  Check,
  Scan,
} from "lucide-react";

export default function StorytellingSection() {
  const [activeStep, setActiveStep] = useState<number>(2);

  return (
    <section id="sotuv-jarayoni" className="selloi-section position-relative">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="selloi-pill-badge">
              <span>SOTUV JARAYONI</span>
            </span>
          </div>
          <h2 className="selloi-section-title mb-3 text-white">
            Sotuv jarayoni 3 oddiy bosqichda
          </h2>
          <p
            className="text-secondary mx-auto"
            style={{ maxWidth: "620px", fontSize: "1.08rem", color: "#CBD5E1" }}
          >
            Mijoz bilan birinchi salomlashishdan tortib, fotosuratni tanish va buyurtma rasmiylashtirishgacha — barchasi soniyalar ichida avtomatik.
          </p>
        </div>

        {/* 3 Step Interactive Visual Cards */}
        <div className="row g-4 align-items-stretch position-relative">
          {/* STEP 01 — MULOQOT */}
          <div className="col-lg-4 d-flex">
            <div
              className="selloi-card w-100 p-4 p-xl-5 d-flex flex-column justify-content-between"
              style={{
                background: "#0E1019",
                borderColor: activeStep === 1 ? "rgba(168, 85, 247, 0.45)" : "rgba(255, 255, 255, 0.08)",
              }}
              onMouseEnter={() => setActiveStep(1)}
            >
              <div>
                {/* Header */}
                <div className="d-flex align-items-center gap-3 mb-4">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: "#181A28",
                      border: "1px solid rgba(168, 85, 247, 0.35)",
                      color: "#C084FC",
                      fontWeight: 800,
                      fontSize: "1rem",
                    }}
                  >
                    01
                  </div>
                  <div>
                    <h3 className="fw-bold mb-0 text-white" style={{ fontSize: "1.2rem" }}>
                      Muloqot
                    </h3>
                    <p className="text-secondary mb-0 small" style={{ color: "#94A3B8" }}>
                      Tabiiy tilda aqlli suhbat
                    </p>
                  </div>
                </div>

                {/* Telegram Chat Mockup */}
                <div
                  className="p-3 my-3 rounded-3"
                  style={{
                    background: "#080911",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* Customer Message */}
                  <div className="d-flex align-items-start gap-2 mb-3">
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
                      style={{ width: "28px", height: "28px", background: "#0284C7", color: "#FFF" }}
                    >
                      <Send size={13} />
                    </div>
                    <div
                      className="p-2.5 px-3"
                      style={{
                        background: "#161826",
                        borderRadius: "12px 12px 12px 3px",
                        fontSize: "0.84rem",
                        color: "#F1F5F9",
                        maxWidth: "88%",
                      }}
                    >
                      Assalomu alaykum! Shu naushnikdan bormi, sifati qanaqa?
                      <div className="text-end mt-1 text-white-50" style={{ fontSize: "0.65rem" }}>
                        12:40 • Yetkazildi
                      </div>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="d-flex align-items-start gap-2">
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
                      style={{ width: "28px", height: "28px", background: "#7C3AED", color: "#FFF", fontWeight: 700, fontSize: "0.8rem" }}
                    >
                      S
                    </div>
                    <div
                      className="p-2.5 px-3"
                      style={{
                        background: "#1D1635",
                        border: "1px solid rgba(168, 85, 247, 0.25)",
                        borderRadius: "12px 12px 12px 3px",
                        fontSize: "0.84rem",
                        color: "#FFFFFF",
                        maxWidth: "88%",
                      }}
                    >
                      Va alaykum assalom! Ha, 'Pro Wireless ANC' modelimiz omborda bor. 40 soat zaryad ushlaydi, shovqinni 95% to‘sadi. Narxi 320,000 so‘m. 🎧
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="pt-3 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
                <span className="badge rounded-pill bg-purple-subtle text-purple border border-purple-subtle">
                  Tabiiy til LLM
                </span>
                <span className="small text-secondary">O‘zbek, rus, ingliz</span>
              </div>
            </div>
          </div>

          {/* STEP 02 — MAHSULOTNI TANISH */}
          <div className="col-lg-4 d-flex">
            <div
              className="selloi-card w-100 p-4 p-xl-5 d-flex flex-column justify-content-between"
              style={{
                background: "#0E1019",
                borderColor: activeStep === 2 ? "rgba(168, 85, 247, 0.45)" : "rgba(255, 255, 255, 0.08)",
              }}
              onMouseEnter={() => setActiveStep(2)}
            >
              <div>
                {/* Header */}
                <div className="d-flex align-items-center gap-3 mb-4">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: "#181A28",
                      border: "1px solid rgba(56, 189, 248, 0.35)",
                      color: "#38BDF8",
                      fontWeight: 800,
                      fontSize: "1rem",
                    }}
                  >
                    02
                  </div>
                  <div>
                    <h3 className="fw-bold mb-0 text-white" style={{ fontSize: "1.2rem" }}>
                      Mahsulotni tanish
                    </h3>
                    <p className="text-secondary mb-0 small" style={{ color: "#94A3B8" }}>
                      Multimodal AI fotosurat tahlili
                    </p>
                  </div>
                </div>

                {/* Scanning Mockup */}
                <div
                  className="p-3 my-3 rounded-3 position-relative overflow-hidden"
                  style={{
                    background: "#080911",
                    border: "1px solid rgba(168, 85, 247, 0.25)",
                  }}
                >
                  <div className="selloi-laser-line" />

                  <div className="row g-3 align-items-center">
                    <div className="col-5">
                      <div
                        className="d-flex align-items-center justify-content-center position-relative rounded-2 p-3"
                        style={{
                          height: "110px",
                          background: "#121422",
                          border: "1px dashed rgba(168, 85, 247, 0.4)",
                        }}
                      >
                        <Headphones size={42} color="#C084FC" />
                        <div
                          className="position-absolute top-0 start-0 m-1.5 p-1 badge bg-dark text-info"
                          style={{ fontSize: "0.6rem" }}
                        >
                          <Scan size={9} className="me-1" /> 98.4%
                        </div>
                      </div>
                    </div>

                    <div className="col-7">
                      <div className="d-flex flex-column gap-1.5 small" style={{ fontSize: "0.78rem" }}>
                        <div className="fw-bold text-white mb-0.5">Gaming Naushnik</div>
                        <div className="d-flex align-items-center gap-1.5 text-secondary">
                          <Check size={12} color="#10B981" />
                          <span>Katalogdan topildi</span>
                        </div>
                        <div className="d-flex align-items-center gap-1.5 text-secondary">
                          <Check size={12} color="#10B981" />
                          <span>Midnight Black</span>
                        </div>
                        <div className="d-flex align-items-center gap-1.5 text-secondary">
                          <Check size={12} color="#10B981" />
                          <span>12 dona mavjud</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="pt-3 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
                <span className="badge rounded-pill bg-info-subtle text-info border border-info-subtle">
                  AI Vision 2.0
                </span>
                <span className="small text-secondary">0.8 soniyada tanish</span>
              </div>
            </div>
          </div>

          {/* STEP 03 — BUYURTMA */}
          <div className="col-lg-4 d-flex">
            <div
              className="selloi-card w-100 p-4 p-xl-5 d-flex flex-column justify-content-between"
              style={{
                background: "#0E1019",
                borderColor: activeStep === 3 ? "rgba(168, 85, 247, 0.45)" : "rgba(255, 255, 255, 0.08)",
              }}
              onMouseEnter={() => setActiveStep(3)}
            >
              <div>
                {/* Header */}
                <div className="d-flex align-items-center gap-3 mb-4">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: "#181A28",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      color: "#34D399",
                      fontWeight: 800,
                      fontSize: "1rem",
                    }}
                  >
                    03
                  </div>
                  <div>
                    <h3 className="fw-bold mb-0 text-white" style={{ fontSize: "1.2rem" }}>
                      Buyurtma
                    </h3>
                    <p className="text-secondary mb-0 small" style={{ color: "#94A3B8" }}>
                      Avtomatik shakllantirish
                    </p>
                  </div>
                </div>

                {/* Order Summary Mockup */}
                <div
                  className="p-3 my-3 rounded-3"
                  style={{
                    background: "#080911",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom border-secondary border-opacity-25">
                    <span className="fw-bold text-success d-flex align-items-center gap-1.5" style={{ fontSize: "0.82rem" }}>
                      <CheckCircle2 size={14} /> Buyurtma #1043
                    </span>
                    <span className="badge bg-success-subtle text-success" style={{ fontSize: "0.68rem" }}>
                      Tasdiqlandi
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-1.5 small" style={{ fontSize: "0.8rem" }}>
                    <div className="d-flex justify-content-between">
                      <span className="text-secondary">Mahsulot:</span>
                      <span className="text-white">Gaming naushnik x 1</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-secondary">Mijoz:</span>
                      <span className="text-white">+998 90 ••• •• 45</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-secondary">Manzil:</span>
                      <span className="text-white">Toshkent, Chilonzor</span>
                    </div>
                    <div className="d-flex justify-content-between pt-1 border-top border-secondary border-opacity-25">
                      <span className="text-secondary">Jami:</span>
                      <span className="text-success fw-bold">320,000 so‘m (To‘landi)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="pt-3 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
                <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle">
                  CRM Integratsiya
                </span>
                <span className="small text-secondary">Click, Payme, Naqd</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
