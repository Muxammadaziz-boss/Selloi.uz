"use client";

import React, { useState } from "react";
import { useLanguage } from "@/app/lib/i18n";
import { FAQ_ITEMS_BY_LANG } from "./data";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import { ChevronDown, MessageCircle, Send, Sparkles } from "lucide-react";

export default function FAQSection() {
  const { language } = useLanguage();
  const faqItems = FAQ_ITEMS_BY_LANG[language] || FAQ_ITEMS_BY_LANG.uz;
  const faqContent = (LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz).faq;

  const [openId, setOpenId] = useState<string | null>("faq-1");

  const toggleAccordion = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="s-section position-relative">
      <div className="s-container">
        {/* Section Header */}
        <div className="text-center mb-5">
          <div className="mb-3">
            <span className="s-pill">
              <Sparkles size={13} />
              <span>{faqContent.badge}</span>
            </span>
          </div>
          <h2 className="s-heading-section mb-3">
            {faqContent.headingPrefix}{" "}
            <span className="s-gradient-purple">{faqContent.headingHighlight}</span>
          </h2>
          <p className="s-body-lg mx-auto" style={{ maxWidth: "600px" }}>
            {faqContent.subtitle}
          </p>
        </div>

        {/* Accordion Container */}
        <div className="mx-auto" style={{ maxWidth: "860px" }}>
          <div className="d-flex flex-column gap-3">
            {faqItems.map((faq) => {
              const isOpen = openId === faq.id;

              return (
                <div
                  key={faq.id}
                  className={`s-faq-item ${isOpen ? "s-open" : ""}`}
                  style={{
                    borderColor: isOpen
                      ? "var(--s-purple-bright)"
                      : "var(--s-glass-border)",
                    boxShadow: isOpen
                      ? "0 10px 30px rgba(147, 3, 197, 0.15)"
                      : "none",
                  }}
                >
                  {/* Accordion Trigger */}
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    className="s-faq-trigger"
                    aria-expanded={isOpen}
                  >
                    <span className="pe-3" style={{ fontSize: "1.02rem" }}>
                      {faq.question}
                    </span>
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: isOpen
                          ? "rgba(180, 74, 255, 0.2)"
                          : "rgba(255, 255, 255, 0.05)",
                        color: isOpen ? "var(--s-purple-soft)" : "var(--s-text-muted)",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      <ChevronDown size={18} />
                    </div>
                  </button>

                  {/* Accordion Content */}
                  <div className="s-faq-content">
                    <p className="s-faq-answer mb-0">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact Support Help Box */}
          <div
            className="p-4 rounded-4 mt-5 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 text-center text-sm-start s-glass-card"
            style={{
              borderColor: "rgba(180, 74, 255, 0.35)",
            }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                style={{
                  width: "44px",
                  height: "44px",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "var(--s-cyan)",
                }}
              >
                <MessageCircle size={20} />
              </div>
              <div>
                <div className="fw-bold text-white" style={{ fontSize: "0.98rem" }}>
                  {faqContent.supportTitle}
                </div>
                <div className="small" style={{ color: "var(--s-text-muted)" }}>
                  {faqContent.supportDesc}
                </div>
              </div>
            </div>
            <a
              href="https://t.me/selloi_support"
              target="_blank"
              rel="noopener noreferrer"
              className="s-btn-secondary py-2 px-3.5 d-inline-flex align-items-center gap-2"
              style={{ fontSize: "0.88rem" }}
            >
              <Send size={14} color="var(--s-cyan)" />
              <span>{faqContent.supportBtn}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
