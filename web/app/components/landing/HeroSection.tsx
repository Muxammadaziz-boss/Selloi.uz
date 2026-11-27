"use client";

import React, { useCallback, useRef, useState } from "react";
import { SelloiTranslations } from "./selloiI18n";

interface HeroSectionProps {
  onOpenOnboarding: () => void;
  isAuthenticated?: boolean;
  isAdminSession?: boolean;
  t: SelloiTranslations["hero"];
}

const LENS_RADIUS = 96;
const LENS_ZOOM = 2.15;

interface LensState {
  active: boolean;
  x: number;
  y: number;
  bgW: number;
  bgH: number;
  bgX: number;
  bgY: number;
}

export default function HeroSection({
  onOpenOnboarding,
  isAuthenticated = false,
  isAdminSession = false,
  t,
}: HeroSectionProps) {
  const browserBodyRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const [lens, setLens] = useState<LensState>({
    active: false,
    x: 0,
    y: 0,
    bgW: 0,
    bgH: 0,
    bgX: 0,
    bgY: 0,
  });

  const handleCtaClick = () => {
    if (isAuthenticated) {
      window.location.href = isAdminSession ? "/admin" : "/dashboard";
    } else {
      onOpenOnboarding();
    }
  };

  const updateLensPosition = useCallback((clientX: number, clientY: number) => {
    const bodyEl = browserBodyRef.current;
    if (!bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const localW = bodyEl.clientWidth || rect.width;
    const localH = bodyEl.clientHeight || rect.height;
    const x = Math.max(0, Math.min(localW, ((clientX - rect.left) / rect.width) * localW));
    const y = Math.max(0, Math.min(localH, ((clientY - rect.top) / rect.height) * localH));

    const imgEl = heroImgRef.current;
    const natW = imgEl?.naturalWidth || 1024;
    const natH = imgEl?.naturalHeight || 533;
    const natRatio = natW / Math.max(natH, 1);
    const boxRatio = localW / Math.max(localH, 1);

    // Match object-fit: cover + object-position: bottom exactly
    const drawW = boxRatio >= natRatio ? localW : localH * natRatio;
    const drawH = boxRatio >= natRatio ? localW / natRatio : localH;
    const drawLeft = (localW - drawW) / 2;
    const drawTop = localH - drawH;

    const bgW = drawW * LENS_ZOOM;
    const bgH = drawH * LENS_ZOOM;
    const bgX = LENS_RADIUS - (x - drawLeft) * LENS_ZOOM;
    const bgY = LENS_RADIUS - (y - drawTop) * LENS_ZOOM;

    setLens({ active: true, x, y, bgW, bgH, bgX, bgY });
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      updateLensPosition(e.clientX, e.clientY);
    },
    [updateLensPosition]
  );

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      updateLensPosition(e.clientX, e.clientY);
    },
    [updateLensPosition]
  );

  const handlePointerLeave = useCallback(() => {
    setLens((prev) => (prev.active ? { ...prev, active: false } : prev));
  }, []);

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

            <div className="selloi-hero-btn-wrap">
              <button
                type="button"
                className="selloi-btn-glass selloi-hero-btn"
                data-node-id="173:115"
                onClick={handleCtaClick}
              >
                <span>{t.cta}</span>
              </button>
            </div>
          </div>

          {/* Right Hero Visual Mockup */}
          <div className="selloi-hero-right" data-node-id="116:48">
            <div className="selloi-hero-mockup-glow" />
            <div className="selloi-hero-float-wrap">
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

                {/* Browser Content Area with Magnifier Lens */}
                <div
                  ref={browserBodyRef}
                  className={`selloi-browser-body${lens.active ? " is-zooming" : ""}`}
                  data-node-id="111:36"
                  onPointerEnter={handlePointerEnter}
                  onPointerMove={handlePointerMove}
                  onPointerLeave={handlePointerLeave}
                >
                  <img
                    ref={heroImgRef}
                    src="/figma/dashboard-hero.png"
                    alt="Selloi.uz — Telegram do‘konlari uchun AI sotuvchi boshqaruv paneli"
                    width={1024}
                    height={533}
                    fetchPriority="high"
                    decoding="async"
                    draggable={false}
                  />
                  <div
                    aria-hidden="true"
                    className={`selloi-hero-lens${lens.active ? " is-active" : ""}`}
                    style={{
                      left: `${lens.x - LENS_RADIUS}px`,
                      top: `${lens.y - LENS_RADIUS}px`,
                      width: `${LENS_RADIUS * 2}px`,
                      height: `${LENS_RADIUS * 2}px`,
                      backgroundImage: "url('/figma/dashboard-hero.png')",
                      backgroundSize: `${lens.bgW}px ${lens.bgH}px`,
                      backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
