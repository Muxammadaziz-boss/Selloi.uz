"use client";

import React, { useState } from "react";
import { FAQ_ITEMS } from "./data";
import { ChevronDown, HelpCircle, MessageCircle, Send } from "lucide-react";

export default function FAQSection() {
  const [openId, setOpenId] = useState<string | null>("faq-1");

  const toggleAccordion = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="selloi-section position-relative">
      <div className="selloi-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="selloi-pill-badge">
              <HelpCircle size={14} />
              <span>FAQ</span>
            </span>
          </div>
          <h2 className="selloi-section-title mb-3" style={{ color: "#FFFFFF" }}>
            Ko‘p so‘raladigan savollar
          </h2>
          <p
            className="text-secondary mx-auto"
            style={{ maxWidth: "600px", fontSize: "1.08rem", color: "#CBD5E1" }}
          >
            Telegram do‘koningizni avtomatlashtirish va Selloi platformasi haqida eng ko‘p beriladigan savollarga aniq javoblar.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="mx-auto" style={{ maxWidth: "860px" }}>
          <div className="d-flex flex-column gap-3">
            {FAQ_ITEMS.map((faq) => {
              const isOpen = openId === faq.id;

              return (
                <div
                  key={faq.id}
                  className="rounded-4 overflow-hidden transition-all"
                  style={{
                    background: isOpen
                      ? "linear-gradient(180deg, rgba(124, 58, 237, 0.08) 0%, rgba(16, 17, 30, 0.9) 100%)"
                      : "rgba(16, 17, 30, 0.6)",
                    border: isOpen
                      ? "1px solid rgba(168, 85, 247, 0.45)"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    backdropFilter: "blur(16px)",
                    boxShadow: isOpen ? "0 10px 30px rgba(124, 58, 237, 0.15)" : "none",
                    transition: "all 0.25s ease",
                  }}
                >
                  {/* Accordion Trigger */}
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-100 p-4 text-start d-flex align-items-center justify-content-between border-0 bg-transparent"
                    style={{ cursor: "pointer" }}
                    aria-expanded={isOpen}
                  >
                    <span
                      className="fw-bold text-white pe-3"
                      style={{ fontSize: "1.05rem", letterSpacing: "-0.2px" }}
                    >
                      {faq.question}
                    </span>
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: isOpen
                          ? "rgba(124, 58, 237, 0.3)"
                          : "rgba(255, 255, 255, 0.05)",
                        color: isOpen ? "#C084FC" : "#94A3B8",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      <ChevronDown size={18} />
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1">
                      <p
                        className="mb-0"
                        style={{
                          color: "#CBD5E1",
                          fontSize: "0.95rem",
                          lineHeight: 1.65,
                          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                          paddingTop: "14px",
                        }}
                      >
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contact Support Help Box */}
          <div
            className="p-4 rounded-4 mt-5 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 text-center text-sm-start"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px dashed rgba(168, 85, 247, 0.35)",
            }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                style={{ width: "42px", height: "42px", background: "rgba(56, 189, 248, 0.15)", color: "#38BDF8" }}
              >
                <MessageCircle size={20} />
              </div>
              <div>
                <div className="fw-bold text-white" style={{ fontSize: "0.98rem" }}>
                  Boshqa savollaringiz bormi?
                </div>
                <div className="small text-secondary" style={{ color: "#94A3B8" }}>
                  Bizning mutaxassislarimiz har doim yordamga tayyor.
                </div>
              </div>
            </div>
            <a
              href="https://t.me/selloi_support"
              target="_blank"
              rel="noopener noreferrer"
              className="selloi-btn-secondary py-2 px-3.5 d-inline-flex align-items-center gap-2"
              style={{ fontSize: "0.88rem" }}
            >
              <Send size={14} color="#38BDF8" />
              <span>Telegramda yozish</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
