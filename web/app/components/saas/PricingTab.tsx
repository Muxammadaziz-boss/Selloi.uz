"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconCrown,
  IconGift,
  IconHelpCircle,
  IconInfoCircle,
  IconRefresh,
  IconSparkles,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import { getCheckoutQuote, CheckoutQuoteResponse } from "../../lib/api";

interface PlanItem {
  id: number;
  code: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  is_featured: boolean;
  features: Record<string, any>;
  limits: Record<string, any>;
}

interface PricingTabProps {
  plans: PlanItem[];
  currentPlanCode?: string;
  onSelectPlan: (planCode: string, billingCycle: "monthly" | "yearly") => Promise<void>;
  loading?: boolean;
}

export function PricingTab({
  plans,
  currentPlanCode = "pro",
  onSelectPlan,
  loading = false,
}: PricingTabProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [currency, setCurrency] = useState<"USD" | "UZS">("USD");
  const [busyPlanCode, setBusyPlanCode] = useState<string | null>(null);

  // Authenticated quotes state
  const [quotes, setQuotes] = useState<Record<string, CheckoutQuoteResponse>>({});
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(true);
  const [quoteError, setQuoteError] = useState<string>("");

  const loadQuotes = useCallback(async () => {
    if (!plans || plans.length === 0) return;
    setLoadingQuotes(true);
    setQuoteError("");
    try {
      const results: Record<string, CheckoutQuoteResponse> = {};
      await Promise.all(
        plans.map(async (p) => {
          try {
            const quote = await getCheckoutQuote(p.code, billingCycle, currency);
            results[p.code.toLowerCase()] = quote;
          } catch (err: any) {
            // Plan might be restricted or require specific offer
          }
        })
      );
      setQuotes(results);
    } catch (err: any) {
      setQuoteError("Mijoz uchun shaxsiy narxlarni yuklashda xatolik");
    } finally {
      setLoadingQuotes(false);
    }
  }, [plans, billingCycle, currency]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const handleChoose = async (planCode: string) => {
    setBusyPlanCode(planCode);
    try {
      await onSelectPlan(planCode, billingCycle);
    } finally {
      setBusyPlanCode(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Title & Controls */}
      <div className="text-center max-w-xl mx-auto pt-2 pb-3">
        <span className="badge bg-primary-lt text-primary fw-bold text-uppercase px-3 py-1.5 mb-2">
          Moslashuvchan SaaS Tariflar
        </span>
        <h2 className="fs-1 fw-bold text-primary mb-2">Biznesingiz Ko'lamiga Mos Rejani Tanlang</h2>
        <p className="text-secondary small mb-4">
          Barcha tariflarda xavfsiz multi-tenant ma'lumotlar izolyatsiyasi, Telegram Business ulanishi va sun'iy intellekt integratsiyasi mavjud.
        </p>

        {/* Switchers Row: Billing Cycle & Currency Switcher */}
        <div className="d-flex flex-wrap align-items-center justify-content-center gap-3">
          {/* Monthly / Yearly Toggle */}
          <div
            className="d-inline-flex align-items-center p-1.5 rounded-pill border border-secondary border-opacity-20 shadow-sm"
            style={{ backgroundColor: "var(--bg-surface-elevated)" }}
          >
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-4 py-2 border-0 fw-bold transition-all ${
                billingCycle === "monthly" ? "btn-primary shadow" : "text-primary"
              }`}
              style={{ backgroundColor: billingCycle === "monthly" ? undefined : "transparent" }}
              onClick={() => setBillingCycle("monthly")}
            >
              Oylik To'lov
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-4 py-2 border-0 fw-bold transition-all d-flex align-items-center gap-1.5 ${
                billingCycle === "yearly" ? "btn-primary shadow" : "text-primary"
              }`}
              style={{ backgroundColor: billingCycle === "yearly" ? undefined : "transparent" }}
              onClick={() => setBillingCycle("yearly")}
            >
              <span>Yillik To'lov</span>
              <span className="badge linear-badge-success fw-bold" style={{ fontSize: "10px" }}>
                17% TEJASH
              </span>
            </button>
          </div>

          {/* Currency Toggle */}
          <div
            className="d-inline-flex align-items-center p-1 rounded-pill border border-secondary border-opacity-20"
            style={{ backgroundColor: "var(--bg-surface-elevated)" }}
          >
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 border-0 fw-bold transition-all ${
                currency === "USD" ? "btn-secondary text-primary" : "text-secondary"
              }`}
              onClick={() => setCurrency("USD")}
            >
              USD ($)
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 border-0 fw-bold transition-all ${
                currency === "UZS" ? "btn-secondary text-primary" : "text-secondary"
              }`}
              onClick={() => setCurrency("UZS")}
            >
              UZS (so'm)
            </button>
          </div>
        </div>
      </div>

      {quoteError && (
        <div className="alert alert-warning py-2 px-3 small text-center max-w-lg mx-auto">
          {quoteError}
        </div>
      )}

      {/* 3 Pricing Cards Grid */}
      <div className="row g-3 align-items-stretch justify-content-center">
        {plans.map((p) => {
          const isCurrent = currentPlanCode.toLowerCase() === p.code.toLowerCase();
          const quote = quotes[p.code.toLowerCase()]?.quote;
          const isFeatured = p.is_featured || p.code === "pro";
          const hasDiscount = Boolean(quote?.discount_applied);

          // Pricing values
          let effectivePriceFormatted = quote?.effective_price_formatted;
          let catalogPriceFormatted = quote?.catalog_base_price_formatted;

          if (!effectivePriceFormatted) {
            if (currency === "USD") {
              effectivePriceFormatted =
                billingCycle === "yearly"
                  ? `$${p.price_yearly}`
                  : `$${p.price_monthly}`;
            } else {
              effectivePriceFormatted =
                billingCycle === "yearly"
                  ? `${((p.price_yearly * 12800) || 2450000).toLocaleString("uz-UZ")} so'm`
                  : `${((p.price_monthly * 12800) || 245000).toLocaleString("uz-UZ")} so'm`;
            }
          }

          return (
            <div key={p.code} className="col-md-6 col-lg-4 d-flex">
              <div
                className={`card w-100 shadow-sm d-flex flex-column justify-content-between position-relative ${
                  hasDiscount
                    ? "border-success shadow-md"
                    : isFeatured
                    ? "border-primary shadow-lg"
                    : "border-secondary border-opacity-20"
                }`}
                style={{
                  borderRadius: 16,
                  background: hasDiscount
                    ? "rgba(16, 185, 129, 0.05)"
                    : isFeatured
                    ? "rgba(32, 107, 196, 0.05)"
                    : "inherit",
                  transform: isFeatured || hasDiscount ? "scale(1.02)" : "none",
                  zIndex: isFeatured || hasDiscount ? 2 : 1,
                }}
              >
                {/* Special Customer Discount Ribbon */}
                {hasDiscount && (
                  <div className="position-absolute top-0 start-50 translate-middle">
                    <span className="badge bg-success text-white fw-bold px-3 py-1.5 rounded-pill shadow d-flex align-items-center gap-1">
                      <IconGift size={14} /> SIZ UCHUN MAXSUS TAKLIF
                    </span>
                  </div>
                )}

                {/* Most Popular Badge (if no custom discount) */}
                {!hasDiscount && isFeatured && (
                  <div className="position-absolute top-0 start-50 translate-middle">
                    <span className="badge linear-badge-accent fw-bold px-3 py-1.5 rounded-pill shadow d-flex align-items-center gap-1">
                      <IconCrown size={14} /> ENG OMMABOP REJA
                    </span>
                  </div>
                )}

                <div className="card-body p-4">
                  {/* Plan Name & Tagline */}
                  <div className="mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <h3 className="card-title fw-bold fs-2 text-primary mb-0 font-monospace">
                        {p.name}
                      </h3>
                      {isCurrent && (
                        <span className="badge bg-green-lt text-green fw-bold">Joriy Reja</span>
                      )}
                    </div>
                    <p className="text-secondary small mb-0" style={{ minHeight: "38px" }}>
                      {p.description}
                    </p>
                  </div>

                  {/* Pricing Display */}
                  <div className="py-3 my-2 border-top border-bottom border-secondary border-opacity-10">
                    {loadingQuotes ? (
                      <div
                        className="skeleton-shimmer mb-2"
                        style={{ width: "120px", height: "32px", borderRadius: "6px" }}
                      />
                    ) : hasDiscount ? (
                      <div>
                        <div className="d-flex align-items-baseline gap-2">
                          <span className="fs-1 fw-bold text-success font-monospace">
                            {effectivePriceFormatted}
                          </span>
                          <span className="text-secondary small">
                            / {billingCycle === "yearly" ? "yil" : "oy"}
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <span
                            className="text-secondary small text-decoration-line-through font-monospace"
                            style={{ fontSize: "0.82rem" }}
                          >
                            Katalog narxi: {catalogPriceFormatted}
                          </span>
                          <span className="badge bg-success-lt text-success fw-bold" style={{ fontSize: "10px" }}>
                            Tejov: {quote?.discount_amount_formatted}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="d-flex align-items-baseline gap-1">
                          <span className="fs-1 fw-bold text-primary font-monospace">
                            {effectivePriceFormatted}
                          </span>
                          <span className="text-secondary small">
                            / {billingCycle === "yearly" ? "yil" : "oy"}
                          </span>
                        </div>
                        {billingCycle === "yearly" && (
                          <div className="text-secondary small mt-0.5">
                            Yillik to'lov bilan 17% tejash
                          </div>
                        )}
                      </div>
                    )}

                    {/* Renewal Policy Note (Platform Owner Decision 2: Option A) */}
                    {hasDiscount && quote?.renewal_policy && (
                      <div className="mt-2.5 p-2 rounded-2 bg-dark bg-opacity-25 text-secondary small" style={{ fontSize: "0.74rem" }}>
                        <div className="d-flex align-items-center gap-1.5 fw-medium text-warning mb-0.5">
                          <IconInfoCircle size={13} />
                          <span>Yangilanish sharti:</span>
                        </div>
                        <span>{quote.renewal_policy.explanation}</span>
                      </div>
                    )}
                  </div>

                  {/* Core Limits Highlights */}
                  <div className="py-2 mb-3">
                    <div
                      className="text-secondary small fw-bold text-uppercase mb-2"
                      style={{ fontSize: "11px" }}
                    >
                      Resurs Limitlari
                    </div>
                    <ul className="list-unstyled space-y-1.5 mb-0 small">
                      <li className="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                        <span className="text-secondary">AI Xabarlar</span>
                        <span className="fw-bold text-primary">
                          {p.limits?.ai_messages?.toLocaleString() || "1,000"} / oy
                        </span>
                      </li>
                      <li className="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                        <span className="text-secondary">Faol Suhbatlar</span>
                        <span className="fw-bold text-primary">
                          {p.limits?.ai_conversations?.toLocaleString() || "500"} / oy
                        </span>
                      </li>
                      <li className="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                        <span className="text-secondary">Telegram Ulanish</span>
                        <span className="fw-bold text-primary">
                          {p.limits?.telegram_connections || 1} ta akkaunt
                        </span>
                      </li>
                      <li className="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                        <span className="text-secondary">Telegram Kanallar</span>
                        <span className="fw-bold text-primary">
                          {p.limits?.telegram_channels || 1} ta
                        </span>
                      </li>
                      <li className="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                        <span className="text-secondary">Katalog Mahsulotlari</span>
                        <span className="fw-bold text-primary">
                          {p.limits?.products?.toLocaleString() || "500"} ta
                        </span>
                      </li>
                      <li className="d-flex align-items-center justify-content-between py-1">
                        <span className="text-secondary">Jamoa Operatorlari</span>
                        <span className="fw-bold text-primary">
                          {p.limits?.team_members || 2} kishi
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Feature Checklist */}
                  <div>
                    <div
                      className="text-secondary small fw-bold text-uppercase mb-2"
                      style={{ fontSize: "11px" }}
                    >
                      Qo'shilgan Imkoniyatlar
                    </div>
                    <ul className="list-unstyled space-y-2 mb-0 small">
                      <li className="d-flex align-items-center gap-2">
                        <IconCheck size={16} className="text-success flex-shrink-0" />
                        <span className="text-primary">Jonli Suhbatlar va Takeover</span>
                      </li>
                      <li className="d-flex align-items-center gap-2">
                        <IconCheck size={16} className="text-success flex-shrink-0" />
                        <span className="text-primary">Telegram Mahsulotlar Bazasi</span>
                      </li>
                      <li className="d-flex align-items-center gap-2">
                        <IconCheck size={16} className="text-success flex-shrink-0" />
                        <span className="text-primary">Avtomatik Buyurtma Rasmiylashtirish</span>
                      </li>
                      <li className="d-flex align-items-center gap-2">
                        {p.features?.advanced_rag ? (
                          <IconCheck size={16} className="text-success flex-shrink-0" />
                        ) : (
                          <IconX size={16} className="text-secondary flex-shrink-0 opacity-40" />
                        )}
                        <span
                          className={
                            p.features?.advanced_rag
                              ? "text-primary"
                              : "text-secondary text-decoration-line-through"
                          }
                        >
                          Kengaytirilgan RAG (Vektor Qidiruv)
                        </span>
                      </li>
                      <li className="d-flex align-items-center gap-2">
                        {p.features?.ai_image_understanding ? (
                          <IconCheck size={16} className="text-success flex-shrink-0" />
                        ) : (
                          <IconX size={16} className="text-secondary flex-shrink-0 opacity-40" />
                        )}
                        <span
                          className={
                            p.features?.ai_image_understanding
                              ? "text-primary"
                              : "text-secondary text-decoration-line-through"
                          }
                        >
                          Rasm va Skrinshotlarni Tahlil Qilish (Vision)
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Card CTA Button */}
                <div className="card-footer bg-transparent p-4 pt-0 border-0">
                  <button
                    type="button"
                    className={`btn w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-1.5 ${
                      isCurrent
                        ? "btn-outline-success disabled"
                        : hasDiscount
                        ? "btn-success text-white shadow"
                        : isFeatured
                        ? "btn-primary shadow"
                        : "btn-outline-primary"
                    }`}
                    disabled={isCurrent || busyPlanCode === p.code || loading}
                    onClick={() => handleChoose(p.code)}
                  >
                    {busyPlanCode === p.code ? (
                      <span className="spinner-border spinner-border-sm" role="status" />
                    ) : isCurrent ? (
                      <>
                        <IconCheck size={16} />
                        <span>Joriy Rejangiz</span>
                      </>
                    ) : hasDiscount ? (
                      <>
                        <span>Maxsus Narxda Faollashtirish</span>
                        <IconArrowRight size={16} />
                      </>
                    ) : (
                      <>
                        <span>
                          {p.code === "start"
                            ? "START Rejasiga O'tish"
                            : p.code === "ultra"
                            ? "ULTRA Rejasiga O'tish"
                            : "PRO Rejasiga O'tish"}
                        </span>
                        <IconArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enterprise / Custom Requirement Footnote */}
      <div className="text-center p-4 bg-body-tertiary rounded-3 border border-secondary border-opacity-10 mt-4">
        <h4 className="fw-bold text-primary mb-1">Maxsus talablar yoki yirik korporativ integratsiyalar bormi?</h4>
        <p className="text-secondary small mb-3">
          Cheksiz kanallar, maxsus ERP/CRM integratsiyalari va lokal serverda o'rnatish uchun bevosita biz bilan bog'laning.
        </p>
        <a
          href="https://t.me/Dr4x1l"
          target="_blank"
          rel="noreferrer"
          className="btn btn-sm btn-outline-secondary px-3"
        >
          Telegram orqali bog'lanish (@Dr4x1l)
        </a>
      </div>
    </div>
  );
}
