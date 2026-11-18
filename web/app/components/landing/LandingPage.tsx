"use client";

import React, { useState } from "react";
import Header from "./Header";
import HeroSection from "./HeroSection";
import TrustBar from "./TrustBar";
import StorytellingSection from "./StorytellingSection";
import FeaturesSection from "./FeaturesSection";
import InteractiveDemo from "./InteractiveDemo";
import HowItWorksSection from "./HowItWorksSection";
import SocialProofSection from "./SocialProofSection";
import PricingSection from "./PricingSection";
import FAQSection from "./FAQSection";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";
import StickyMobileCTA from "./StickyMobileCTA";
import { OnboardingModal } from "../saas/OnboardingModal";
import { LanguageProvider, useLanguage } from "@/app/lib/i18n";
import { LANDING_CONTENT_BY_LANG } from "./landingContent";
import { X, Lock, ArrowRight, AlertCircle } from "lucide-react";
import "./immersive.css";
import "./landing.css";

interface LandingPageProps {
  isAuthenticated?: boolean;
}

function LandingPageInner({ isAuthenticated = false }: LandingPageProps) {
  const { language } = useLanguage();
  const content = LANDING_CONTENT_BY_LANG[language] || LANDING_CONTENT_BY_LANG.uz;
  const modalText = content.loginModal;

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

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
        setLoginError(data.detail || modalText.errorDefault);
      }
    } catch {
      setLoginError(modalText.errorDefault);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="immersive-root selloi-landing-root">
      {/* Precision Ambient Atmosphere & Grid Texture */}
      <div className="immersive-atmosphere" />
      <div className="immersive-grid" />

      {/* 1. Header & Navigation (Sticky, Language Selector, Section Tracker) */}
      <Header
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        isAuthenticated={isAuthenticated}
      />

      <main>
        {/* 2. Hero Section with Telegram Autonomous Sales Engine Showcase */}
        <HeroSection onOpenOnboarding={() => setIsOnboardingOpen(true)} />

        {/* 3. Precision Trust & Key Metrics Strip */}
        <TrustBar />

        {/* 4. Sales Storytelling Process (3-Stage Workflow) */}
        <StorytellingSection />

        {/* 5. Features Section (Precision Bento Grid) */}
        <FeaturesSection />

        {/* 6. Interactive Demo (Live Telegram Simulator) */}
        <InteractiveDemo />

        {/* 7. How It Works Timeline (3 Simple Steps) */}
        <HowItWorksSection />

        {/* 8. Social Proof (Partner Logos & Verified Testimonials) */}
        <SocialProofSection />

        {/* 9. Dedicated Full-Width Pricing Section with Comparison Matrix */}
        <PricingSection onOpenOnboarding={() => setIsOnboardingOpen(true)} />

        {/* 10. Dedicated Full-Width FAQ Section (Expandable Glass Accordion) */}
        <FAQSection />

        {/* 11. Final High-Impact Conversion Call-to-Action */}
        <FinalCTA onOpenOnboarding={() => setIsOnboardingOpen(true)} />
      </main>

      {/* 12. Minimal Elegant Footer */}
      <Footer />

      {/* 13. Mobile Floating Sticky Bottom CTA */}
      <StickyMobileCTA onOpenOnboarding={() => setIsOnboardingOpen(true)} />

      {/* Onboarding Wizard Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
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
            className="p-4 mx-3 rounded-4 s-glass-card"
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "rgba(17, 15, 29, 0.95)",
              border: "1px solid var(--s-glass-border-hover)",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px var(--s-purple-glow)",
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
                    background: "rgba(99, 102, 241, 0.15)",
                    color: "var(--s-purple-soft)",
                  }}
                >
                  <Lock size={16} />
                </div>
                <h4 className="fw-bold mb-0 text-white" style={{ fontSize: "1.05rem" }}>
                  {modalText.title}
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
                  {modalText.label}
                </label>
                <input
                  type="password"
                  className="form-control bg-dark border-secondary border-opacity-25 text-white"
                  placeholder={modalText.placeholder || "••••••••••••"}
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
                  className="s-btn-secondary py-2 px-3"
                  style={{ fontSize: "0.85rem" }}
                >
                  {modalText.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="s-btn-primary py-2 px-4"
                  style={{ fontSize: "0.85rem" }}
                >
                  {loginLoading ? modalText.loading : modalText.submit}
                  <ArrowRight size={15} />
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
      <LandingPageInner isAuthenticated={isAuthenticated} />
    </LanguageProvider>
  );
}
