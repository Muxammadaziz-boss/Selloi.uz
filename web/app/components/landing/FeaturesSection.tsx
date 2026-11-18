"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Camera,
  Send,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Check,
  Scan,
  Zap,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Layers,
} from "lucide-react";

export default function FeaturesSection() {
  const [chatLang, setChatLang] = useState<"uz-lat" | "uz-kir" | "ru" | "en">("uz-lat");

  const chatExamples = {
    "uz-lat": {
      customer: "Assalomu alaykum! Qora krossovkadan 42 razmer bormi?",
      ai: "Va alaykum assalom! Ha, 'Air Runner Pro' qora rangda 42 razmer omborimizda 3 dona qolgan. Narxi 360,000 so‘m. Bepul yetkazib beramiz! 👟",
    },
    "uz-kir": {
      customer: "Ассалому алайкум! Қора кроссовкадан 42 размер борми?",
      ai: "Ва алайкум ассалом! Ҳа, 'Air Runner Pro' қора рангда 42 размер омборимизда 3 дона қолган. Нархи 360,000 сўм. Бепул етказиб берамиз! 👟",
    },
    ru: {
      customer: "Здравствуйте! Есть ли в наличии черные кроссовки 42 размера?",
      ai: "Здравствуйте! Да, кроссовки 'Air Runner Pro' в черном цвете (42 размер) в наличии, осталось 3 пары. Цена 360,000 сум. Бесплатная доставка! 👟",
    },
    en: {
      customer: "Hello! Do you have black sneakers in size 42?",
      ai: "Hello! Yes, 'Air Runner Pro' sneakers in black (size 42) are in stock (3 pairs left). Price is 360,000 UZS with free delivery! 👟",
    },
  };

  return (
    <section id="imkoniyatlar" className="selloi-section position-relative">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="selloi-pill-badge">
              <span>IMKONIYATLAR</span>
            </span>
          </div>
          <h2 className="selloi-section-title mb-3 text-white">
            Telegram savdosini avtomatlashtirishning yangi standarti
          </h2>
          <p
            className="text-secondary mx-auto"
            style={{ maxWidth: "620px", fontSize: "1.08rem", color: "#CBD5E1" }}
          >
            Har bir mijozga darhol javob bering, fotosuratdan tovarlarni toping va to‘lovlarni qabul qiling — dasturchilarsiz va 24/7 rejimida.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="selloi-bento-grid">
          {/* Bento Card 1: AI Chat (Span 7) — Interactive Multi-Language Showcase */}
          <div className="selloi-bento-span-7">
            <div
              className="selloi-card h-100 p-4 p-md-5 d-flex flex-column justify-content-between"
              style={{ background: "#0E1019" }}
            >
              <div>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-2.5">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "10px",
                        background: "#181A28",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        color: "#C084FC",
                      }}
                    >
                      <MessageSquare size={18} />
                    </div>
                    <span className="fw-bold text-white" style={{ fontSize: "1.1rem" }}>
                      AI Chat — Ko‘p tilli tabiiy muloqot
                    </span>
                  </div>
                  <span className="badge bg-purple-subtle text-purple" style={{ fontSize: "0.72rem" }}>
                    Multi-LLM
                  </span>
                </div>

                <p className="text-secondary mb-4" style={{ color: "#CBD5E1", fontSize: "0.95rem" }}>
                  O‘zbek tili (lotin va kirill), rus hamda ingliz tillarida haqiqiy xarid maslahatchisidek erkin muloqot qiladi. Shevalar, xatolar va so‘zlashuv uslubini to‘liq tushunadi.
                </p>

                {/* Interactive Language Selector Tabs */}
                <div className="d-flex flex-wrap gap-1.5 mb-3">
                  {[
                    { id: "uz-lat", label: "🇺🇿 O‘zbekcha (Lotin)" },
                    { id: "uz-kir", label: "🇺🇿 Ўзбекча (Кирилл)" },
                    { id: "ru", label: "🇷🇺 Русский" },
                    { id: "en", label: "🇬🇧 English" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setChatLang(tab.id as any)}
                      className={`btn btn-sm px-2.5 py-1 rounded-2 ${
                        chatLang === tab.id
                          ? "btn-primary text-white"
                          : "btn-dark text-secondary border border-secondary border-opacity-25"
                      }`}
                      style={{
                        fontSize: "0.78rem",
                        background: chatLang === tab.id ? "#7C3AED" : "transparent",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Simulated Live Chat Response in Selected Language */}
                <div
                  className="p-3 rounded-3"
                  style={{
                    background: "#080911",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* Customer line */}
                  <div className="d-flex justify-content-end mb-2">
                    <div
                      className="p-2 px-3 small rounded-3"
                      style={{ background: "#241D44", color: "#FFFFFF", maxWidth: "90%" }}
                    >
                      {chatExamples[chatLang].customer}
                    </div>
                  </div>
                  {/* AI line */}
                  <div className="d-flex align-items-start gap-2">
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#7C3AED", color: "#FFF", fontSize: "0.65rem", fontWeight: 700 }}
                    >
                      S
                    </div>
                    <div
                      className="p-2 px-3 small rounded-3 text-light"
                      style={{ background: "#131522", border: "1px solid rgba(255,255,255,0.06)", maxWidth: "90%" }}
                    >
                      {chatExamples[chatLang].ai}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-4 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between small text-secondary">
                <span>✓ Do‘koningiz xarakteriga mos ohang (tone of voice)</span>
                <span className="text-success fw-medium">Real-vaqt sinov</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: AI Vision (Span 5) — Computer Vision Product Scanning */}
          <div className="selloi-bento-span-5">
            <div
              className="selloi-card h-100 p-4 p-md-5 d-flex flex-column justify-content-between"
              style={{ background: "#0E1019" }}
            >
              <div>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-2.5">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "10px",
                        background: "#181A28",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        color: "#38BDF8",
                      }}
                    >
                      <Camera size={18} />
                    </div>
                    <span className="fw-bold text-white" style={{ fontSize: "1.1rem" }}>
                      AI Vision — Rasmdan tovar tanish
                    </span>
                  </div>
                  <span className="badge bg-info-subtle text-info" style={{ fontSize: "0.72rem" }}>
                    CV 2.0
                  </span>
                </div>

                <p className="text-secondary mb-3" style={{ color: "#CBD5E1", fontSize: "0.95rem" }}>
                  Mijoz yuborgan fotosuratni tahlil qilib, kanalingiz katalogidagi aynan o‘sha modelni 0.8 soniyada topadi.
                </p>

                {/* Laser Scanning Product Card */}
                <div
                  className="p-3 rounded-3 position-relative overflow-hidden mb-2"
                  style={{
                    background: "#080911",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                  }}
                >
                  <div className="selloi-laser-line" />

                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-info fw-bold d-flex align-items-center gap-1.5">
                      <Scan size={14} /> Tahlil natijasi
                    </span>
                    <span className="badge bg-success text-white" style={{ fontSize: "0.65rem" }}>
                      99.4% Moslik
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-1.5 small" style={{ fontSize: "0.8rem" }}>
                    <div className="d-flex justify-content-between">
                      <span className="text-secondary">Tovar:</span>
                      <span className="text-white fw-medium">Air Runner Sneakers</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-secondary">Rangi / O‘lcham:</span>
                      <span className="text-white">Midnight Black (42)</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-secondary">Ombor zaxirasi:</span>
                      <span className="text-success fw-bold">3 dona mavjud</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-top border-secondary border-opacity-25 small text-secondary">
                <span>Kiyim, poyabzal, sumka va gadjetlarni 100% taniydi</span>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Telegram Sync (Span 4) */}
          <div className="selloi-bento-span-4">
            <div
              className="selloi-card h-100 p-4 d-flex flex-column justify-content-between"
              style={{ background: "#0E1019" }}
            >
              <div>
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: "#181A28",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38BDF8",
                  }}
                >
                  <Send size={18} />
                </div>
                <h4 className="fw-bold text-white mb-2" style={{ fontSize: "1.1rem" }}>
                  Telegram Sync
                </h4>
                <p className="text-secondary small mb-3" style={{ color: "#94A3B8" }}>
                  Kanalingizdagi postlar va fotosuratlarni avtomatik o‘qib, AI xotirasiga kiritadi.
                </p>

                <div
                  className="p-2.5 rounded-2 d-flex align-items-center justify-content-between small"
                  style={{ background: "#080911", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="text-secondary">Kanal posti</span>
                  <ArrowRight size={14} color="#38BDF8" />
                  <span className="text-white fw-medium">Katalog tovari</span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-top border-secondary border-opacity-25 small text-success">
                ✓ Post qo‘shilganda darhol yangilanadi
              </div>
            </div>
          </div>

          {/* Bento Card 4: Smart Orders CRM (Span 4) */}
          <div className="selloi-bento-span-4">
            <div
              className="selloi-card h-100 p-4 d-flex flex-column justify-content-between"
              style={{ background: "#0E1019" }}
            >
              <div>
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: "#181A28",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#34D399",
                  }}
                >
                  <ShoppingCart size={18} />
                </div>
                <h4 className="fw-bold text-white mb-2" style={{ fontSize: "1.1rem" }}>
                  Smart Orders CRM
                </h4>
                <p className="text-secondary small mb-3" style={{ color: "#94A3B8" }}>
                  Mijozdan ism, telefon va manzilni yig‘adi, buyurtmani boshqaruv paneliga yuboradi.
                </p>

                <div
                  className="p-2.5 rounded-2 d-flex align-items-center justify-content-between small"
                  style={{ background: "#080911", border: "1px solid rgba(16,185,129,0.2)" }}
                >
                  <span className="text-secondary">#1044 buyurtma</span>
                  <span className="badge bg-success-subtle text-success">Qabul qilindi</span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-top border-secondary border-opacity-25 small text-secondary">
                <span>Mijozlar bazasi va yetkazib berish nazorati</span>
              </div>
            </div>
          </div>

          {/* Bento Card 5: Click & Payme (Span 4) */}
          <div className="selloi-bento-span-4">
            <div
              className="selloi-card h-100 p-4 d-flex flex-column justify-content-between"
              style={{ background: "#0E1019" }}
            >
              <div>
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: "#181A28",
                    border: "1px solid rgba(251, 191, 36, 0.3)",
                    color: "#FBBF24",
                  }}
                >
                  <CreditCard size={18} />
                </div>
                <h4 className="fw-bold text-white mb-2" style={{ fontSize: "1.1rem" }}>
                  Click & Payme To‘lovlar
                </h4>
                <p className="text-secondary small mb-3" style={{ color: "#94A3B8" }}>
                  Xaridor buyurtma berishi bilan bot to‘lov havolasini yuboradi va statusni yangilaydi.
                </p>

                <div className="d-flex gap-2">
                  <span className="badge bg-dark border border-secondary border-opacity-25 text-light px-2.5 py-1.5 small">
                    Click Up
                  </span>
                  <span className="badge bg-dark border border-secondary border-opacity-25 text-light px-2.5 py-1.5 small">
                    Payme
                  </span>
                  <span className="badge bg-dark border border-secondary border-opacity-25 text-light px-2.5 py-1.5 small">
                    Uzcard / Humo
                  </span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-top border-secondary border-opacity-25 small text-secondary">
                <span>Avtomatik hisob-faktura va chek</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
