"use client";

import React from "react";
import {
  IconArrowRight,
  IconCheck,
  IconSparkles,
} from "@tabler/icons-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  requiredPlan?: string;
  message?: string;
  plans?: any[];
  onUpgradeToPlan: (planCode: string) => Promise<void>;
}

const PLAN_BENEFITS: Record<string, { priceLabel: string; bullets: string[] }> = {
  start: {
    priceLabel: "244 000 so'm/oy",
    bullets: [
      "1,000 ta oylik AI xabar va 500 suhbat",
      "1 ta Telegram Business bot va kanal ulanishi",
      "Jonli inbox, takeover va katalog boshqaruvi",
    ],
  },
  pro: {
    priceLabel: "499 000 so'm/oy",
    bullets: [
      "5,000+ ta oylik AI xabar va 2,500 buyurtma",
      "Telegram fotosuratlari va skrinshotlarni AI orqali tahlil qilish (Vision)",
      "Kengaytirilgan RAG va Click/Payme/TezCheck to'lovlari",
    ],
  },
  ultra: {
    priceLabel: "999 000 so'm/oy",
    bullets: [
      "25,000+ ta oylik AI xabar va kengaytirilgan limitlar",
      "Ko'p kanalli tarmoq do'konlar uchun alohida ustuvorlik",
      "50 tagacha operator o'rni va maxsus qo'llab-quvvatlash",
    ],
  },
};

export function UpgradeModal({
  isOpen,
  onClose,
  featureName,
  requiredPlan = "pro",
  message,
  plans = [],
  onUpgradeToPlan,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  const rawLower = (requiredPlan || "pro").toLowerCase().trim();
  const normalizedCode = rawLower === "standard" || rawLower === "standart" ? "pro" : rawLower;
  const targetPlan = normalizedCode.toUpperCase();
  const tierMeta = PLAN_BENEFITS[normalizedCode] || PLAN_BENEFITS.pro;
  const matchedPlan = plans.find((p) => String(p.code || "").toLowerCase() === normalizedCode);
  const priceLabel =
    matchedPlan?.price_monthly_uzs_formatted ||
    matchedPlan?.price_monthly_formatted ||
    tierMeta.priceLabel;

  return (
    <div
      className="modal modal-blur fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1070 }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border border-secondary border-opacity-25" style={{ borderRadius: 18 }}>
          <div className="modal-header py-3 px-4 d-flex align-items-center justify-content-between border-0 pb-0">
            <span className="badge bg-primary-lt text-primary fw-bold text-uppercase px-2.5 py-1">
              Tarif Cheklovi
            </span>
            <button type="button" className="btn-close" aria-label="Yopish" onClick={onClose} />
          </div>

          <div className="modal-body p-4 text-center">
            <div className="p-3 bg-primary-lt text-primary rounded-circle d-inline-flex mb-3">
              <IconSparkles size={32} />
            </div>

            <h3 className="fw-bold text-white mb-2 fs-2">
              {featureName ? `${featureName} Imkoniyatini Faollashtiring` : "Tarifni Oshirish Tavsiya Etiladi"}
            </h3>

            <p className="text-secondary small mb-4" style={{ lineHeight: 1.5 }}>
              {message || (
                <>
                  Ushbu funksiya yoki oshirilgan limitdan foydalanish uchun{" "}
                  <strong className="text-white">{targetPlan}</strong> tarif rejasiga o&apos;tishingiz lozim.
                </>
              )}
            </p>

            {/* Quick Benefits List */}
            <div className="p-3 bg-dark rounded-3 border border-secondary border-opacity-20 text-start small space-y-2 mb-4">
              <div className="fw-bold text-primary mb-1">
                {targetPlan} Tarifiga O&apos;tsangiz:
              </div>
              {tierMeta.bullets.map((bullet, idx) => (
                <div key={idx} className="d-flex align-items-center gap-2">
                  <IconCheck size={16} className="text-success flex-shrink-0" />
                  <span className="text-white">{bullet}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <button
              type="button"
              className="btn btn-primary w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
              onClick={async () => {
                await onUpgradeToPlan(normalizedCode);
                onClose();
              }}
            >
              <span>{targetPlan} Tarifiga O&apos;tish ({priceLabel})</span>
              <IconArrowRight size={16} />
            </button>
            <button
              type="button"
              className="btn btn-link text-secondary btn-sm mt-2 text-decoration-none"
              onClick={onClose}
            >
              Keyinroq ko&apos;rib chiqish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
