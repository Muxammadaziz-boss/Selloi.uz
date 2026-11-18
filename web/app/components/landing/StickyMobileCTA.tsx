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
      // Show when scrolled past 380px
      setVisible(window.scrollY > 380);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="s-mobile-cta d-md-none">
      <div className="d-flex flex-column">
        <span className="text-white fw-bold" style={{ fontSize: "0.86rem", lineHeight: 1.1 }}>
          Selloi AI
        </span>
        <span className="small" style={{ fontSize: "0.72rem", color: "var(--s-purple-soft)" }}>
          7 kun bepul sinov
        </span>
      </div>

      <button
        onClick={onOpenOnboarding}
        className="s-btn-primary py-2 px-3.5 d-flex align-items-center gap-1.5"
        style={{ fontSize: "0.85rem", borderRadius: "100px" }}
      >
        <Sparkles size={14} />
        <span>Boshlash</span>
        <ArrowRight size={13} />
      </button>
    </div>
  );
}
