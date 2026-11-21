"use client";

import React from "react";
import { SelloiTranslations } from "./selloiI18n";

interface FooterProps {
  t: SelloiTranslations["footer"];
  onLanguageClick?: () => void;
}

export default function Footer({ t, onLanguageClick }: FooterProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="selloi-footer selloi-reveal-item" data-node-id="182:451">
      <div className="selloi-container">
        {/* Top Separator Line */}
        <div className="selloi-footer-top-line" data-node-id="182:452" />

        {/* Main Footer Content */}
        <div className="selloi-footer-content">
          {/* Brand info */}
          <div className="selloi-footer-brand">
            <a
              href="#top"
              className="selloi-footer-logo-row"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              title="Selloi"
            >
              <img
                src="/figma/selloi-logo.png"
                alt="Selloi"
                data-node-id="182:453"
              />
              <span className="selloi-footer-logo-text" data-node-id="182:454">
                Selloi
              </span>
            </a>
            <p className="selloi-footer-brand-desc" data-node-id="182:455">
              {t.taglineLine1}
              <br />
              {t.taglineLine2}
            </p>
          </div>

          {/* Column 1: TANISHING */}
          <div className="selloi-footer-col">
            <h4 className="selloi-footer-col-title" data-node-id="182:456">
              {t.col1Title}
            </h4>
            <div className="selloi-footer-links">
              <a
                href="#imkoniyatlar"
                className="selloi-footer-link"
                data-node-id="182:457"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("imkoniyatlar");
                }}
              >
                {t.col1Link1}
              </a>
              <a
                href="#imkoniyatlar"
                className="selloi-footer-link"
                data-node-id="182:458"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("imkoniyatlar");
                }}
              >
                {t.col1Link2}
              </a>
            </div>
          </div>

          {/* Column 2: BOSHLANG */}
          <div className="selloi-footer-col">
            <h4 className="selloi-footer-col-title" data-node-id="182:459">
              {t.col2Title}
            </h4>
            <div className="selloi-footer-links">
              <a
                href="#boshlash"
                className="selloi-footer-link"
                data-node-id="182:460"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("boshlash");
                }}
              >
                {t.col2Link1}
              </a>
              <a
                href="#tariflar"
                className="selloi-footer-link"
                data-node-id="182:461"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("tariflar");
                }}
              >
                {t.col2Link2}
              </a>
            </div>
          </div>

          {/* Column 3: ALOQA */}
          <div className="selloi-footer-col">
            <h4 className="selloi-footer-col-title" data-node-id="182:462">
              {t.col3Title}
            </h4>
            <div className="selloi-footer-links">
              <a
                href="https://t.me/selloi_admin"
                target="_blank"
                rel="noopener noreferrer"
                className="selloi-footer-link"
                data-node-id="182:463"
              >
                {t.col3Link1}
              </a>
              <a
                href="mailto:support@selloi.uz"
                className="selloi-footer-link"
              >
                support@selloi.uz
              </a>
              <a
                href="https://selloi.uz"
                className="selloi-footer-link muted"
                data-node-id="182:464"
              >
                {t.col3Link2}
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Separator Line */}
        <div className="selloi-footer-bottom-line" data-node-id="182:465" />

        {/* Bottom Row */}
        <div className="selloi-footer-bottom-row">
          <p className="selloi-footer-copy" data-node-id="182:466">
            {t.copy}
          </p>
          <p
            className="selloi-footer-lang"
            data-node-id="182:467"
            onClick={onLanguageClick}
            style={{ cursor: onLanguageClick ? "pointer" : "default" }}
            title="Tilni o‘zgartirish"
          >
            {t.langName}
          </p>
        </div>
      </div>
    </footer>
  );
}
