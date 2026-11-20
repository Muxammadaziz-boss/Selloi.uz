"use client";

import React from "react";
import { SelloiTranslations } from "./selloiI18n";

interface HeroSectionProps {
  onOpenOnboarding: () => void;
  isAuthenticated?: boolean;
  t: SelloiTranslations["hero"];
}

export default function HeroSection({
  onOpenOnboarding,
  isAuthenticated = false,
  t,
}: HeroSectionProps) {
  const handleCtaClick = () => {
    if (isAuthenticated) {
      window.location.href = "/dashboard";
    } else {
      onOpenOnboarding();
    }
  };

  return (
    <section className="selloi-hero-section" id="top" data-node-id="63:3">
      <div className="selloi-container">
        <div className="selloi-hero-grid">
          {/* Left Hero Content */}
          <div className="selloi-hero-left" data-node-id="123:75">
            <h1 className="selloi-hero-title" data-node-id="101:26">
              <span>{t.title1}</span>
              <span>{t.title2}</span>
            </h1>

            <p className="selloi-hero-subtitle" data-node-id="123:72">
              {t.subtitle}
            </p>

            <button
              type="button"
              className="selloi-btn-glass selloi-hero-btn"
              data-node-id="173:115"
              onClick={handleCtaClick}
            >
              <span>{t.cta}</span>
            </button>
          </div>

          {/* Right Hero Visual Mockup */}
          <div className="selloi-hero-right" data-node-id="116:48">
            <div className="selloi-hero-mockup-glow" />
            <div className="selloi-browser-mockup" data-node-id="116:39">
              {/* Browser Window Header */}
              <div className="selloi-browser-header">
                <div className="selloi-browser-dots">
                  <img
                    src="/figma/ellipse-1.svg"
                    alt=""
                    width={8}
                    height={8}
                    data-node-id="116:43"
                  />
                  <img
                    src="/figma/ellipse-2.svg"
                    alt=""
                    width={8}
                    height={8}
                    data-node-id="116:44"
                  />
                  <img
                    src="/figma/ellipse-3.svg"
                    alt=""
                    width={8}
                    height={8}
                    data-node-id="116:45"
                  />
                </div>
                <div className="selloi-browser-title" data-node-id="116:46">
                  {t.windowTitle}
                </div>
              </div>

              {/* Browser Content Area */}
              <div className="selloi-browser-body" data-node-id="111:36">
                <img
                  src="/figma/dashboard-hero.png"
                  alt="Selloi.uz Dashboard"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
