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
  ShieldCheck,
  Bot,
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
    <section id="imkoniyatlar" className="s-section position-relative">
      <div className="s-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="s-pill">
              <Sparkles size={13} />
              <span>IMKONIYATLAR</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            Telegram savdosining{" "}
            <span className="s-gradient-purple">yangi standarti</span>
          </h2>
          <p
            className="s-body-lg mx-auto"
            style={{ maxWidth: "640px" }}
          >
            Har bir mijozga darhol javob bering, fotosuratdan tovarlarni toping va
            to‘lovlarni qabul qiling — dasturchilarsiz va 24/7 rejimida.
          </p>
        </div>

        {/* Bento Grid with Floating Glass Architecture */}
        <div className="s-bento">
          {/* Card 1: AI Chat (Span 7) — Interactive Multi-Language Showcase */}
          <div className="s-bento-7">
            <div className="s-glass-card h-100 p-4 p-md-5 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "rgba(180, 74, 255, 0.15)",
                        border: "1px solid rgba(180, 74, 255, 0.35)",
                        color: "var(--s-purple-soft)",
                      }}
                    >
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <h3 className="s-heading-card text-white mb-0">
                        AI Chat — Ko‘p tilli muloqot
                      </h3>
                      <span className="small" style={{ color: "var(--s-text-muted)" }}>
                        Tabiiy tilda aqlli suhbatlashuv
                      </span>
                    </div>
                  </div>
                  <span className="s-pill" style={{ padding: "3px 10px", fontSize: "0.72rem" }}>
                    Multi-LLM
                  </span>
                </div>

                <p className="s-body mb-4" style={{ maxWidth: "580px" }}>
                  O‘zbek tili (lotin va kirill), rus hamda ingliz tillarida haqiqiy xarid
                  maslahatchisidek erkin muloqot qiladi. Shevalar, xatolar va so‘zlashuv
                  uslubini to‘liq tushunadi.
                </p>

                {/* Interactive Language Selector Tabs */}
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {[
                    { id: "uz-lat", label: "🇺🇿 O‘zbekcha (Lotin)" },
                    { id: "uz-kir", label: "🇺🇿 Ўзбекча (Кирилл)" },
                    { id: "ru", label: "🇷🇺 Русский" },
                    { id: "en", label: "🇬🇧 English" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setChatLang(tab.id as any)}
                      className="px-3 py-1.5 rounded-pill border-0"
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        background:
                          chatLang === tab.id
                            ? "linear-gradient(180deg, var(--s-purple-bright) 0%, var(--s-purple) 100%)"
                            : "rgba(255, 255, 255, 0.05)",
                        color: chatLang === tab.id ? "#FFFFFF" : "var(--s-text-muted)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Simulated Live Chat Response */}
                <div
                  className="p-3 rounded-4"
                  style={{
                    background: "rgba(7, 6, 15, 0.7)",
                    border: "1px solid var(--s-glass-border)",
                  }}
                >
                  <div className="d-flex justify-content-end mb-2">
                    <div
                      className="p-2.5 px-3.5 small rounded-4"
                      style={{
                        background: "rgba(42, 32, 80, 0.7)",
                        border: "1px solid rgba(180, 74, 255, 0.3)",
                        color: "#FFFFFF",
                        maxWidth: "88%",
                      }}
                    >
                      {chatExamples[chatLang].customer}
                    </div>
                  </div>
                  <div className="d-flex align-items-start gap-2">
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "var(--s-purple)",
                        color: "#FFF",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                      }}
                    >
                      S
                    </div>
                    <div
                      className="p-2.5 px-3.5 small rounded-4"
                      style={{
                        background: "rgba(20, 22, 36, 0.8)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#F1F5F9",
                        maxWidth: "88%",
                      }}
                    >
                      {chatExamples[chatLang].ai}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="pt-3 mt-4 d-flex align-items-center justify-content-between small"
                style={{
                  borderTop: "1px solid var(--s-glass-border)",
                  color: "var(--s-text-muted)",
                }}
              >
                <span>✓ Do‘koningiz xarakteriga mos ohang (tone of voice)</span>
                <span className="text-success fw-medium">Real-vaqt sinov</span>
              </div>
            </div>
          </div>

          {/* Card 2: AI Vision (Span 5) — Computer Vision Product Scanning */}
          <div className="s-bento-5">
            <div className="s-glass-card h-100 p-4 p-md-5 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        color: "var(--s-cyan)",
                      }}
                    >
                      <Camera size={20} />
                    </div>
                    <div>
                      <h3 className="s-heading-card text-white mb-0">
                        AI Vision
                      </h3>
                      <span className="small" style={{ color: "var(--s-text-muted)" }}>
                        Rasmdan tovar tanish
                      </span>
                    </div>
                  </div>
                  <span className="s-pill s-pill-blue" style={{ padding: "3px 10px", fontSize: "0.72rem" }}>
                    CV 2.0
                  </span>
                </div>

                <p className="s-body mb-3">
                  Mijoz yuborgan fotosuratni tahlil qilib, kanalingiz katalogidagi aynan
                  o‘sha modelni 0.8 soniyada topadi.
                </p>

                {/* Laser Scanning Product Card */}
                <div
                  className="p-3 rounded-4 position-relative overflow-hidden mb-2"
                  style={{
                    background: "rgba(7, 6, 15, 0.7)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  <div className="s-laser-line" />

                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-info fw-bold d-flex align-items-center gap-1.5">
                      <Scan size={14} /> Tahlil natijasi
                    </span>
                    <span className="badge bg-success text-white" style={{ fontSize: "0.68rem" }}>
                      99.4% Moslik
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-1.5 small" style={{ fontSize: "0.82rem" }}>
                    <div className="d-flex justify-content-between">
                      <span style={{ color: "var(--s-text-muted)" }}>Tovar:</span>
                      <span className="text-white fw-medium">Air Runner Sneakers</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span style={{ color: "var(--s-text-muted)" }}>Rangi / O‘lcham:</span>
                      <span className="text-white">Midnight Black (42)</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span style={{ color: "var(--s-text-muted)" }}>Ombor zaxirasi:</span>
                      <span className="text-success fw-bold">3 dona mavjud</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="pt-3 mt-3 small"
                style={{
                  borderTop: "1px solid var(--s-glass-border)",
                  color: "var(--s-text-muted)",
                }}
              >
                <span>Kiyim, poyabzal, sumka va gadjetlarni 100% taniydi</span>
              </div>
            </div>
          </div>

          {/* Card 3: Telegram Sync (Span 4) */}
          <div className="s-bento-4">
            <div className="s-glass-card h-100 p-4 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "var(--s-cyan)",
                  }}
                >
                  <Send size={18} />
                </div>
                <h4 className="s-heading-card text-white mb-2">Telegram Sync</h4>
                <p className="s-body small mb-3">
                  Kanalingizdagi postlar va fotosuratlarni avtomatik o‘qib, AI xotirasiga kiritadi.
                </p>

                <div
                  className="p-2.5 rounded-3 d-flex align-items-center justify-content-between small"
                  style={{
                    background: "rgba(7, 6, 15, 0.7)",
                    border: "1px solid var(--s-glass-border)",
                  }}
                >
                  <span style={{ color: "var(--s-text-muted)" }}>Kanal posti</span>
                  <ArrowRight size={14} color="var(--s-cyan)" />
                  <span className="text-white fw-medium">Katalog tovari</span>
                </div>
              </div>

              <div
                className="pt-3 mt-3 small text-success"
                style={{ borderTop: "1px solid var(--s-glass-border)" }}
              >
                ✓ Post qo‘shilganda darhol yangilanadi
              </div>
            </div>
          </div>

          {/* Card 4: Smart Orders CRM (Span 4) */}
          <div className="s-bento-4">
            <div className="s-glass-card h-100 p-4 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "var(--s-emerald)",
                  }}
                >
                  <ShoppingCart size={18} />
                </div>
                <h4 className="s-heading-card text-white mb-2">Smart Orders CRM</h4>
                <p className="s-body small mb-3">
                  Mijozdan ism, telefon va manzilni yig‘adi, buyurtmani boshqaruv paneliga yuboradi.
                </p>

                <div
                  className="p-2.5 rounded-3 d-flex align-items-center justify-content-between small"
                  style={{
                    background: "rgba(7, 6, 15, 0.7)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <span style={{ color: "var(--s-text-muted)" }}>#1044 buyurtma</span>
                  <span className="badge bg-success-subtle text-success">Qabul qilindi</span>
                </div>
              </div>

              <div
                className="pt-3 mt-3 small"
                style={{
                  borderTop: "1px solid var(--s-glass-border)",
                  color: "var(--s-text-muted)",
                }}
              >
                <span>Mijozlar bazasi va yetkazib berish nazorati</span>
              </div>
            </div>
          </div>

          {/* Card 5: Click & Payme (Span 4) */}
          <div className="s-bento-4">
            <div className="s-glass-card h-100 p-4 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    color: "var(--s-amber)",
                  }}
                >
                  <CreditCard size={18} />
                </div>
                <h4 className="s-heading-card text-white mb-2">Click & Payme</h4>
                <p className="s-body small mb-3">
                  Xaridor buyurtma berishi bilan bot to‘lov havolasini yuboradi va statusni yangilaydi.
                </p>

                <div className="d-flex gap-2">
                  <span
                    className="badge border px-2.5 py-1.5 small text-light"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "var(--s-glass-border)",
                    }}
                  >
                    Click Up
                  </span>
                  <span
                    className="badge border px-2.5 py-1.5 small text-light"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "var(--s-glass-border)",
                    }}
                  >
                    Payme
                  </span>
                  <span
                    className="badge border px-2.5 py-1.5 small text-light"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "var(--s-glass-border)",
                    }}
                  >
                    Humo / Uzcard
                  </span>
                </div>
              </div>

              <div
                className="pt-3 mt-3 small"
                style={{
                  borderTop: "1px solid var(--s-glass-border)",
                  color: "var(--s-text-muted)",
                }}
              >
                <span>Avtomatik hisob-faktura va chek</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
