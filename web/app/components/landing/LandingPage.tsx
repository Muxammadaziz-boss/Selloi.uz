"use client";

import React, { useState, useEffect } from "react";
import Header from "./Header";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import ConversationDemoSection from "./ConversationDemoSection";
import PricingSection from "./PricingSection";
import FAQSection from "./FAQSection";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";
import { OnboardingModal } from "../saas/OnboardingModal";
import { LanguageProvider, useLanguage } from "@/app/lib/i18n";
import { Language } from "@/app/lib/i18n/types";
import { SELLOI_I18N } from "./selloiI18n";
import { X, Lock, ArrowRight, AlertCircle } from "lucide-react";
import "./selloi-figma.css";

interface LandingPageProps {
  isAuthenticated?: boolean;
}

function LandingPageContent({ isAuthenticated = false }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const t = SELLOI_I18N[language] || SELLOI_I18N.uz;

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("start");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Smooth scroll reveal animations for sections (low threshold + scroll fallback so tall mobile/laptop sections never stay hidden)
  useEffect(() => {
    const revealItems = Array.from(document.querySelectorAll(".selloi-reveal-item"));

    const checkVisible = () => {
      const triggerLine = window.innerHeight * 0.96;
      for (const el of revealItems) {
        if (!el.classList.contains("selloi-in-view")) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= triggerLine) {
            el.classList.add("selloi-in-view");
          }
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("selloi-in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.03, rootMargin: "0px 0px -15px 0px" }
    );

    revealItems.forEach((el) => observer.observe(el));
    checkVisible();
    const rafId = window.requestAnimationFrame(checkVisible);
    window.addEventListener("scroll", checkVisible, { passive: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", checkVisible);
    };
  }, []);

  // Cycle languages (uz -> ru -> en -> uz)
  const cycleLanguage = () => {
    const nextLang: Record<Language, Language> = {
      uz: "ru",
      ru: "en",
      en: "uz",
    };
    setLanguage(nextLang[language] || "uz");
  };

  // Handle Onboarding submission from Landing Page
  const handleOnboardingComplete = async (data: any) => {
    try {
      const res = await fetch("/api/proxy?path=/api/saas/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Do‘kon yaratishda xatolik yuz berdi");
      }

      const result = await res.json();
      setIsOnboardingOpen(false);

      if (data.slug) {
        window.location.href = `/t/${data.slug}`;
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      alert(err.message || "Xatolik yuz berdi");
      throw err;
    }
  };

  // Handle Quick Admin Login Modal
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword }),
      });

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.detail || t.modal.errorDefault);
      }
    } catch {
      setLoginError(t.modal.errorDefault);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="selloi-page" data-node-id="60:2" data-name="Desktop - 1">
      {/* 1. Navigation */}
      <Header
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenLogin={() => {
          window.location.href = "/login";
        }}
        isAuthenticated={isAuthenticated}
        language={language}
        onLanguageChange={setLanguage}
        t={t.nav}
      />

      <main>
        {/* 1. Hero Section */}
        <HeroSection
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          isAuthenticated={isAuthenticated}
          t={t.hero}
        />

        {/* 2. Selloi imkoniyatlari */}
        <FeaturesSection t={t.imkoniyatlar} />

        {/* 3. Qanday ishlaydi? */}
        <HowItWorksSection t={t.qandayIshlaydi} />

        {/* 4. Suhbatdan namuna (Jonli Demo) */}
        <ConversationDemoSection
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          isAuthenticated={isAuthenticated}
          t={t.suhbatNamunasi}
        />

        {/* 5. Tariflar (Doim ochiq, berkitishsiz) */}
        <PricingSection
          onOpenOnboarding={(planCode) => {
            setSelectedPlan(planCode || "start");
            setIsOnboardingOpen(true);
          }}
          isAuthenticated={isAuthenticated}
          t={t.tariflar}
        />

        {/* 6. FAQ (Savol-javob) */}
        <FAQSection t={t.faq} />

        {/* 7. Final CTA (Boshlash) */}
        <FinalCTA
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          isAuthenticated={isAuthenticated}
          t={t.finalCta}
        />
      </main>

      {/* 8. Footer */}
      <Footer t={t.footer} onLanguageClick={cycleLanguage} />

      {/* Onboarding Wizard Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialPlanCode={selectedPlan}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
      />

      {/* Quick Login Modal */}
      {isLoginModalOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            zIndex: 1050,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(16px)",
          }}
          onClick={() => setIsLoginModalOpen(false)}
        >
          <div
            className="p-4 mx-3 rounded-4"
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#151516",
              border: "1px solid #2A2A2D",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
              fontFamily: "'Quicksand', sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(255, 76, 99, 0.15)",
                    color: "#FF4C63",
                  }}
                >
                  <Lock size={16} />
                </div>
                <h4 className="fw-bold mb-0 text-white" style={{ fontSize: "1.05rem" }}>
                  {t.modal.title}
                </h4>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="btn btn-sm btn-link text-muted p-1"
                aria-label="Yopish"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner */}
            {loginError && (
              <div
                className="alert alert-danger py-2 px-3 d-flex align-items-center gap-2 mb-3"
                style={{ fontSize: "0.82rem" }}
              >
                <AlertCircle size={15} />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit}>
              <div className="mb-3">
                <label className="form-label text-secondary small">
                  {t.modal.label}
                </label>
                <input
                  type="password"
                  className="form-control bg-dark border-secondary border-opacity-25 text-white"
                  placeholder={t.modal.placeholder}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoFocus
                  style={{ fontSize: "0.95rem", padding: "10px 14px" }}
                />
              </div>

              <div className="d-flex align-items-center justify-content-between mt-4">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="selloi-btn-glass py-2 px-3"
                  style={{ fontSize: "0.85rem", borderRadius: "10px" }}
                >
                  {t.modal.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="selloi-btn-glass py-2 px-4"
                  style={{
                    fontSize: "0.85rem",
                    borderRadius: "10px",
                    background: "#FF4C63",
                    color: "#FFFFFF",
                  }}
                >
                  {loginLoading ? t.modal.loading : t.modal.submit}
                  <ArrowRight size={15} style={{ marginLeft: "6px" }} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LandingPage({ isAuthenticated = false }: LandingPageProps) {
  return (
    <LanguageProvider initialLanguage="uz">
      <LandingPageContent isAuthenticated={isAuthenticated} />
    </LanguageProvider>
  );
}
