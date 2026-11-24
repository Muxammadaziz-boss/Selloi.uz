"use client";

import React, { useState, useRef, useEffect } from "react";
import { Language } from "@/app/lib/i18n/types";
import { SelloiTranslations } from "./selloiI18n";

interface HeaderProps {
  onOpenOnboarding: () => void;
  onOpenLogin: () => void;
  isAuthenticated?: boolean;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  t: SelloiTranslations["nav"];
}

const LANGUAGES: { code: Language; label: string; full: string }[] = [
  { code: "uz", label: "Uz", full: "O‘zbekcha" },
  { code: "ru", label: "Ru", full: "Русский" },
  { code: "en", label: "En", full: "English" },
];

interface NavItemConfig {
  id: string;
  targetId: string;
  labelKey: keyof SelloiTranslations["nav"];
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: "top", targetId: "top", labelKey: "boshSahifa" },
  { id: "imkoniyatlar", targetId: "imkoniyatlar", labelKey: "selloiHaqida" },
  { id: "sinab-korish", targetId: "sinab-korish", labelKey: "sinabKorish" },
  { id: "tariflar", targetId: "tariflar", labelKey: "tariflar" },
  { id: "faq", targetId: "faq", labelKey: "aloqa" },
];

export default function Header({
  onOpenOnboarding,
  onOpenLogin,
  isAuthenticated = false,
  language,
  onLanguageChange,
  t,
}: HeaderProps) {
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("top");
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const langWrapperRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close language dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        langWrapperRef.current &&
        !langWrapperRef.current.contains(event.target as Node)
      ) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Smooth scroll helper
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Cycle languages on click (uz -> ru -> en -> uz)
  const cycleLanguage = () => {
    const nextLang: Record<Language, Language> = {
      uz: "ru",
      ru: "en",
      en: "uz",
    };
    onLanguageChange(nextLang[language] || "uz");
  };

  const currentLangLabel =
    LANGUAGES.find((l) => l.code === language)?.label || "Uz";

  // Dynamic ScrollSpy: accurately track which section is currently in view
  useEffect(() => {
    let ticking = false;

    const getDocTop = (el: HTMLElement | null) => {
      if (!el) return Infinity;
      const rect = el.getBoundingClientRect();
      return rect.top + window.scrollY;
    };

    const handleScroll = () => {
      // Dynamic offset based on viewport height
      const scrollPos = window.scrollY + window.innerHeight * 0.35;

      const sections = [
        { id: "faq", top: getDocTop(document.getElementById("faq")) },
        { id: "tariflar", top: getDocTop(document.getElementById("tariflar")) },
        { id: "sinab-korish", top: getDocTop(document.getElementById("sinab-korish")) },
        { id: "imkoniyatlar", top: getDocTop(document.getElementById("imkoniyatlar")) },
        { id: "top", top: 0 },
      ];

      for (const s of sections) {
        if (scrollPos >= s.top) {
          setActiveSection((prev) => (prev !== s.id ? s.id : prev));
          return;
        }
      }
      setActiveSection((prev) => (prev !== "top" ? "top" : prev));
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Liquid Glass Sliding Pill Positioning
  useEffect(() => {
    const updatePill = () => {
      if (!navRef.current) return;
      const activeEl = navRef.current.querySelector(
        `[data-nav-id="${activeSection}"]`
      ) as HTMLElement | null;

      if (activeEl) {
        setPillStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          opacity: 1,
        });
      }
    };

    updatePill();
    const raf = requestAnimationFrame(updatePill);
    window.addEventListener("resize", updatePill);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePill);
    };
  }, [activeSection, language, t]);

  return (
    <header className="selloi-navbar" data-node-id="65:6">
      <div className="selloi-navbar-inner">
        {/* Brand Logo - Single Unified Component */}
        <a
          href="#top"
          className="selloi-nav-logo"
          data-node-id="89:5"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection("top");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          title="Selloi"
        >
          <img
            src="/figma/selloi-logo.png"
            alt="Selloi.uz — Telegram AI sotuvchi logotipi"
            width={38}
            height={32}
            fetchPriority="high"
            decoding="async"
            data-node-id="88:2"
          />
          <span className="selloi-nav-logo-text" data-node-id="89:3">
            Selloi
          </span>
        </a>

        {/* Pages Navigation with Liquid Glass Indicator */}
        <nav
          className="selloi-nav-pages"
          ref={navRef}
          data-node-id="89:8"
          aria-label="Asosiy menyu"
        >
          {/* Liquid Glass Sliding Pill */}
          <div
            className="selloi-nav-liquid-pill"
            style={{
              transform: `translateX(${pillStyle.left}px)`,
              width: `${pillStyle.width}px`,
              opacity: pillStyle.opacity,
            }}
            aria-hidden="true"
          />

          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.targetId}`}
                data-nav-id={item.id}
                className={`selloi-nav-link ${isActive ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection(item.id);
                  if (item.id === "top") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else if (item.id === "boshlash") {
                    if (isAuthenticated) {
                      window.location.href = "/dashboard";
                    } else {
                      scrollTo("boshlash");
                    }
                  } else {
                    scrollTo(item.targetId);
                  }
                }}
              >
                <span>{t[item.labelKey]}</span>
              </a>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="selloi-nav-actions" data-node-id="100:24">
          {/* Language Switcher - Click to Cycle, Hover for Menu */}
          <div
            className="selloi-lang-wrapper"
            ref={langWrapperRef}
            onMouseEnter={() => setIsLangMenuOpen(true)}
            onMouseLeave={() => setIsLangMenuOpen(false)}
          >
            <button
              type="button"
              className="selloi-btn-glass selloi-btn-lang"
              data-node-id="173:123"
              aria-label="Til tanlash"
              title="Tilni o‘zgartirish uchun bosing (Uz / Ru / En)"
              onClick={cycleLanguage}
              aria-expanded={isLangMenuOpen}
            >
              <span>{currentLangLabel}</span>
            </button>

            {isLangMenuOpen && (
              <div className="selloi-lang-menu" role="menu">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className={`selloi-lang-option ${
                      language === l.code ? "active" : ""
                    }`}
                    onClick={() => {
                      onLanguageChange(l.code);
                      setIsLangMenuOpen(false);
                    }}
                    role="menuitem"
                  >
                    <span>{l.full}</span>
                    <span style={{ fontSize: "12px", opacity: 0.6 }}>
                      {l.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Login Button */}
          <button
            type="button"
            className="selloi-btn-glass selloi-btn-login"
            data-node-id="173:131"
            onClick={() => {
              if (isAuthenticated) {
                window.location.href = "/dashboard";
              } else {
                window.location.href = "/login";
              }
            }}
          >
            <span>{t.kirish}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
