"use client";

import React from "react";
import {
  IconCheck,
  IconLock,
  IconSparkles,
  IconDeviceDesktop,
  IconBrandApple,
  IconLayoutDashboard,
} from "@tabler/icons-react";
import { useDesign } from "./DesignContext";
import { DesignUpgradeModal } from "./DesignUpgradeModal";
import { DESIGN_DEFINITIONS, DesignId } from "../../lib/design-entitlements";
import { Badge } from "../ui/Badge";

interface DesignSelectorProps {
  onNavigateToBilling?: () => void;
}

export function DesignSelector({ onNavigateToBilling }: DesignSelectorProps) {
  const { currentDesign, setDesign, isDesignLocked } = useDesign();

  const designs: Array<{
    id: DesignId;
    icon: React.ReactNode;
    visualPreview: React.ReactNode;
  }> = [
    {
      id: "premium",
      icon: <IconDeviceDesktop size={18} />,
      visualPreview: (
        <div
          className="w-100 rounded p-2 mb-2 d-flex flex-column gap-1.5"
          style={{
            backgroundColor: "#090909",
            border: "1px solid #262626",
            height: "76px",
          }}
        >
          <div className="d-flex align-items-center justify-content-between pb-1 border-bottom" style={{ borderColor: "#1f1f1f" }}>
            <div className="d-flex align-items-center gap-1">
              <span className="rounded-circle" style={{ width: "6px", height: "6px", backgroundColor: "#3b82f6" }} />
              <span style={{ fontSize: "9px", color: "#f8fafc", fontWeight: 600 }}>CONTROL CENTER</span>
            </div>
            <span className="py-0 px-1 rounded" style={{ fontSize: "8px", backgroundColor: "#78350f", color: "#fef3c7" }}>
              AI ONLINE
            </span>
          </div>
          <div className="d-flex gap-1.5 flex-grow-1">
            <div className="rounded p-1 d-flex flex-column justify-content-center" style={{ width: "35%", backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <span style={{ fontSize: "8px", color: "#e2e8f0" }}>SIDEBAR</span>
              <span style={{ fontSize: "9px", color: "#f8fafc", fontWeight: 700 }}>270px</span>
            </div>
            <div className="rounded p-1 d-flex flex-column justify-content-center flex-grow-1" style={{ backgroundColor: "#171717", border: "1px solid #262626" }}>
              <span style={{ fontSize: "8px", color: "#e2e8f0" }}>KONVERSIYA</span>
              <span style={{ fontSize: "11px", color: "#34d399", fontWeight: 800 }}>88.4%</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "ios",
      icon: <IconBrandApple size={18} />,
      visualPreview: (
        <div
          className="w-100 rounded-3 p-2 mb-2 d-flex flex-column gap-1.5 position-relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            height: "76px",
          }}
        >
          <div className="d-flex align-items-center justify-content-between pb-1 border-bottom" style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}>
            <span style={{ fontSize: "9px", color: "#ffffff", fontWeight: 600 }}> iOS Glass</span>
            <span className="badge rounded-pill py-0 px-1.5" style={{ fontSize: "8px", backgroundColor: "#0056b3", color: "#ffffff" }}>
              Active
            </span>
          </div>
          <div className="d-flex gap-1.5 flex-grow-1 align-items-center">
            <div className="rounded-pill px-2 py-0.5" style={{ backgroundColor: "rgba(255, 255, 255, 0.18)", fontSize: "8px", color: "#ffffff" }}>
              iMessage
            </div>
            <div className="rounded-2 p-1 flex-grow-1 text-center" style={{ backgroundColor: "#0c4a6e", border: "1px solid #0284c7" }}>
              <span style={{ fontSize: "11px", color: "#f0f9ff", fontWeight: 800 }}>SF Pro iOS</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "classic",
      icon: <IconLayoutDashboard size={18} />,
      visualPreview: (
        <div
          className="w-100 rounded p-2 mb-2 d-flex flex-column gap-1.5"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            height: "76px",
          }}
        >
          <div className="d-flex align-items-center justify-content-between pb-1 border-bottom" style={{ borderColor: "var(--border-subtle)" }}>
            <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontWeight: 600 }}>Classic Tabler</span>
            <span className="badge bg-secondary-lt py-0 px-1" style={{ fontSize: "8px" }}>
              Standart
            </span>
          </div>
          <div className="d-flex gap-1 flex-grow-1 align-items-center">
            <div className="rounded p-1 flex-grow-1 text-center" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "9px", color: "var(--text-primary)" }}>Boshqaruv Paneli</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="row g-3">
        {designs.map(({ id, icon, visualPreview }) => {
          const meta = DESIGN_DEFINITIONS[id];
          const isSelected = currentDesign === id;
          const locked = isDesignLocked(id);

          return (
            <div key={id} className="col-12 col-md-4">
              <div
                onClick={() => setDesign(id)}
                className={`p-3 rounded-3 border position-relative h-100 d-flex flex-column justify-content-between cursor-pointer transition-fast ${
                  isSelected ? "border-accent shadow-sm" : "border-subtle"
                }`}
                style={{
                  backgroundColor: isSelected ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                }}
              >
                {/* Top Badge Indicators */}
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-1.5">
                    <span className="text-secondary">{icon}</span>
                    <span className="fw-bold text-primary small">{meta.name}</span>
                  </div>

                  <div className="d-flex align-items-center gap-1">
                    {locked ? (
                      <span
                        className="badge rounded-pill d-inline-flex align-items-center gap-1"
                        style={{
                          backgroundColor: "var(--warning-subtle)",
                          color: "var(--warning-text)",
                          border: "1px solid var(--warning-border)",
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "2px 7px",
                        }}
                      >
                        <IconLock size={11} /> {meta.badge}
                      </span>
                    ) : (
                      <span
                        className="badge rounded-pill"
                        style={{
                          backgroundColor: "var(--bg-surface)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-default)",
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "2px 7px",
                        }}
                      >
                        {meta.badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual Architecture Preview */}
                {visualPreview}

                {/* Description & Selection Footer */}
                <p className="text-secondary small mb-3 flex-grow-1" style={{ fontSize: "0.75rem", lineHeight: 1.4 }}>
                  {meta.description}
                </p>

                <div className="d-flex align-items-center justify-content-between pt-2 border-top border-subtle">
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                    {meta.minPlanLabel}
                  </div>

                  {isSelected ? (
                    <span className="d-flex align-items-center gap-1 text-success fw-bold small" style={{ fontSize: "0.75rem" }}>
                      <IconCheck size={14} /> Faol
                    </span>
                  ) : locked ? (
                    <span className="d-flex align-items-center gap-1 text-warning fw-semibold small" style={{ fontSize: "0.72rem" }}>
                      <IconLock size={12} /> Qulflangan
                    </span>
                  ) : (
                    <span className="text-secondary small" style={{ fontSize: "0.72rem" }}>
                      Tanlash
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upgrade Modal if User clicks a locked design */}
      <DesignUpgradeModal onNavigateToBilling={onNavigateToBilling} />
    </>
  );
}
