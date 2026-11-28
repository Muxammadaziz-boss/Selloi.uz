"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconCreditCard,
  IconExternalLink,
  IconFlame,
  IconReceipt,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import { Skeleton } from "../ui/Skeleton";
import { api } from "../../lib/dashboardApi";

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
  cancel_at_period_end?: boolean;
  notification: string | null;
  plan_prices: {
    monthly_uzs: number;
    yearly_uzs: number;
    monthly_usd: number;
    yearly_usd: number;
  };
}

interface BillingInvoiceItem {
  id: string;
  bill_id: string;
  order_id?: string;
  plan_code?: string;
  billing_cycle?: string;
  amount: number;
  amount_uzs?: number;
  currency: string;
  status: string;
  paid_at?: string | null;
  created_at?: string;
  checkout_url?: string | null;
  provider?: string;
}

interface BillingTabProps {
  subscription: SubscriptionOverview | null;
  plans?: any[];
  loading: boolean;
  onRefresh: () => void;
  onUpgradeClick: () => void;
  onCancelSubscription: () => Promise<void>;
  onResumeSubscription: () => Promise<void>;
  initialPlan?: string | null;
  initialBillingCycle?: "monthly" | "yearly" | null;
}

interface ResolvedTierCard {
  code: string;
  name: string;
  promoUzs: number;
  promoUsdLabel: string;
  monthlyUzs: number;
  yearlyUzs: number;
  monthlyUsdLabel: string;
  yearlyUsdLabel: string;
  promoHighlights: string[];
  subHighlights: string[];
  isPopular?: boolean;
}

const CANONICAL_TIERS: ResolvedTierCard[] = [
  {
    code: "start",
    name: "START",
    promoUzs: 13000,
    promoUsdLabel: "$1",
    monthlyUzs: 244000,
    yearlyUzs: 2440000,
    monthlyUsdLabel: "$19 / oy",
    yearlyUsdLabel: "$190 / yil",
    promoHighlights: ["AI avtomatik javoblar", "Telegram integratsiyasi", "2 operator o'rni"],
    subHighlights: ["AI Avtomatik javoblar", "Operator takeover", "Jonli chatlar paneli", "2 ta operator o'rni"],
  },
  {
    code: "pro",
    name: "PRO",
    promoUzs: 26000,
    promoUsdLabel: "$2",
    monthlyUzs: 499000,
    yearlyUzs: 4990000,
    monthlyUsdLabel: "$39 / oy",
    yearlyUsdLabel: "$390 / yil",
    promoHighlights: ["AI Vision + RAG bilim bazasi", "3 ta bot va 5 ta kanal", "Click/Payme & 10 operator"],
    subHighlights: ["Barcha START imkoniyatlar", "AI Vision rasmdan tovar tanish", "Vektorli RAG qidiruvi", "Click va Payme to'lovlari"],
    isPopular: true,
  },
  {
    code: "ultra",
    name: "ULTRA",
    promoUzs: 39000,
    promoUsdLabel: "$3",
    monthlyUzs: 999000,
    yearlyUzs: 9990000,
    monthlyUsdLabel: "$79 / oy",
    yearlyUsdLabel: "$790 / yil",
    promoHighlights: ["Barcha PRO imkoniyatlar", "Yuqori yuklama & ustuvorlik", "24/7 shaxsiy qo'llab-quvvatlash"],
    subHighlights: ["Barcha PRO imkoniyatlari", "Kengaytirilgan limitlar", "Ko'p kanalli tarmoq do'konlar", "50 tagacha operator"],
  },
];

function formatWholeUzs(uzsAmount: number): string {
  return `${Math.round(uzsAmount).toLocaleString("ru-RU")} so'm`;
}

export function BillingTab({
  subscription,
  plans = [],
  loading,
  onRefresh,
  onUpgradeClick,
  onCancelSubscription,
  onResumeSubscription,
  initialPlan,
  initialBillingCycle,
}: BillingTabProps) {
  const normalizePlan = useCallback((p: string | null | undefined) => {
    if (!p) return "pro";
    const lower = p.toLowerCase().trim();
    if (lower === "standard" || lower === "standart") return "pro";
    if (["start", "pro", "ultra"].includes(lower)) return lower;
    return "pro";
  }, []);

  const [actionBusy, setActionBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selectedPlanForSub, setSelectedPlanForSub] = useState<string>(normalizePlan(initialPlan || subscription?.plan_code));
  const [selectedCycleForSub, setSelectedCycleForSub] = useState<"monthly" | "yearly">(
    initialBillingCycle === "yearly" ? "yearly" : "monthly"
  );
  const [renewalConsentChecked, setRenewalConsentChecked] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoiceItem[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  useEffect(() => {
    if (initialPlan) {
      setSelectedPlanForSub(normalizePlan(initialPlan));
    }
  }, [initialPlan, normalizePlan]);

  useEffect(() => {
    if (initialBillingCycle === "yearly" || initialBillingCycle === "monthly") {
      setSelectedCycleForSub(initialBillingCycle);
    }
  }, [initialBillingCycle]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await api<{ invoices?: BillingInvoiceItem[] }>("/api/billing/invoices");
      setInvoices(Array.isArray(res?.invoices) ? res.invoices : []);
    } catch {
      // Non-critical if invoices haven't been created yet
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices, subscription?.organization_id]);

  // Merge authoritative backend plan catalog with canonical defaults
  const resolvedTiers = useMemo<ResolvedTierCard[]>(() => {
    if (!plans || plans.length === 0) return CANONICAL_TIERS;
    return CANONICAL_TIERS.map((base) => {
      const match = plans.find((p) => String(p.code || "").toLowerCase() === base.code);
      if (!match) return base;
      const promoUzs = match.price_promo_uzs ? Math.round(match.price_promo_uzs / 100) : base.promoUzs;
      const monthlyUzs = match.price_monthly_uzs ? Math.round(match.price_monthly_uzs / 100) : base.monthlyUzs;
      const yearlyUzs = match.price_yearly_uzs ? Math.round(match.price_yearly_uzs / 100) : base.yearlyUzs;
      return {
        ...base,
        name: match.name || base.name,
        promoUzs,
        monthlyUzs,
        yearlyUzs,
        isPopular: Boolean(match.is_featured ?? base.isPopular),
      };
    });
  }, [plans]);

  const selectedTier = useMemo(
    () => resolvedTiers.find((t) => t.code === selectedPlanForSub) || resolvedTiers[1] || CANONICAL_TIERS[1],
    [resolvedTiers, selectedPlanForSub]
  );

  if (!subscription && loading) {
    return (
      <div className="d-flex flex-column gap-3">
        <div className="linear-card p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <Skeleton width={180} height={22} />
            <Skeleton width={100} height={24} borderRadius={9999} />
          </div>
          <Skeleton width="65%" height={14} className="mb-2" />
          <Skeleton width="40%" height={14} />
        </div>
        <div className="row g-3">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="col-12 col-md-4">
              <div className="linear-card p-4 space-y-3">
                <Skeleton width={90} height={18} />
                <Skeleton width={150} height={28} />
                <Skeleton width="100%" height={12} />
                <Skeleton width="80%" height={12} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isMegaDiscountActive = subscription?.status === "mega_discount_active";
  const isMegaDiscountExpired = subscription?.status === "mega_discount_expired";
  const isSubscriptionActive = subscription?.status === "subscription_active";
  const isCancelled = subscription?.status === "cancelled";
  const isExpired = subscription?.status === "subscription_expired";
  const isRenewalPendingCancel = Boolean(subscription?.cancel_at_period_end || isCancelled);

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

  const handleStartMegaDiscount = async (planCode: string) => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const data = await api<any>("/api/billing/mega-discount/checkout", {
        method: "POST",
        body: JSON.stringify({ plan_code: normalizePlan(planCode), return_url: window.location.href }),
      });
      await loadInvoices();
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setCheckoutError("To'lov havolasi olinmadi. Iltimos qayta urinib ko'ring.");
      }
    } catch (err: any) {
      setCheckoutError(err?.message || "To'lov hisobini yaratishda xatolik yuz berdi");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleStartSubscription = async () => {
    if (!renewalConsentChecked) {
      setCheckoutError("Iltimos, avtomatik yangilanish shartlari va obuna shartnomasi bilan tanishib, rozilik bildiring.");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const agreedAmountUzs = selectedCycleForSub === "yearly" ? selectedTier.yearlyUzs : selectedTier.monthlyUzs;

      // 1. Record explicit user consent through authenticated proxy
      await api("/api/billing/subscription/consent", {
        method: "POST",
        body: JSON.stringify({
          billing_cycle: selectedCycleForSub,
          agreed_amount: Math.round(agreedAmountUzs * 100),
          accepted_terms_version: "v1.0",
        }),
      });

      // 2. Create subscription checkout through authenticated proxy
      const data = await api<any>("/api/billing/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan_code: selectedTier.code,
          billing_cycle: selectedCycleForSub,
          return_url: window.location.href,
        }),
      });
      await loadInvoices();
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setCheckoutError("TezCheck to'lov havolasi olinmadi.");
      }
    } catch (err: any) {
      setCheckoutError(err?.message || "To'lov hisobini yaratishda xatolik yuz berdi");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCancelClick = async () => {
    setActionBusy(true);
    setCheckoutError(null);
    try {
      await onCancelSubscription();
      setConfirmCancel(false);
    } catch (err: any) {
      setCheckoutError(err?.message || "Obunani bekor qilishda xatolik");
    } finally {
      setActionBusy(false);
    }
  };

  const handleResumeClick = async () => {
    setActionBusy(true);
    setCheckoutError(null);
    try {
      await onResumeSubscription();
    } catch (err: any) {
      setCheckoutError(err?.message || "Obunani qayta tiklashda xatolik");
    } finally {
      setActionBusy(false);
    }
  };

  const selectedAmountLabel =
    selectedCycleForSub === "yearly"
      ? `${formatWholeUzs(selectedTier.yearlyUzs)} (${selectedTier.yearlyUsdLabel})`
      : `${formatWholeUzs(selectedTier.monthlyUzs)} (${selectedTier.monthlyUsdLabel})`;

  return (
    <div className="space-y-4">
      {/* Checkout Error Notification */}
      {checkoutError && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 rounded-3 shadow-sm" role="alert">
          <div className="d-flex align-items-center gap-2.5">
            <IconAlertCircle size={22} className="text-danger flex-shrink-0" />
            <div className="text-danger fw-medium small">{checkoutError}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setCheckoutError(null)} aria-label="Yopish" />
        </div>
      )}

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

      {/* 2. Mega Discount Expired Banner */}
      {isMegaDiscountExpired && (
        <div
          className="alert alert-warning d-flex align-items-center justify-content-between p-3.5 rounded-3 shadow-sm"
          role="alert"
          style={{ background: "rgba(245, 159, 0, 0.12)", border: "1px solid rgba(245, 159, 0, 0.35)" }}
        >
          <div className="d-flex align-items-center gap-3">
            <IconAlertCircle size={30} className="text-warning flex-shrink-0" />
            <div>
              <h4 className="alert-title text-warning mb-1 fw-bold fs-4">MEGA CHEGIRMA MUDDATI YAKUNLANDI</h4>
              <div className="text-primary small fw-medium">
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
            onClick={() => document.getElementById("subscription-selection-section")?.scrollIntoView({ behavior: "smooth" })}
          >
            <IconSparkles size={16} />
            <span>Obunani tanlash</span>
          </button>
        </div>
      )}

      {/* 3. Subscription Expired Notice */}
      {isExpired && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between p-3.5 rounded-3 shadow-sm" role="alert">
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
            onClick={() => document.getElementById("subscription-selection-section")?.scrollIntoView({ behavior: "smooth" })}
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
              {resolvedTiers.map((tier) => (
                <div key={`promo-${tier.code}`} className="col-md-4">
                  <div
                    className={`p-3.5 rounded border h-100 d-flex flex-column justify-content-between position-relative ${
                      tier.isPopular
                        ? "border-success border-opacity-50 shadow-sm"
                        : "border-secondary border-opacity-20"
                    }`}
                    style={{ backgroundColor: "var(--bg-surface-elevated)" }}
                  >
                    {tier.isPopular && (
                      <span className="badge bg-success position-absolute top-0 end-0 m-2">Eng Tavsiya Etilgan</span>
                    )}
                    <div>
                      <div className="badge bg-primary-lt text-primary mb-2">{tier.name} TARIF</div>
                      <div className="fs-2 fw-bold text-primary font-monospace">
                        {tier.promoUsdLabel}{" "}
                        <span className="fs-6 fw-normal text-secondary">({formatWholeUzs(tier.promoUzs)})</span>
                      </div>
                      <div className="text-secondary small mb-3">7 kunlik to'liq kirish huquqi</div>
                      <ul className="list-unstyled small space-y-1.5 text-secondary">
                        {tier.promoHighlights.map((item, idx) => (
                          <li key={idx}>
                            <IconCheck size={14} className="text-success me-1" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm w-100 mt-3 ${tier.isPopular ? "btn-success fw-bold" : "btn-outline-primary"}`}
                      disabled={checkoutLoading}
                      onClick={() => handleStartMegaDiscount(tier.code)}
                    >
                      {tier.name} {tier.promoUsdLabel} Boshlash
                    </button>
                  </div>
                </div>
              ))}
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
                  ? isRenewalPendingCancel
                    ? "Bekor qilinish jarayonida"
                    : "Faol Obuna"
                  : isMegaDiscountActive
                  ? "Mega Chegirma (7 kun)"
                  : isMegaDiscountExpired
                  ? "Mega Chegirma Yakunlangan"
                  : isCancelled
                  ? "Bekor Qilingan"
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
                    <div className="fw-semibold text-primary small">{formatDate(subscription?.current_period_start)}</div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="p-3 rounded bg-body-tertiary border border-secondary border-opacity-10">
                    <div className="text-secondary small mb-1">Amal qilish muddati (Tugash sanasi)</div>
                    <div className="fw-semibold text-primary small">{formatDate(subscription?.current_period_end)}</div>
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary d-flex align-items-center gap-1.5"
                  onClick={() => {
                    onRefresh();
                    void loadInvoices();
                  }}
                  disabled={loading || invoicesLoading}
                >
                  <IconRefresh size={15} className={loading || invoicesLoading ? "spin" : ""} />
                  <span>Ma'lumotlarni Yangilash</span>
                </button>

                {isRenewalPendingCancel ? (
                  <button
                    type="button"
                    className="btn btn-outline-success"
                    disabled={actionBusy}
                    onClick={handleResumeClick}
                  >
                    Obunani Qayta Tiklash
                  </button>
                ) : isSubscriptionActive ? (
                  confirmCancel ? (
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={actionBusy}
                        onClick={handleCancelClick}
                      >
                        Ha, bekor qilinsin
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        disabled={actionBusy}
                        onClick={() => setConfirmCancel(false)}
                      >
                        Yo'q
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={actionBusy}
                      onClick={() => setConfirmCancel(true)}
                    >
                      Obunani Bekor Qilish
                    </button>
                  )
                ) : null}
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
        <div className="card-header py-3 px-4 d-flex flex-wrap align-items-center justify-content-between gap-2">
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
            {resolvedTiers.map((tier) => {
              const isSelected = selectedPlanForSub === tier.code;
              const uzsPrice = selectedCycleForSub === "yearly" ? tier.yearlyUzs : tier.monthlyUzs;
              const usdPriceLabel = selectedCycleForSub === "yearly" ? tier.yearlyUsdLabel : tier.monthlyUsdLabel;

              return (
                <div key={tier.code} className="col-md-4">
                  <div
                    className={`p-3.5 rounded border cursor-pointer h-100 position-relative ${
                      isSelected
                        ? tier.isPopular
                          ? "border-success bg-green-lt shadow-sm"
                          : "border-primary bg-primary-lt shadow-sm"
                        : "border-secondary border-opacity-20"
                    }`}
                    onClick={() => setSelectedPlanForSub(tier.code)}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-bold fs-4">{tier.name}</span>
                      <div className="d-flex align-items-center gap-1.5">
                        {tier.isPopular && <span className="badge bg-success text-white">Eng Ommabop</span>}
                        {isSelected && <IconCheck size={20} className={tier.isPopular ? "text-success" : "text-primary"} />}
                      </div>
                    </div>
                    <div className={`fs-2 fw-bold font-monospace mb-1 ${tier.isPopular ? "text-success" : "text-primary"}`}>
                      {formatWholeUzs(uzsPrice)}
                    </div>
                    <div className="text-secondary small mb-3">{usdPriceLabel}</div>
                    <ul className="list-unstyled small space-y-1 text-secondary">
                      {tier.subHighlights.map((hl, idx) => (
                        <li key={idx}>{hl}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 7. Explicit User Consent Box (NEVER PRECHECKED) */}
          <div className="p-3.5 rounded bg-body-tertiary border border-secondary border-opacity-20 mb-4">
            <h4 className="fw-bold mb-2">Avtomatik Yangilanish va Obuna Shartlari</h4>
            <div className="text-secondary small mb-3">
              <p className="mb-1">
                <strong>Reja:</strong> {selectedTier.name} ({selectedCycleForSub === "yearly" ? "Yillik: 365 kun" : "Oylik: 30 kun"}).
              </p>
              <p className="mb-1">
                <strong>To'lov miqdori:</strong> {selectedAmountLabel}
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
              <label className="form-check-label fw-semibold small" htmlFor="renewalConsentCheckbox">
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
              <span>{checkoutLoading ? "Hisob yaratilmoqda..." : "TezCheck Orqali To'lovga O'tish"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 8. Billing Invoices History */}
      <div className="card shadow-sm border border-secondary border-opacity-15">
        <div className="card-header py-3 px-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <IconReceipt size={18} className="text-primary" />
            <h3 className="card-title fw-bold mb-0">To'lov Hisob-Fakturalari ({invoices.length})</h3>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            onClick={() => void loadInvoices()}
            disabled={invoicesLoading}
          >
            <IconRefresh size={14} className={invoicesLoading ? "spin" : ""} />
            <span>Yangilash</span>
          </button>
        </div>
        <div className="card-body p-0">
          {invoices.length === 0 ? (
            <div className="p-4 text-center text-secondary small">
              Hozircha to'lov hisob-fakturalari mavjud emas.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="linear-table mb-0">
                <thead>
                  <tr>
                    <th>Hisob ID</th>
                    <th>Tarif</th>
                    <th>Sikl</th>
                    <th>Summa</th>
                    <th>Holat</th>
                    <th>Sana</th>
                    <th style={{ textAlign: "right" }}>Havola</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const st = String(inv.status || "pending").toLowerCase();
                    const uzsVal = inv.amount_uzs ?? Math.round((inv.amount || 0) / 100);
                    return (
                      <tr key={inv.bill_id || inv.id}>
                        <td className="font-monospace small text-secondary">{inv.bill_id || inv.id}</td>
                        <td className="fw-semibold small">{(inv.plan_code || "-").toUpperCase()}</td>
                        <td className="small text-secondary">
                          {inv.billing_cycle === "yearly"
                            ? "Yillik"
                            : inv.billing_cycle === "mega_discount"
                            ? "7 kunlik Chegirma"
                            : "Oylik"}
                        </td>
                        <td className="font-monospace fw-semibold small">{formatWholeUzs(uzsVal)}</td>
                        <td>
                          <span
                            className={`badge ${
                              st === "paid" || st === "completed"
                                ? "bg-green-lt text-green"
                                : st === "expired" || st === "failed"
                                ? "bg-danger-lt text-danger"
                                : "bg-warning-lt text-warning"
                            }`}
                          >
                            {st === "paid" || st === "completed" ? "To'langan" : st === "expired" ? "Muddati o'tgan" : "Kutilmoqda"}
                          </span>
                        </td>
                        <td className="small text-secondary">{formatDate(inv.paid_at || inv.created_at)}</td>
                        <td style={{ textAlign: "right" }}>
                          {inv.checkout_url && st !== "paid" && st !== "completed" ? (
                            <a
                              href={inv.checkout_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-xs btn-primary d-inline-flex align-items-center gap-1"
                            >
                              <span>To'lash</span>
                              <IconExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-secondary small">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
