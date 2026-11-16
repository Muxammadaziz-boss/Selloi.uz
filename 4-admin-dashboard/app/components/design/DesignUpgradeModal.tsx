"use client";

import React from "react";
import {
  IconLock,
  IconSparkles,
  IconCheck,
  IconArrowRight,
  IconX,
  IconShieldLock,
} from "@tabler/icons-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useDesign } from "./DesignContext";
import { DESIGN_DEFINITIONS, DesignId } from "../../lib/design-entitlements";

interface DesignUpgradeModalProps {
  onNavigateToBilling?: () => void;
}

export function DesignUpgradeModal({ onNavigateToBilling }: DesignUpgradeModalProps) {
  const {
    upgradeModalOpen,
    closeUpgradeModal,
    targetUpgradeDesign,
    activePlan,
  } = useDesign();

  if (!upgradeModalOpen || !targetUpgradeDesign) return null;

  const designMeta = DESIGN_DEFINITIONS[targetUpgradeDesign];
  const requiredPlan = designMeta?.minPlanLabel || "Yuqori Tarif";

  const handleUpgrade = () => {
    closeUpgradeModal();
    if (onNavigateToBilling) {
      onNavigateToBilling();
    } else if (typeof window !== "undefined") {
      window.location.hash = "#billing";
    }
  };

  return (
    <Modal
      isOpen={upgradeModalOpen}
      onClose={closeUpgradeModal}
      title="Dizayn Tizimi Cheklangan (Upgrade Talab Qilinadi)"
      size="md"
    >
      <div className="d-flex flex-column gap-3 py-2">
        {/* Header Banner */}
        <div
          className="p-3 rounded-3 d-flex align-items-center gap-3"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
          }}
        >
          <div
            className="rounded-circle p-2 d-flex align-items-center justify-content-center text-warning"
            style={{ backgroundColor: "rgba(245, 158, 11, 0.2)" }}
          >
            <IconShieldLock size={28} />
          </div>
          <div>
            <div className="fw-bold text-primary" style={{ fontSize: "1rem" }}>
              {designMeta?.name} tizimi qulflangan
            </div>
            <div className="text-secondary small">
              Ushbu vizual uslubdan foydalanish uchun <strong>{requiredPlan}</strong> tarifi talab qilinadi.
            </div>
          </div>
        </div>

        {/* Plan Comparison Box */}
        <div
          className="p-3 rounded-2"
          style={{
            backgroundColor: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-subtle">
            <span className="text-secondary small">Sizning amaldagi tarifingiz:</span>
            <Badge variant="default" className="text-uppercase fw-bold">
              {activePlan}
            </Badge>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-subtle">
            <span className="text-secondary small">Talab qilinadigan tarif:</span>
            <Badge variant="accent" className="text-uppercase fw-bold">
              {designMeta?.badge || "PRO"}
            </Badge>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span className="text-secondary small">Tizim holati:</span>
            <span className="text-warning small fw-medium d-flex align-items-center gap-1">
              <IconLock size={14} /> Eksklyuziv Dizayn
            </span>
          </div>
        </div>

        {/* Feature Highlights of the Locked Design */}
        <div className="small">
          <div className="text-secondary fw-semibold mb-2 text-uppercase font-monospace" style={{ fontSize: "0.72rem" }}>
            {designMeta?.name} afzalliklari:
          </div>
          <ul className="list-unstyled d-flex flex-column gap-1.5 m-0 ps-1">
            {targetUpgradeDesign === "premium" && (
              <>
                <li className="d-flex align-items-center gap-2 text-primary">
                  <IconCheck size={14} className="text-success" />
                  Chuqur qora minimalist SaaS interfeysi (#090909)
                </li>
                <li className="d-flex align-items-center gap-2 text-primary">
                  <IconCheck size={14} className="text-success" />
                  Ixcham 270px vertikal menyu va tezkor Ctrl+K qidiruv
                </li>
                <li className="d-flex align-items-center gap-2 text-primary">
                  <IconCheck size={14} className="text-success" />
                  Chiroyli Outline piktogrammalar va aniq KPI metrikalari
                </li>
              </>
            )}
            {targetUpgradeDesign === "ios" && (
              <>
                <li className="d-flex align-items-center gap-2 text-primary">
                  <IconCheck size={14} className="text-success" />
                  Muzlatilgan shisha effekti (Frosted Glass blur 28px)
                </li>
                <li className="d-flex align-items-center gap-2 text-primary">
                  <IconCheck size={14} className="text-success" />
                  Apple SF Pro tipografiyasi va iOS kapsula boshqaruvi
                </li>
                <li className="d-flex align-items-center gap-2 text-primary">
                  <IconCheck size={14} className="text-success" />
                  iMessage uslubidagi jonli chat pufakchalari
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="d-flex justify-content-end gap-2 mt-3 pt-2 border-top border-subtle">
          <Button variant="ghost" size="sm" onClick={closeUpgradeModal}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleUpgrade}
            icon={<IconArrowRight size={15} />}
          >
            Tarifni Yangilash (Upgrade to {designMeta?.badge})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
