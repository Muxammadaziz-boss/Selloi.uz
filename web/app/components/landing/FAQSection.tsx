"use client";

import React, { useState } from "react";
import { SelloiTranslations } from "./selloiI18n";

interface FAQSectionProps {
  t: SelloiTranslations["faq"];
}

export default function FAQSection({ t }: FAQSectionProps) {
  // Question 1 is open by default in Figma design
  const [openIds, setOpenIds] = useState<string[]>(["q1"]);

  const toggleItem = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <section className="selloi-faq-section selloi-reveal-item" id="faq" data-node-id="182:410">
      <div className="selloi-container">
        <div className="selloi-faq-grid">
          {/* Left Column Content */}
          <div className="selloi-faq-left">
            <p className="selloi-section-tag" data-node-id="182:411">
              {t.tag}
            </p>
            <h2 className="selloi-faq-title" data-node-id="182:412">
              {t.titleLine1}
              <br />
              {t.titleLine2}
            </h2>
            <p className="selloi-faq-desc" data-node-id="182:413">
              {t.descLine1}
              <br />
              {t.descLine2}
            </p>
            <a
              href="https://t.me/selloi_admin"
              target="_blank"
              rel="noopener noreferrer"
              className="selloi-faq-contact-btn"
              data-node-id="182:414"
            >
              {t.contact}
            </a>
          </div>

          {/* Right Column Accordion */}
          <div className="selloi-faq-right">
            {t.items.map((item) => {
              const isOpen = openIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="selloi-faq-item"
                  data-node-id={item.nodeId}
                  onClick={() => toggleItem(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleItem(item.id);
                    }
                  }}
                  aria-expanded={isOpen}
                >
                  <div className="selloi-faq-question-row">
                    <h3 className="selloi-faq-question">{item.question}</h3>
                    <span
                      className={`selloi-faq-toggle ${
                        isOpen ? "active" : "inactive"
                      }`}
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>

                  <div className={`selloi-faq-answer-wrapper ${isOpen ? "open" : ""}`}>
                    <div className="selloi-faq-answer-inner">
                      <p className="selloi-faq-answer">{item.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
