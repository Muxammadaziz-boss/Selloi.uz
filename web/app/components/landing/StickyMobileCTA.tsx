"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

interface StickyMobileCTAProps {
  onOpenOnboarding: () => void;
}

export default function StickyMobileCTA({ onOpenOnboarding }: StickyMobileCTAProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show when scrolled past 400px (past Hero)
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="selloi-mobile-sticky-cta d-md-none">
      <div className="d-flex flex-column">
        <span className="text-white fw-bold" style={{ fontSize: "0.85rem", lineHeight: 1.1 }}>
          Selloi AI
        </span>
        <span className="text-secondary small" style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
          7 kun bepul sinov
        </span>
      </div>

      <button
        onClick={onOpenOnboarding}
        className="selloi-btn-primary py-2 px-3.5 d-flex align-items-center gap-1.5"
        style={{ fontSize: "0.85rem", borderRadius: "100px" }}
      >
        <Sparkles size={14} />
        <span>Boshlash</span>
        <ArrowRight size={13} />
      </button>
    </div>
  );
}
