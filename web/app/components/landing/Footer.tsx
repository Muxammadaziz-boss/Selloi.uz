"use client";

import React from "react";
import Link from "next/link";
import { Send, Youtube, Github, Instagram, Heart, Globe, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="position-relative pt-5 pb-4 border-top"
      style={{
        backgroundColor: "var(--s-bg-void)",
        borderColor: "var(--s-glass-border) !important",
      }}
    >
      <div className="s-container">
        <div className="row g-4 mb-5">
          {/* Brand & Slogan Column */}
          <div className="col-lg-4">
            <Link
              href="/"
              className="d-flex align-items-center gap-2.5 text-decoration-none mb-3"
            >
              <div
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, var(--s-purple-bright) 0%, var(--s-purple) 100%)",
                  boxShadow: "0 0 15px var(--s-purple-glow)",
                }}
              >
                <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFFFFF" }}>
                  S
                </span>
              </div>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF" }}>
                Selloi<span style={{ color: "var(--s-purple-soft)" }}>.uz</span>
              </span>
            </Link>
            <p
              className="s-body mb-4"
              style={{ maxWidth: "320px", color: "var(--s-text-muted)" }}
            >
              Telegram do‘konlari uchun sun’iy intellekt sotuvchisi va to‘liq savdo
              avtomatlashtirish platformasi.
            </p>
            <div className="d-flex align-items-center gap-2 small">
              <span className="s-pill" style={{ padding: "2px 8px", fontSize: "0.68rem" }}>
                SaaS v3.0 3D
              </span>
              <span style={{ color: "var(--s-text-muted)" }}>•</span>
              <span className="text-success">Barcha xizmatlar 24/7 faol</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="col-6 col-md-3 col-lg-2">
            <h4 className="fw-bold mb-3 text-white" style={{ fontSize: "0.95rem" }}>
              Navigatsiya
            </h4>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0" style={{ fontSize: "0.88rem" }}>
              <li>
                <a href="#imkoniyatlar" className="text-secondary text-decoration-none">
                  Imkoniyatlar
                </a>
              </li>
              <li>
                <a href="#sotuv-jarayoni" className="text-secondary text-decoration-none">
                  Qanday ishlaydi?
                </a>
              </li>
              <li>
                <a href="#boshlash" className="text-secondary text-decoration-none">
                  Boshlash
                </a>
              </li>
              <li>
                <a href="#tariflar" className="text-secondary text-decoration-none">
                  Tariflar
                </a>
              </li>
              <li>
                <a href="#faq" className="text-secondary text-decoration-none">
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="/docs"
                  target="_blank"
                  className="text-info text-decoration-none d-flex align-items-center gap-1"
                >
                  <span>API Hujjatlari</span>
                  <ExternalLink size={12} />
                </a>
              </li>
            </ul>
          </div>

          {/* Integrations */}
          <div className="col-6 col-md-3 col-lg-2">
            <h4 className="fw-bold mb-3 text-white" style={{ fontSize: "0.95rem" }}>
              Integratsiyalar
            </h4>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0" style={{ fontSize: "0.88rem" }}>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>Telegram Bot API</span>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>Telegram Kanal Sync</span>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>Click & Payme</span>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>AI Vision 2.0</span>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>Smart Orders CRM</span>
              </li>
            </ul>
          </div>

          {/* Support & Contact Links */}
          <div className="col-6 col-md-3 col-lg-2">
            <h4 className="fw-bold mb-3 text-white" style={{ fontSize: "0.95rem" }}>
              Yordam & Aloqa
            </h4>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0" style={{ fontSize: "0.88rem" }}>
              <li>
                <a
                  href="https://t.me/selloi_support"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary text-decoration-none"
                >
                  Telegramda yozish
                </a>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>info@selloi.uz</span>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>24/7 Texnik ko‘mak</span>
              </li>
            </ul>
          </div>

          {/* Legal & Social Links */}
          <div className="col-6 col-md-3 col-lg-2">
            <h4 className="fw-bold mb-3 text-white" style={{ fontSize: "0.95rem" }}>
              Huquqiy
            </h4>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-3" style={{ fontSize: "0.88rem" }}>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>Maxfiylik siyosati</span>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>Foydalanish shartlari</span>
              </li>
              <li>
                <span style={{ color: "var(--s-text-muted)" }}>Ommaviy oferta</span>
              </li>
            </ul>

            <div className="d-flex align-items-center gap-2 pt-1">
              <a
                href="https://t.me/selloi_support"
                target="_blank"
                rel="noreferrer"
                className="d-flex align-items-center justify-content-center text-secondary"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--s-glass-border)",
                }}
                aria-label="Telegram"
              >
                <Send size={15} />
              </a>
              <div
                className="d-flex align-items-center justify-content-center text-secondary"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--s-glass-border)",
                }}
                aria-label="YouTube"
              >
                <Youtube size={15} />
              </div>
              <div
                className="d-flex align-items-center justify-content-center text-secondary"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--s-glass-border)",
                }}
                aria-label="Instagram"
              >
                <Instagram size={15} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="pt-4 border-top d-flex flex-column flex-md-row align-items-center justify-content-between gap-2"
          style={{
            borderColor: "var(--s-glass-border) !important",
            fontSize: "0.82rem",
            color: "var(--s-text-muted)",
          }}
        >
          <div>
            © {new Date().getFullYear()} Selloi.uz. Barcha huquqlar himoyalangan.
          </div>
          <div className="d-flex align-items-center gap-1.5">
            <span>O‘zbekistonda yaratilgan</span>
            <Heart size={13} color="#F43F5E" fill="#F43F5E" />
          </div>
        </div>
      </div>
    </footer>
  );
}
