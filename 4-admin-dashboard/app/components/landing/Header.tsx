"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { NAV_ITEMS } from "./data";
import { Sparkles, Menu, X, ArrowRight, Globe } from "lucide-react";

interface HeaderProps {
  onOpenOnboarding: () => void;
  onOpenLogin: () => void;
  isAuthenticated?: boolean;
}

export default function Header({
  onOpenOnboarding,
  onOpenLogin,
  isAuthenticated = false,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<"UZ" | "RU" | "EN">("UZ");
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      // Simple active section detection
      const sections = NAV_ITEMS.filter((i) => i.href.startsWith("#")).map((i) =>
        i.href.substring(1)
      );
      for (const sec of sections) {
        const el = document.getElementById(sec);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140 && rect.bottom >= 140) {
            setActiveSection(sec);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className="position-sticky top-0 w-100"
      style={{
        zIndex: 100,
        backgroundColor: scrolled ? "rgba(7, 6, 15, 0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid transparent",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div className="selloi-container py-3 d-flex align-items-center justify-content-between">
        {/* Brand Logo */}
        <Link
          href="/"
          className="d-flex align-items-center gap-2 text-decoration-none"
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #A855F7 0%, #6B21A8 100%)",
              boxShadow: "0 0 24px rgba(168, 85, 247, 0.5), inset 0 0 8px rgba(255, 255, 255, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <span
              style={{
                fontSize: "1.25rem",
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              S
            </span>
          </div>
          <span
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              color: "#FFFFFF",
            }}
          >
            Selloi<span style={{ color: "#C084FC" }}>.uz</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="d-none d-lg-flex align-items-center gap-4">
          {NAV_ITEMS.map((item) => {
            const isAnchor = item.href.startsWith("#");
            const isActive = isAnchor && activeSection === item.href.substring(1);
            return (
              <a
                key={item.href}
                href={item.href}
                className="text-decoration-none position-relative py-1"
                style={{
                  fontSize: "0.92rem",
                  fontWeight: 500,
                  color: isActive ? "#FFFFFF" : "#CBD5E1",
                  transition: "color 0.2s ease",
                }}
              >
                {item.label}
                {isActive && (
                  <span
                    className="position-absolute bottom-0 start-0 w-100"
                    style={{
                      height: "2px",
                      background: "linear-gradient(90deg, #A855F7, #38BDF8)",
                      borderRadius: "2px",
                    }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Actions & Language Selector */}
        <div className="d-none d-md-flex align-items-center gap-3">
          {/* Language Switcher Placeholder (UZ / RU / EN) */}
          <div className="position-relative">
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="d-flex align-items-center gap-1.5 px-2.5 py-1.5"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                color: "#E2E8F0",
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
              title="Tilni tanlash (UZ/RU/EN)"
            >
              <Globe size={13} color="#A855F7" />
              <span className="fw-semibold">{currentLang}</span>
            </button>

            {langDropdownOpen && (
              <div
                className="position-absolute end-0 mt-2 py-1"
                style={{
                  width: "90px",
                  background: "rgba(16, 17, 30, 0.96)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  borderRadius: "10px",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                  zIndex: 110,
                }}
              >
                {(["UZ", "RU", "EN"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setCurrentLang(lang);
                      setLangDropdownOpen(false);
                    }}
                    className="w-100 text-start px-3 py-1.5 border-0 bg-transparent"
                    style={{
                      fontSize: "0.82rem",
                      color: currentLang === lang ? "#C084FC" : "#94A3B8",
                      fontWeight: currentLang === lang ? 700 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {lang === "UZ" ? "O‘zbek" : lang === "RU" ? "Русский" : "English"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="selloi-btn-secondary py-2 px-3"
              style={{ fontSize: "0.88rem" }}
            >
              <span>Boshqaruv paneli</span>
              <ArrowRight size={15} />
            </Link>
          ) : (
            <button
              onClick={onOpenLogin}
              className="selloi-btn-secondary py-2 px-3"
              style={{ fontSize: "0.88rem" }}
            >
              Kirish
            </button>
          )}

          <button
            onClick={onOpenOnboarding}
            className="selloi-btn-primary py-2 px-3.5"
            style={{ fontSize: "0.88rem" }}
          >
            <Sparkles size={15} />
            <span>Do‘kon ochish</span>
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="d-flex d-md-none align-items-center gap-2">
          <button
            onClick={onOpenOnboarding}
            className="selloi-btn-primary py-1.5 px-3"
            style={{ fontSize: "0.8rem" }}
          >
            Boshlash
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="btn btn-dark p-2"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#FFFFFF",
            }}
            aria-label="Menyuni ochish"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="d-md-none border-top border-secondary border-opacity-25 px-4 py-4"
          style={{
            background: "rgba(7, 6, 15, 0.98)",
            backdropFilter: "blur(24px)",
          }}
        >
          <nav className="d-flex flex-column gap-3 mb-4">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-decoration-none py-1.5 d-flex align-items-center justify-content-between"
                style={{ fontSize: "1.05rem", fontWeight: 500, color: "#E2E8F0" }}
              >
                <span>{item.label}</span>
                <ArrowRight size={14} color="#A855F7" />
              </a>
            ))}
          </nav>

          <div className="d-flex align-items-center justify-content-between py-2 border-top border-secondary border-opacity-25 mb-3">
            <span className="text-secondary small">Til:</span>
            <div className="d-flex gap-1">
              {(["UZ", "RU", "EN"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setCurrentLang(lang)}
                  className={`btn btn-sm ${currentLang === lang ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="d-flex flex-column gap-2 pt-2">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="selloi-btn-secondary text-center py-2"
              >
                Boshqaruv paneli
              </Link>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLogin();
                }}
                className="selloi-btn-secondary text-center py-2"
              >
                Kirish
              </button>
            )}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenOnboarding();
              }}
              className="selloi-btn-primary text-center py-2.5"
            >
              <Sparkles size={16} />
              <span>7 kun sinab ko‘rish →</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
