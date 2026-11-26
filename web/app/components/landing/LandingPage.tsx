"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "./Header";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import ConversationDemoSection from "./ConversationDemoSection";
import PricingSection from "./PricingSection";
import FAQSection from "./FAQSection";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";
import { Toast, ToastContainer } from "../ui/Toast";
import { LanguageProvider, useLanguage } from "@/app/lib/i18n";
import { Language } from "@/app/lib/i18n/types";
import { SELLOI_I18N } from "./selloiI18n";
import "./selloi-figma.css";

const OnboardingModal = dynamic(
  () => import("../saas/OnboardingModal").then((m) => m.OnboardingModal),
  { ssr: false }
);

interface LandingPageProps {
  isAuthenticated?: boolean;
  isAdminSession?: boolean;
}

function LandingPageContent({ isAuthenticated = false, isAdminSession = false }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const t = SELLOI_I18N[language] || SELLOI_I18N.uz;

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("start");
  const [landingError, setLandingError] = useState<string | null>(null);

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

      await res.json();
      setIsOnboardingOpen(false);

      if (data.slug) {
        window.location.href = `/t/${data.slug}`;
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setLandingError(err.message || "Do‘kon yaratishda xatolik yuz berdi");
      throw err;
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
        isAdminSession={isAdminSession}
        language={language}
        onLanguageChange={setLanguage}
        t={t.nav}
      />

      <main>
        {/* 1. Hero Section */}
        <HeroSection
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          isAuthenticated={isAuthenticated}
          isAdminSession={isAdminSession}
          t={t.hero}
        />

        {/* 2. Selloi imkoniyatlari */}
        <FeaturesSection t={t.imkoniyatlar} />

        {/* 3. Qanday ishlaydi? */}
        <HowItWorksSection t={t.qandayIshlaydi} />

        {/* 4. Suhbatdan namuna (Telegram Live Demo) */}
        <ConversationDemoSection
          language={language}
        />

        {/* 5. Tariflar (Doim ochiq, berkitishsiz) */}
        <PricingSection
          onOpenOnboarding={(planCode) => {
            setSelectedPlan(planCode || "start");
            setIsOnboardingOpen(true);
          }}
          isAuthenticated={isAuthenticated}
          isAdminSession={isAdminSession}
          t={t.tariflar}
        />

        {/* 6. FAQ (Savol-javob) */}
        <FAQSection t={t.faq} />

        {/* 7. Final CTA (Boshlash) */}
        <FinalCTA
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          isAuthenticated={isAuthenticated}
          isAdminSession={isAdminSession}
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

      {landingError && (
        <ToastContainer>
          <Toast type="error" message={landingError} onClose={() => setLandingError(null)} />
        </ToastContainer>
      )}
    </div>
  );
}

export default function LandingPage({ isAuthenticated = false, isAdminSession = false }: LandingPageProps) {
  return (
    <LanguageProvider initialLanguage="uz">
      <LandingPageContent isAuthenticated={isAuthenticated} isAdminSession={isAdminSession} />
    </LanguageProvider>
  );
}
