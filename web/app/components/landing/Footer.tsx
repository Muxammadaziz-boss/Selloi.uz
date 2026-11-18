"use client";

import React from "react";
import Link from "next/link";
import { Send, Youtube, Github, Instagram, Heart, Globe, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="position-relative pt-5 pb-4 border-top"
      style={{
        backgroundColor: "rgba(5, 5, 12, 0.98)",
        borderColor: "rgba(255, 255, 255, 0.08) !important",
      }}
    >
      <div className="selloi-container">
        <div className="row g-4 mb-5">
          {/* Brand & Slogan Column */}
          <div className="col-lg-4">
            <Link
              href="/"
              className="d-flex align-items-center gap-2 text-decoration-none mb-3"
            >
              <div
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #A855F7 0%, #6B21A8 100%)",
                  boxShadow: "0 0 15px rgba(168, 85, 247, 0.4)",
                }}
              >
                <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFFFFF" }}>
                  S
                </span>
              </div>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF" }}>
                Selloi<span style={{ color: "#C084FC" }}>.uz</span>
              </span>
            </Link>
            <p
              className="mb-4"
              style={{ fontSize: "0.92rem", maxWidth: "320px", lineHeight: 1.6, color: "#94A3B8" }}
            >
              Telegram do‘konlari uchun sun’iy intellekt sotuvchisi va to‘liq savdo avtomatlashtirish platformasi.
            </p>
            <div className="d-flex align-items-center gap-2 text-secondary small">
              <span className="badge bg-purple-subtle text-purple border border-purple-subtle">
                SaaS v2.4 Pro
              </span>
              <span>•</span>
              <span className="text-success">Barcha xizmatlar barqaror</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="col-6 col-md-3 col-lg-2">
            <h4 className="fw-bold mb-3 text-white" style={{ fontSize: "0.95rem" }}>
              Navigatsiya
            </h4>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0" style={{ fontSize: "0.88rem" }}>
              <li>
                <a href="#imkoniyatlar" className="text-secondary text-decoration-none hover-white">
                  Imkoniyatlar
                </a>
              </li>
              <li>
                <a href="#sotuv-jarayoni" className="text-secondary text-decoration-none hover-white">
                  Qanday ishlaydi?
                </a>
              </li>
              <li>
                <a href="#boshlash" className="text-secondary text-decoration-none hover-white">
                  Boshlash
                </a>
              </li>
              <li>
                <a href="#tariflar" className="text-secondary text-decoration-none hover-white">
                  Tariflar
                </a>
              </li>
              <li>
                <a href="#faq" className="text-secondary text-decoration-none hover-white">
                  FAQ
                </a>
              </li>
              <li>
                <a href="/docs" target="_blank" className="text-info text-decoration-none d-flex align-items-center gap-1">
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
                <span className="text-secondary">Telegram Bot API</span>
              </li>
              <li>
                <span className="text-secondary">Telegram Kanal Sync</span>
              </li>
              <li>
                <span className="text-secondary">Click & Payme</span>
              </li>
              <li>
                <span className="text-secondary">AI Vision 2.0</span>
              </li>
              <li>
                <span className="text-secondary">Smart CRM jadvali</span>
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
                <span className="text-secondary">Qo‘llab-quvvatlash</span>
              </li>
              <li>
                <a
                  href="https://t.me/selloi_support"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary text-decoration-none hover-white"
                >
                  Telegramda yozish
                </a>
              </li>
              <li>
                <span className="text-secondary">info@selloi.uz</span>
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
                <span className="text-secondary">Maxfiylik siyosati</span>
              </li>
              <li>
                <span className="text-secondary">Foydalanish shartlari</span>
              </li>
              <li>
                <span className="text-secondary">Ommaviy oferta</span>
              </li>
            </ul>

            <div className="d-flex align-items-center gap-2 pt-1">
              <a
                href="https://t.me/selloi_support"
                target="_blank"
                rel="noreferrer"
                className="d-flex align-items-center justify-content-center text-secondary hover-white"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
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
                  border: "1px solid rgba(255,255,255,0.1)",
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
                  border: "1px solid rgba(255,255,255,0.1)",
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
            borderColor: "rgba(255, 255, 255, 0.08) !important",
            fontSize: "0.82rem",
            color: "#94A3B8",
          }}
        >
          <div>
            © {new Date().getFullYear()} Selloi.uz. Barcha huquqlar himoyalangan.
          </div>
          <div className="d-flex align-items-center gap-1.5">
            <span>O‘zbekistonda mehr bilan yaratilgan</span>
            <Heart size={13} color="#F43F5E" fill="#F43F5E" />
          </div>
        </div>
      </div>
    </footer>
  );
}
