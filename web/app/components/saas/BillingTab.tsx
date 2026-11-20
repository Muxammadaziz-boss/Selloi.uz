"use client";

import React, { useState } from "react";
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconDownload,
  IconExternalLink,
  IconFlame,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

interface SubscriptionOverview {
  organization_id: number;
  subscription_id: number;
  status: string; // mega_discount_active, mega_discount_expired, awaiting_subscription_selection, awaiting_monthly_payment, awaiting_yearly_payment, subscription_active, renewal_due, renewal_pending, subscription_expired, cancelled
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  days_remaining: number;
  seconds_remaining: number;
  is_commercial_access_active: boolean;
  mega_discount_used: boolean;
  mega_discount_eligible: boolean;
  notification: string | null;
  plan_prices: {
    monthly_uzs: number;
    yearly_uzs: number;
    monthly_usd: number;
    yearly_usd: number;
  };
}

interface BillingTabProps {
  subscription: SubscriptionOverview | null;
  loading: boolean;
  onRefresh: () => void;
  onUpgradeClick: () => void;
  onCancelSubscription: () => Promise<void>;
  onResumeSubscription: () => Promise<void>;
}

export function BillingTab({
  subscription,
  loading,
  onRefresh,
  onUpgradeClick,
  onCancelSubscription,
  onResumeSubscription,
}: BillingTabProps) {
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selectedPlanForSub, setSelectedPlanForSub] = useState<string>("pro");
  const [selectedCycleForSub, setSelectedCycleForSub] = useState<"monthly" | "yearly">("monthly");
  const [renewalConsentChecked, setRenewalConsentChecked] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  if (!subscription && loading) {
    return (
      <div className="card p-5 text-center">
        <div className="spinner-border text-primary mx-auto mb-3" role="status" />
        <p className="text-secondary mb-0">Obuna ma'lumotlari yuklanmoqda...</p>
      </div>
    );
  }

  const isMegaDiscountActive = subscription?.status === "mega_discount_active";
  const isMegaDiscountExpired = subscription?.status === "mega_discount_expired";
  const isSubscriptionActive = subscription?.status === "subscription_active";
  const isRenewalDue = subscription?.status === "renewal_due" || subscription?.status === "renewal_pending";
  const isExpired = subscription?.status === "subscription_expired";
  const isCancelled = subscription?.status === "cancelled";

  const formatDate = (isoStr: string | null | undefined) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("uz-UZ", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const formatUzs = (tiyinAmount: number | undefined) => {
    if (!tiyinAmount) return "0 so'm";
    const sums = Math.round(tiyinAmount / 100);
    return sums.toLocaleString("uz-UZ") + " so'm";
  };

  const handleStartMegaDiscount = async (planCode: string) => {
    setCheckoutLoading(true);
    try {
      const resp = await fetch("/api/billing/mega-discount/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planCode, return_url: window.location.href }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data.detail || "To'lov hisobini yaratishda xatolik yuz berdi");
        return;
      }
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err: any) {
      alert("Xatolik: " + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleStartSubscription = async () => {
    if (!renewalConsentChecked) {
      alert("Iltimos, avtomatik yangilanish shartlari va obuna shartnomasi bilan tanishib, rozilik bildiring.");
      return;
    }

    setCheckoutLoading(true);
    try {
      // 1. Record explicit user consent
      await fetch("/api/billing/subscription/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_cycle: selectedCycleForSub,
          agreed_amount: selectedCycleForSub === "yearly" ? subscription?.plan_prices.yearly_uzs : subscription?.plan_prices.monthly_uzs,
          accepted_terms_version: "v1.0"
        }),
      });

      // 2. Create subscription checkout
      const resp = await fetch("/api/billing/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_code: selectedPlanForSub,
          billing_cycle: selectedCycleForSub,
          return_url: window.location.href
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data.detail || "To'lov hisobini yaratishda xatolik yuz berdi");
        return;
      }
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err: any) {
      alert("Xatolik: " + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Mega Discount Active Countdown Banner */}
      {isMegaDiscountActive && (
        <div
          className="alert alert-success d-flex align-items-center justify-content-between p-3.5 rounded-3 shadow-sm"
          role="alert"
          style={{ background: "rgba(47, 179, 68, 0.12)", border: "1px solid rgba(47, 179, 68, 0.35)" }}
        >
          <div className="d-flex align-items-center gap-3">
            <IconFlame size={28} className="text-success flex-shrink-0" />
            <div>
              <h4 className="alert-title text-success mb-1 fw-bold fs-4">
                7 Kunlik Mega Chegirma Faol ({subscription?.days_remaining} kun qoldi)
              </h4>
              <div className="text-secondary small">
                Siz hozirda {subscription?.plan_name} tarifining barcha imkoniyatlaridan 7 kunlik maxsus chegirma orqali foydalanmoqdasiz. Tugash sanasi: {formatDate(subscription?.current_period_end)}.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-success btn-sm d-flex align-items-center gap-1.5 px-3.5 py-2 flex-shrink-0"
            onClick={onUpgradeClick}
          >
            <IconSparkles size={16} />
            <span>Doimiy Obunani Tanlash</span>
          </button>
        </div>
      )}

      {/* 2. Mega Discount Expired Banner (Official Notification Requirement) */}
      {isMegaDiscountExpired && (
        <div
          className="alert alert-warning d-flex align-items-center justify-content-between p-3.5 rounded-3 shadow-sm"
          role="alert"
          style={{ background: "rgba(245, 159, 0, 0.12)", border: "1px solid rgba(245, 159, 0, 0.35)" }}
        >
          <div className="d-flex align-items-center gap-3">
            <IconAlertCircle size={30} className="text-warning flex-shrink-0" />
            <div>
              <h4 className="alert-title text-warning mb-1 fw-bold fs-4">
                MEGA CHEGIRMA MUDDATI YAKUNLANDI
              </h4>
              <div className="text-dark small fw-medium">
                Selloi xizmatidan foydalanishni davom ettirish uchun oylik yoki yillik obunani tanlang.
              </div>
              <div className="text-secondary small mt-0.5">
                Barcha do'kon ma'lumotlaringiz, bot sozlamalaringiz va yozishmalar tarixi to'liq saqlanmoqda.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-warning btn-sm d-flex align-items-center gap-1.5 px-3.5 py-2 flex-shrink-0 fw-bold"
            onClick={() => {
              const el = document.getElementById("subscription-selection-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <IconSparkles size={16} />
            <span>Obunani tanlash</span>
          </button>
        </div>
      )}

      {/* 3. Subscription Expired Notice */}
      {isExpired && (
        <div
          className="alert alert-danger d-flex align-items-center justify-content-between p-3.5 rounded-3 shadow-sm"
          role="alert"
        >
          <div className="d-flex align-items-center gap-3">
            <IconAlertCircle size={28} className="text-danger flex-shrink-0" />
            <div>
              <h4 className="alert-title text-danger mb-1 fw-bold fs-4">Obuna muddati tugagan</h4>
              <div className="text-secondary small">
                Tijoriy AI funksiyalari to'xtatildi. Barcha do'kon ma'lumotlaringiz xavfsiz saqlanmoqda. Xizmatni davom ettirish uchun to'lovni tasdiqlang.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm d-flex align-items-center gap-1.5 px-3 py-2 flex-shrink-0"
            onClick={() => {
              const el = document.getElementById("subscription-selection-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <IconSparkles size={16} />
            <span>Obunani Yangilash</span>
          </button>
        </div>
      )}

      {/* 4. First-Time Mega Discount Offer Card (If Eligible) */}
      {subscription?.mega_discount_eligible && (
        <div className="card shadow-sm border border-warning border-opacity-35 bg-body-tertiary">
          <div className="card-header py-3 px-4 d-flex align-items-center justify-content-between bg-warning-lt">
            <div className="d-flex align-items-center gap-2">
              <IconFlame size={22} className="text-warning" />
              <h3 className="card-title fw-bold mb-0 text-warning">
                Bir Martalik Maxsus Mega Chegirma (7 Kunlik To'liq Imkoniyat)
              </h3>
            </div>
            <span className="badge bg-warning text-dark fw-bold">Yangi mijozlar uchun</span>
          </div>
          <div className="card-body p-4">
            <p className="text-secondary mb-4">
              Selloi tizimining to'liq quvvatini sinab ko'rishingiz uchun 7 kunlik maxsus boshlang'ich chegirma taklif etiladi.
              Bu bepul sinov yoki karta tekshirish to'lovi emas, balki rasmiy imtiyozli to'lovdir.
            </p>

            <div className="row g-3">
              {/* START Mega Discount */}
              <div className="col-md-4">
                <div className="p-3.5 rounded border border-secondary border-opacity-20 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="badge bg-blue-lt text-blue mb-2">START TARIF</div>
                    <div className="fs-1 fw-bold text-primary font-monospace">$1 <span className="fs-5 fw-normal text-secondary">(13 000 so'm)</span></div>
                    <div className="text-secondary small mb-3">7 kunlik to'liq kirish huquqi</div>
                    <ul className="list-unstyled small space-y-1.5 text-secondary">
                      <li><IconCheck size={14} className="text-success me-1" /> AI avtomatik javoblar</li>
                      <li><IconCheck size={14} className="text-success me-1" /> Telegram integratsiyasi</li>
                      <li><IconCheck size={14} className="text-success me-1" /> Jonli operator nazorati</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100 mt-3"
                    disabled={checkoutLoading}
                    onClick={() => handleStartMegaDiscount("start")}
                  >
                    START $1 Boshlash
                  </button>
                </div>
              </div>

              {/* PRO Mega Discount */}
              <div className="col-md-4">
                <div className="p-3.5 rounded border border-success border-opacity-40 bg-white h-100 d-flex flex-column justify-content-between shadow-sm position-relative">
                  <span className="badge bg-success position-absolute top-0 end-0 m-2">Eng Tavsiya Etilgan</span>
                  <div>
                    <div className="badge bg-green-lt text-green mb-2">PRO TARIF</div>
                    <div className="fs-1 fw-bold text-success font-monospace">$2 <span className="fs-5 fw-normal text-secondary">(26 000 so'm)</span></div>
                    <div className="text-secondary small mb-3">7 kunlik to'liq kirish huquqi</div>
                    <ul className="list-unstyled small space-y-1.5 text-secondary">
                      <li><IconCheck size={14} className="text-success me-1" /> Barcha START imkoniyatlari</li>
                      <li><IconCheck size={14} className="text-success me-1" /> Ko'p kanalli integratsiya</li>
                      <li><IconCheck size={14} className="text-success me-1" /> RAG bilimlar bazasi</li>
                      <li><IconCheck size={14} className="text-success me-1" /> Rasmli xabarlarni tushunish</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="btn btn-success btn-sm w-100 mt-3 fw-bold"
                    disabled={checkoutLoading}
                    onClick={() => handleStartMegaDiscount("pro")}
                  >
                    PRO $2 Boshlash
                  </button>
                </div>
              </div>

              {/* ULTRA Mega Discount */}
              <div className="col-md-4">
                <div className="p-3.5 rounded border border-secondary border-opacity-20 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="badge bg-purple-lt text-purple mb-2">ULTRA TARIF</div>
                    <div className="fs-1 fw-bold text-primary font-monospace">$3 <span className="fs-5 fw-normal text-secondary">(39 000 so'm)</span></div>
                    <div className="text-secondary small mb-3">7 kunlik to'liq kirish huquqi</div>
                    <ul className="list-unstyled small space-y-1.5 text-secondary">
                      <li><IconCheck size={14} className="text-success me-1" /> Barcha PRO imkoniyatlari</li>
                      <li><IconCheck size={14} className="text-success me-1" /> Cheksiz quvvat & ustuvorlik</li>
                      <li><IconCheck size={14} className="text-success me-1" /> Maxsus AI vositalari</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100 mt-3"
                    disabled={checkoutLoading}
                    onClick={() => handleStartMegaDiscount("ultra")}
                  >
                    ULTRA $3 Boshlash
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Main Subscription Status Card */}
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card shadow-sm border border-secondary border-opacity-15 h-100">
            <div className="card-header py-3 px-4 d-flex align-items-center justify-content-between">
              <div>
                <h3 className="card-title fw-bold mb-0">Joriy Obuna Holati</h3>
                <span className="text-secondary small">Tashkilot ID: #{subscription?.organization_id}</span>
              </div>
              <span
                className={`badge fs-5 px-3 py-1.5 fw-bold ${
                  isSubscriptionActive
                    ? "bg-green-lt text-green"
                    : isMegaDiscountActive
                    ? "bg-blue-lt text-blue"
                    : isMegaDiscountExpired
                    ? "bg-warning-lt text-warning"
                    : "bg-danger-lt text-danger"
                }`}
              >
                {isSubscriptionActive
                  ? "Faol Obuna"
                  : isMegaDiscountActive
                  ? "Mega Chegirma (7 kun)"
                  : isMegaDiscountExpired
                  ? "Mega Chegirma Yakunlangan"
                  : "To'lov Kutilmoqda"}
              </span>
            </div>

            <div className="card-body p-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-10 gap-3">
                <div>
                  <div className="text-secondary small text-uppercase fw-bold mb-1">Tarif Rejasi</div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="fs-1 fw-bold text-primary font-monospace">{subscription?.plan_name || "START"}</span>
                    {subscription?.billing_cycle === "mega_discount" && (
                      <span className="badge bg-warning-lt text-warning fw-bold">7 Kunlik Aksiya</span>
                    )}
                  </div>
                </div>

                <div className="text-lg-end">
                  <div className="text-secondary small text-uppercase fw-bold mb-1">Obuna Sikli</div>
                  <div className="fs-3 fw-bold text-primary font-monospace">
                    {subscription?.billing_cycle === "yearly"
                      ? "Yillik (365 kun)"
                      : subscription?.billing_cycle === "monthly"
                      ? "Oylik (30 kun)"
                      : "7 kunlik Mega Chegirma"}
                  </div>
                </div>
              </div>

              {/* Timing Details */}
              <div className="row g-3 mb-4">
                <div className="col-sm-6">
                  <div className="p-3 rounded bg-body-tertiary border border-secondary border-opacity-10">
                    <div className="text-secondary small mb-1">Faollashgan vaqt</div>
                    <div className="fw-semibold text-primary small">
                      {formatDate(subscription?.current_period_start)}
                    </div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="p-3 rounded bg-body-tertiary border border-secondary border-opacity-10">
                    <div className="text-secondary small mb-1">Amal qilish muddati (Tugash sanasi)</div>
                    <div className="fw-semibold text-primary small">
                      {formatDate(subscription?.current_period_end)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary d-flex align-items-center gap-1.5"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <IconRefresh size={15} className={loading ? "spin" : ""} />
                  <span>Ma'lumotlarni Yangilash</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TezCheck Payment Provider Card */}
        <div className="col-lg-4">
          <div className="card shadow-sm border border-secondary border-opacity-15 h-100">
            <div className="card-header py-3 px-3">
              <h3 className="card-title fw-bold mb-0 d-flex align-items-center gap-2">
                <IconCreditCard size={18} className="text-primary" />
                <span>To'lov Tizimi (TezCheck)</span>
              </h3>
            </div>
            <div className="card-body p-3.5 d-flex flex-column justify-content-between">
              <div>
                <div className="p-3 rounded bg-dark border border-secondary border-opacity-20 mb-3 text-white">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="badge bg-primary text-white font-monospace">TezCheck Gateway</span>
                    <IconShieldCheck size={20} className="text-success" />
                  </div>
                  <div className="small font-monospace mb-2" style={{ color: "#cbd5e1" }}>
                    Bir martalik xavfsiz to'lovlar
                  </div>
                  <div className="small" style={{ color: "#94a3b8" }}>
                    Karta ma'lumotlari Selloi serverlarida aslo saqlanmaydi. Barcha to'lovlar TezCheck himoyalangan portalida amalga oshiriladi.
                  </div>
                </div>

                <div className="alert alert-info py-2 px-3 small mb-0">
                  <strong>Muhim:</strong> Obuna muddati tugashidan oldin sizga yangilanish hisobi shakllantiriladi va bildirishnoma yuboriladi.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Regular Monthly and Yearly Subscription Selection Section */}
      <div className="card shadow-sm border border-secondary border-opacity-15" id="subscription-selection-section">
        <div className="card-header py-3 px-4 d-flex align-items-center justify-content-between">
          <div>
            <h3 className="card-title fw-bold mb-0">Doimiy Obunani Tanlash (Oylik va Yillik)</h3>
            <span className="text-secondary small">Haftalik obuna yo'q. Faqat 30 kunlik oylik va 365 kunlik yillik rejalar.</span>
          </div>
          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn btn-sm ${selectedCycleForSub === "monthly" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setSelectedCycleForSub("monthly")}
            >
              Oylik (30 kun)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedCycleForSub === "yearly" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setSelectedCycleForSub("yearly")}
            >
              Yillik (365 kun - 17% tejamkor)
            </button>
          </div>
        </div>

        <div className="card-body p-4">
          <div className="row g-3 mb-4">
            {/* START Plan */}
            <div className="col-md-4">
              <div
                className={`p-3.5 rounded border cursor-pointer h-100 ${
                  selectedPlanForSub === "start" ? "border-primary bg-primary-lt" : "border-secondary border-opacity-20"
                }`}
                onClick={() => setSelectedPlanForSub("start")}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-bold fs-4">START</span>
                  {selectedPlanForSub === "start" && <IconCheck size={20} className="text-primary" />}
                </div>
                <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                  {selectedCycleForSub === "yearly" ? "2 450 000 so'm" : "245 000 so'm"}
                </div>
                <div className="text-secondary small mb-3">
                  ${selectedCycleForSub === "yearly" ? "190 / yil" : "19 / oy"}
                </div>
                <ul className="list-unstyled small space-y-1 text-secondary">
                  <li>AI Avtomatik javoblar</li>
                  <li>Operator takeover</li>
                  <li>Jonli chatlar paneli</li>
                </ul>
              </div>
            </div>

            {/* PRO Plan */}
            <div className="col-md-4">
              <div
                className={`p-3.5 rounded border cursor-pointer h-100 position-relative ${
                  selectedPlanForSub === "pro" ? "border-success bg-green-lt shadow-sm" : "border-secondary border-opacity-20"
                }`}
                onClick={() => setSelectedPlanForSub("pro")}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-bold fs-4">PRO</span>
                  <span className="badge bg-success text-white">Eng Ommabop</span>
                </div>
                <div className="fs-2 fw-bold font-monospace text-success mb-1">
                  {selectedCycleForSub === "yearly" ? "7 600 000 so'm" : "760 000 so'm"}
                </div>
                <div className="text-secondary small mb-3">
                  ${selectedCycleForSub === "yearly" ? "590 / yil" : "59 / oy"}
                </div>
                <ul className="list-unstyled small space-y-1 text-secondary">
                  <li>Barcha START imkoniyatlari</li>
                  <li>Ko'p kanalli sotuvlar</li>
                  <li>Vektorli RAG qidiruvi</li>
                  <li>Rasmlarni tushunish</li>
                </ul>
              </div>
            </div>

            {/* ULTRA Plan */}
            <div className="col-md-4">
              <div
                className={`p-3.5 rounded border cursor-pointer h-100 ${
                  selectedPlanForSub === "ultra" ? "border-purple bg-purple-lt" : "border-secondary border-opacity-20"
                }`}
                onClick={() => setSelectedPlanForSub("ultra")}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-bold fs-4">ULTRA</span>
                  {selectedPlanForSub === "ultra" && <IconCheck size={20} className="text-purple" />}
                </div>
                <div className="fs-2 fw-bold font-monospace text-primary mb-1">
                  {selectedCycleForSub === "yearly" ? "19 200 000 so'm" : "1 920 000 so'm"}
                </div>
                <div className="text-secondary small mb-3">
                  ${selectedCycleForSub === "yearly" ? "1490 / yil" : "149 / oy"}
                </div>
                <ul className="list-unstyled small space-y-1 text-secondary">
                  <li>Barcha PRO imkoniyatlari</li>
                  <li>Cheksiz xabarlar & ustuvorlik</li>
                  <li>Maxsus AI vositalari</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 7. Explicit User Consent Box (NEVER PRECHECKED) */}
          <div className="p-3.5 rounded bg-body-tertiary border border-secondary border-opacity-20 mb-4">
            <h4 className="fw-bold mb-2">Avtomatik Yangilanish va Obuna Shartlari</h4>
            <div className="text-secondary small mb-3">
              <p className="mb-1">
                <strong>Reja:</strong> {selectedPlanForSub.toUpperCase()} ({selectedCycleForSub === "yearly" ? "Yillik - 365 kun" : "Oylik - 30 kun"}).
              </p>
              <p className="mb-1">
                <strong>To'lov miqdori:</strong>{" "}
                {selectedPlanForSub === "start"
                  ? selectedCycleForSub === "yearly" ? "2 450 000 so'm ($190)" : "245 000 so'm ($19)"
                  : selectedPlanForSub === "pro"
                  ? selectedCycleForSub === "yearly" ? "7 600 000 so'm ($590)" : "760 000 so'm ($59)"
                  : selectedCycleForSub === "yearly" ? "19 200 000 so'm ($1490)" : "1 920 000 so'm ($149)"}
              </p>
              <p className="mb-1">
                <strong>Yangilanish tartibi:</strong> TezCheck to'lov tizimida kartani avtomatik yechib olish mavjud emas. Obunangiz tugash arafasida yangilash uchun hisob-faktura yuboriladi va siz to'lovni tasdiqlashingiz kerak bo'ladi. Obunani istalgan vaqtda shaxsiy kabinet orqali bekor qilishingiz mumkin.
              </p>
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="renewalConsentCheckbox"
                checked={renewalConsentChecked}
                onChange={(e) => setRenewalConsentChecked(e.target.checked)}
              />
              <label className="form-check-label fw-semibold text-dark small" htmlFor="renewalConsentCheckbox">
                Men obunamning belgilangan muddatlarda avtomatik yangilanishiga roziman.
              </label>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-end">
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2.5 fw-bold"
              disabled={checkoutLoading || !renewalConsentChecked}
              onClick={handleStartSubscription}
            >
              <IconSparkles size={18} />
              <span>TezCheck Orqali To'lovga O'tish</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
