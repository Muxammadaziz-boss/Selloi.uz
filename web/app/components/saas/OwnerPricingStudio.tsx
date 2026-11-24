"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  IconActivity,
  IconAlertCircle,
  IconArrowRight,
  IconBuildingSkyscraper,
  IconCheck,
  IconClock,
  IconCoin,
  IconCrown,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFilter,
  IconHistory,
  IconInfoCircle,
  IconLayersLinked,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldLock,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { fetchApi } from "../../lib/api";

export interface OwnerPlan {
  id: number;
  code: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  price_monthly_uzs: number;
  price_yearly_uzs: number;
  price_promo_uzs?: number;
  price_version?: number;
  price_monthly_formatted: string;
  price_yearly_formatted: string;
  price_monthly_uzs_formatted: string;
  price_yearly_uzs_formatted: string;
  price_promo_uzs_formatted?: string;
  currency: string;
  is_active: boolean;
  is_public: boolean;
  is_featured: boolean;
  display_order: number;
  features: Record<string, any>;
  limits: Record<string, any>;
  active_subscribers: number;
  active_offers_count: number;
}

export interface CustomerOffer {
  id: number;
  customer_id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  billing_interval: string;
  currency: string;
  discount_type: string;
  discount_value: number;
  discount_formatted: string;
  starts_at: string;
  expires_at: string;
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface PriceHistoryEntry {
  id: number;
  plan_id: number;
  plan_code: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  price_monthly_uzs: number;
  price_yearly_uzs: number;
  currency: string;
  change_reason: string;
  effective_from: string | null;
  created_at: string | null;
}

export interface PricingAuditEntry {
  id: number;
  action: string;
  resource: string;
  resource_id: string | null;
  organization_id: number | null;
  metadata: Record<string, any>;
  created_at: string | null;
}

export interface OwnerPricingStudioProps {
  organizations: Array<{ id: number; name: string; slug: string }>;
  onRefreshParent?: () => void;
}

export function OwnerPricingStudio({
  organizations,
  onRefreshParent,
}: OwnerPricingStudioProps) {
  const [activeSection, setActiveSection] = useState<
    "plans" | "offers" | "history" | "simulator"
  >("plans");

  // Global Plans state
  const [plans, setPlans] = useState<OwnerPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [editingPlan, setEditingPlan] = useState<OwnerPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Edit Plan Form fields
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriceMUsd, setEditPriceMUsd] = useState<number>(0);
  const [editPriceYUsd, setEditPriceYUsd] = useState<number>(0);
  const [editPriceMUzs, setEditPriceMUzs] = useState<number>(0);
  const [editPriceYUzs, setEditPriceYUzs] = useState<number>(0);
  const [editPricePromoUzs, setEditPricePromoUzs] = useState<number>(1300000);
  const [editDisplayOrder, setEditDisplayOrder] = useState<number>(1);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsFeatured, setEditIsFeatured] = useState(false);
  const [editChangeReason, setEditChangeReason] = useState("");

  // Central Bank of Uzbekistan (CBU) Reference Rate state
  const [cbuReference, setCbuReference] = useState<{
    currency: string;
    rate: number;
    rate_uzs_formatted: string;
    rate_date: string;
    source: string;
    is_stale: boolean;
    policy_notice: string;
  } | null>(null);
  const [loadingCbu, setLoadingCbu] = useState(false);

  // Schedule Price Change state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulePlanCode, setSchedulePlanCode] = useState("start");
  const [schedulePeriod, setSchedulePeriod] = useState<"MEGA_DISCOUNT_7D" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [scheduleNewPriceUzs, setScheduleNewPriceUzs] = useState<number>(244000);
  const [scheduleEffectiveAt, setScheduleEffectiveAt] = useState<string>("");
  const [scheduleReason, setScheduleReason] = useState("");
  const [schedulingPrice, setSchedulingPrice] = useState(false);

  // Create Plan Form state
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newPlanPriceMUsd, setNewPlanPriceMUsd] = useState<number>(19);
  const [newPlanPriceYUsd, setNewPlanPriceYUsd] = useState<number>(190);
  const [newPlanPriceMUzs, setNewPlanPriceMUzs] = useState<number>(24500000);
  const [newPlanPriceYUzs, setNewPlanPriceYUzs] = useState<number>(245000000);
  const [newPlanDisplayOrder, setNewPlanDisplayOrder] = useState<number>(1);
  const [newPlanIsPublic, setNewPlanIsPublic] = useState(true);
  const [newPlanIsFeatured, setNewPlanIsFeatured] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);

  // Customer Offers state
  const [selectedCustomerOrgId, setSelectedCustomerOrgId] = useState<number>(
    organizations[0]?.id || 1
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOffers, setCustomerOffers] = useState<CustomerOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersError, setOffersError] = useState("");
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false);

  // Create Offer Form fields
  const [offerPlanCode, setOfferPlanCode] = useState("pro");
  const [offerBillingInterval, setOfferBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [offerCurrency, setOfferCurrency] = useState<"USD" | "UZS">("USD");
  const [offerDiscountType, setOfferDiscountType] = useState<
    "percentage" | "fixed_amount" | "custom_price"
  >("percentage");
  const [offerDiscountValue, setOfferDiscountValue] = useState<number>(20);
  const [offerStartsAt, setOfferStartsAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [offerExpiresAt, setOfferExpiresAt] = useState<string>(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [offerNotes, setOfferNotes] = useState("");
  const [offerSupersede, setOfferSupersede] = useState(true);
  const [creatingOffer, setCreatingOffer] = useState(false);

  // History & Audit state
  const [historyList, setHistoryList] = useState<PriceHistoryEntry[]>([]);
  const [auditList, setAuditList] = useState<PricingAuditEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Simulator state
  const [simOrgId, setSimOrgId] = useState<number>(organizations[0]?.id || 1);
  const [simPlanCode, setSimPlanCode] = useState("pro");
  const [simInterval, setSimInterval] = useState<"monthly" | "yearly">("monthly");
  const [simCurrency, setSimCurrency] = useState<"USD" | "UZS">("USD");
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState("");

  // Notification message
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // 1. Load Global Plans
  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    setPlansError("");
    try {
      const data = await fetchApi<{ success: boolean; plans: OwnerPlan[] }>(
        "/api/platform/plans"
      );
      if (data && data.plans) {
        setPlans(data.plans);
      }
    } catch (err: any) {
      setPlansError(err.message || "Tariflar ro'yxatini yuklashda xatolik");
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  // 2. Load Customer Offers for selected organization
  const loadCustomerOffers = useCallback(async (orgId: number) => {
    if (!orgId) return;
    setLoadingOffers(true);
    setOffersError("");
    try {
      const data = await fetchApi<{ success: boolean; offers: CustomerOffer[] }>(
        `/api/platform/customers/${orgId}/pricing`
      );
      if (data && data.offers) {
        setCustomerOffers(data.offers);
      }
    } catch (err: any) {
      setOffersError(err.message || "Individual takliflarni yuklashda xatolik");
    } finally {
      setLoadingOffers(false);
    }
  }, []);

  // 3. Load History & Audit
  const loadHistoryAndAudit = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [histData, auditData] = await Promise.all([
        fetchApi<{ success: boolean; history: PriceHistoryEntry[] }>(
          "/api/platform/pricing/history"
        ),
        fetchApi<{ success: boolean; audit_logs: PricingAuditEntry[] }>(
          "/api/platform/pricing/audit-logs"
        ),
      ]);
      if (histData && histData.history) setHistoryList(histData.history);
      if (auditData && auditData.audit_logs) setAuditList(auditData.audit_logs);
    } catch (err: any) {
      showFeedback("error", err.message || "Tarix va audit ma'lumotlarini yuklashda xatolik");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load CBU Reference Rate
  const loadCbuReference = useCallback(async () => {
    setLoadingCbu(true);
    try {
      const data = await fetchApi<{
        success: boolean;
        cbu_reference: {
          currency: string;
          rate: number;
          rate_uzs_formatted: string;
          rate_date: string;
          source: string;
          is_stale: boolean;
          policy_notice: string;
        };
      }>("/api/platform/pricing/cbu-reference");
      if (data && data.cbu_reference) {
        setCbuReference(data.cbu_reference);
      }
    } catch {
      // Quiet failover
    } finally {
      setLoadingCbu(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
    loadCbuReference();
  }, [loadPlans, loadCbuReference]);

  useEffect(() => {
    if (activeSection === "offers" && selectedCustomerOrgId) {
      loadCustomerOffers(selectedCustomerOrgId);
    } else if (activeSection === "history") {
      loadHistoryAndAudit();
    }
  }, [activeSection, selectedCustomerOrgId, loadCustomerOffers, loadHistoryAndAudit]);

  // Open Edit Modal for a plan
  const handleStartEdit = (plan: OwnerPlan) => {
    setEditingPlan(plan);
    setEditName(plan.name);
    setEditDesc(plan.description);
    setEditPriceMUsd(plan.price_monthly);
    setEditPriceYUsd(plan.price_yearly);
    setEditPriceMUzs(plan.price_monthly_uzs);
    setEditPriceYUzs(plan.price_yearly_uzs);
    setEditPricePromoUzs(
      plan.price_promo_uzs ||
        (plan.code === "pro" ? 2600000 : plan.code === "ultra" ? 3900000 : 1300000)
    );
    setEditDisplayOrder(plan.display_order);
    setEditIsPublic(plan.is_public);
    setEditIsActive(plan.is_active);
    setEditIsFeatured(plan.is_featured);
    setEditChangeReason("");
  };

  // Submit Plan Edit
  const handleSavePlanEdit = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      await fetchApi(`/api/platform/plans/${editingPlan.code}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          price_monthly: Number(editPriceMUsd),
          price_yearly: Number(editPriceYUsd),
          price_monthly_uzs: Number(editPriceMUzs),
          price_yearly_uzs: Number(editPriceYUzs),
          price_promo_uzs: Number(editPricePromoUzs),
          display_order: Number(editDisplayOrder),
          is_public: editIsPublic,
          is_featured: editIsFeatured,
          change_reason: editChangeReason.trim() || "Owner pricing adjustment",
        }),
      });

      // Update active/public status if changed
      if (editingPlan.is_active !== editIsActive) {
        await fetchApi(`/api/platform/plans/${editingPlan.code}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            is_active: editIsActive,
            change_reason: editChangeReason.trim() || "Status toggle",
          }),
        });
      }

      showFeedback("success", `${editingPlan.name} tarifi narxlari va parametrlari saqlandi!`);
      setEditingPlan(null);
      await loadPlans();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showFeedback("error", err.message || "Tarifni saqlashda xatolik yuz berdi");
    } finally {
      setSavingPlan(false);
    }
  };

  // Submit New Plan Creation
  const handleCreateNewPlan = async () => {
    if (!newPlanCode.trim() || !newPlanName.trim()) {
      showFeedback("error", "Plan kodi va nomi to'ldirilishi shart");
      return;
    }
    setCreatingPlan(true);
    try {
      await fetchApi("/api/platform/plans", {
        method: "POST",
        body: JSON.stringify({
          code: newPlanCode.trim().toLowerCase(),
          name: newPlanName.trim(),
          description: newPlanDesc.trim(),
          price_monthly: Number(newPlanPriceMUsd),
          price_yearly: Number(newPlanPriceYUsd),
          price_monthly_uzs: Number(newPlanPriceMUzs),
          price_yearly_uzs: Number(newPlanPriceYUzs),
          currency: "USD",
          display_order: Number(newPlanDisplayOrder),
          is_public: newPlanIsPublic,
          is_featured: newPlanIsFeatured,
          features: {},
          limits: {},
        }),
      });
      showFeedback("success", `Yangi tarif "${newPlanName}" muvaffaqiyatli yaratildi!`);
      setShowCreatePlanModal(false);
      setNewPlanCode("");
      setNewPlanName("");
      setNewPlanDesc("");
      await loadPlans();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showFeedback("error", err.message || "Yangi tarif yaratishda xatolik");
    } finally {
      setCreatingPlan(false);
    }
  };

  // Submit Scheduled Price Change
  const handleSchedulePriceChange = async () => {
    if (!schedulePlanCode || !scheduleNewPriceUzs) return;
    setSchedulingPrice(true);
    try {
      await fetchApi("/api/platform/pricing/schedule", {
        method: "POST",
        body: JSON.stringify({
          plan_code: schedulePlanCode,
          billing_period: schedulePeriod,
          new_price_uzs: Number(scheduleNewPriceUzs),
          effective_at: scheduleEffectiveAt ? new Date(scheduleEffectiveAt).toISOString() : null,
          change_reason: scheduleReason.trim() || "Owner scheduled pricing adjustment",
        }),
      });
      showFeedback("success", `${schedulePlanCode.toUpperCase()} uchun yangi narx rejalashtirildi!`);
      setShowScheduleModal(false);
      setScheduleReason("");
      await loadPlans();
      if (activeSection === "history") await loadHistoryAndAudit();
    } catch (err: any) {
      showFeedback("error", err.message || "Narxni rejalashtirishda xatolik");
    } finally {
      setSchedulingPrice(false);
    }
  };

  // Submit New Customer Offer
  const handleCreateCustomerOffer = async () => {
    if (!selectedCustomerOrgId) {
      showFeedback("error", "Iltimos, avval do'konni tanlang");
      return;
    }
    setCreatingOffer(true);
    try {
      await fetchApi(`/api/platform/customers/${selectedCustomerOrgId}/pricing`, {
        method: "POST",
        body: JSON.stringify({
          plan_code: offerPlanCode,
          billing_interval: offerBillingInterval,
          currency: offerCurrency,
          discount_type: offerDiscountType,
          discount_value: Number(offerDiscountValue),
          starts_at: new Date(offerStartsAt).toISOString(),
          expires_at: new Date(offerExpiresAt + "T23:59:59Z").toISOString(),
          notes: offerNotes.trim() || undefined,
          supersede_existing: offerSupersede,
        }),
      });
      showFeedback("success", "Individual narx taklifi muvaffaqiyatli saqlandi!");
      setShowCreateOfferModal(false);
      setOfferNotes("");
      await loadCustomerOffers(selectedCustomerOrgId);
      await loadPlans();
    } catch (err: any) {
      showFeedback("error", err.message || "Individual taklif yaratishda xatolik");
    } finally {
      setCreatingOffer(false);
    }
  };

  // Revoke Customer Offer
  const handleRevokeOffer = async (offerId: number) => {
    if (!confirm("Ushbu individual taklifni bekor qilishga ishonchingiz komilmi?")) return;
    try {
      await fetchApi(
        `/api/platform/customers/${selectedCustomerOrgId}/pricing/${offerId}`,
        { method: "DELETE" }
      );
      showFeedback("success", "Individual taklif bekor qilindi (revoked)");
      await loadCustomerOffers(selectedCustomerOrgId);
      await loadPlans();
    } catch (err: any) {
      showFeedback("error", err.message || "Taklifni bekor qilishda xatolik");
    }
  };

  // Run Dry-Run Pricing Simulator
  const handleRunSimulator = async () => {
    setSimulating(true);
    setSimError("");
    setSimResult(null);
    try {
      const data = await fetchApi<{ success: boolean; simulation: any }>(
        "/api/platform/pricing/preview-resolution",
        {
          method: "POST",
          body: JSON.stringify({
            customer_id: Number(simOrgId),
            plan_code: simPlanCode,
            billing_interval: simInterval,
            currency: simCurrency,
          }),
        }
      );
      if (data && data.simulation) {
        setSimResult(data.simulation);
      }
    } catch (err: any) {
      setSimError(err.message || "Simulyatsiyada xatolik yuz berdi");
    } finally {
      setSimulating(false);
    }
  };

  // Filter organizations for customer dropdown
  const filteredOrgs = organizations.filter(
    (o) =>
      o.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      o.slug.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-3 d-flex align-items-center justify-content-between text-white ${
            feedback.type === "success" ? "bg-success" : "bg-danger"
          }`}
          style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}
        >
          <div className="d-flex align-items-center gap-2 small fw-medium">
            {feedback.type === "success" ? (
              <IconCheck size={18} />
            ) : (
              <IconAlertCircle size={18} />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            className="btn btn-link text-white p-0"
            onClick={() => setFeedback(null)}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* Pricing Studio Navigation Bar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold transition-all ${
              activeSection === "plans"
                ? "btn-primary shadow-sm"
                : "btn-outline-secondary text-primary"
            }`}
            onClick={() => setActiveSection("plans")}
          >
            <IconLayersLinked size={15} className="me-1.5" />
            Global Tariflar Katalogi
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold transition-all ${
              activeSection === "offers"
                ? "btn-primary shadow-sm"
                : "btn-outline-secondary text-primary"
            }`}
            onClick={() => setActiveSection("offers")}
          >
            <IconCrown size={15} className="me-1.5" />
            Mijoz Individual Chegirmalari
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold transition-all ${
              activeSection === "history"
                ? "btn-primary shadow-sm"
                : "btn-outline-secondary text-primary"
            }`}
            onClick={() => setActiveSection("history")}
          >
            <IconHistory size={15} className="me-1.5" />
            Narxlar Tarixi va Audit
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold transition-all ${
              activeSection === "simulator"
                ? "btn-primary shadow-sm"
                : "btn-outline-secondary text-primary"
            }`}
            onClick={() => setActiveSection("simulator")}
          >
            <IconPlayerPlay size={15} className="me-1.5" />
            Narx Simulyatori (Dry-Run)
          </button>
        </div>

        <div className="d-flex align-items-center gap-2">
          {activeSection === "plans" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<IconClock size={15} />}
                onClick={() => setShowScheduleModal(true)}
              >
                Narxni Rejalashtirish
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<IconPlus size={15} />}
                onClick={() => setShowCreatePlanModal(true)}
              >
                Yangi Tarif Yaratish
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<IconRefresh size={14} />}
            onClick={() => {
              if (activeSection === "plans") loadPlans();
              else if (activeSection === "offers") loadCustomerOffers(selectedCustomerOrgId);
              else if (activeSection === "history") loadHistoryAndAudit();
            }}
          >
            Yangilash
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: GLOBAL PLANS STUDIO */}
      {/* ==================================================================== */}
      {activeSection === "plans" && (
        <div className="space-y-4">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h3 className="fs-3 fw-bold text-primary mb-1">Global Tariflar Boshqaruvi</h3>
              <p className="text-secondary small mb-0">
                Ushbu bo'limda belgilangan narxlar public marketing sahifasi va mijoz dashboardi bilan avtomatik sinxronlashadi.
              </p>
            </div>
            <Badge variant="accent">{plans.length} ta tarif</Badge>
          </div>

          {/* Central Bank of Uzbekistan (CBU) Reference Rate Card */}
          <div className="p-3.5 rounded-3 border border-secondary border-opacity-25 bg-body-tertiary">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="p-2.5 rounded-2 bg-primary bg-opacity-10 text-primary">
                  <IconCoin size={24} />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold fs-4 text-primary">
                      1 USD = {cbuReference?.rate ? cbuReference.rate.toLocaleString("uz-UZ") : "12 900"} UZS
                    </span>
                    <Badge variant={cbuReference?.is_stale ? "warning" : "success"}>
                      {cbuReference?.is_stale ? "Kesh / Fallback" : "CBU Rasmiy Kursi"}
                    </Badge>
                    <span className="text-secondary small">({cbuReference?.rate_date || "Bugun"})</span>
                  </div>
                  <p className="text-secondary small mb-0 mt-0.5" style={{ maxWidth: "780px" }}>
                    {cbuReference?.policy_notice ||
                      "Faqat ichki moliyaviy tahlil uchun. Mijoz narxlariga va TezCheck to'lovlariga ta'sir qilmaydi (O'zbekiston ichki narxlari so'mda qat'iy belgilangan)."}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<IconRefresh size={14} />}
                loading={loadingCbu}
                onClick={loadCbuReference}
              >
                Kursni Yangilash
              </Button>
            </div>
          </div>

          {plansError && (
            <div className="p-3 rounded-3 bg-danger bg-opacity-10 text-danger small">
              {plansError}
            </div>
          )}

          {loadingPlans ? (
            <div className="row g-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="col-12 col-md-4">
                  <div className="linear-card p-4">
                    <div className="skeleton-shimmer skeleton-text w-50 mb-3" style={{ height: "20px" }} />
                    <div className="skeleton-shimmer skeleton-text w-100 mb-2" style={{ height: "14px" }} />
                    <div className="skeleton-shimmer skeleton-text w-75 mb-4" style={{ height: "14px" }} />
                    <div className="skeleton-shimmer skeleton-text w-50" style={{ height: "32px" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="row g-3">
              {plans.map((p) => {
                const monthlyUzsFormatted = (p.price_monthly_uzs / 100).toLocaleString("uz-UZ");
                const yearlyUzsFormatted = (p.price_yearly_uzs / 100).toLocaleString("uz-UZ");

                return (
                  <div key={p.code} className="col-12 col-md-4">
                    <div
                      className={`linear-card p-4 h-100 d-flex flex-column justify-content-between position-relative ${
                        p.is_featured ? "border-primary" : ""
                      }`}
                      style={{
                        backgroundColor: p.is_active ? "var(--bg-surface-elevated)" : "rgba(255,255,255,0.02)",
                        opacity: p.is_active ? 1 : 0.7,
                      }}
                    >
                      <div>
                        {/* Header: Name, Badges */}
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fs-3 fw-bold font-monospace text-primary">{p.name}</span>
                            <Badge variant={p.code === "ultra" ? "accent" : p.code === "pro" ? "success" : "info"}>
                              {p.code.toUpperCase()}
                            </Badge>
                            <Badge variant="default" className="font-monospace" style={{ fontSize: "0.7rem" }}>
                              v{p.price_version || 1}
                            </Badge>
                          </div>
                          <div className="d-flex align-items-center gap-1.5">
                            {p.is_public ? (
                              <Badge variant="success" title="Public: Landing sahifada ko'rinadi">
                                Public
                              </Badge>
                            ) : (
                              <Badge variant="warning" title="Private: Faqat maxsus taklif orqali ulanadi">
                                Private
                              </Badge>
                            )}
                            {!p.is_active && <Badge variant="danger">Deaktiv</Badge>}
                          </div>
                        </div>

                        <p className="text-secondary small mb-3" style={{ minHeight: "36px" }}>
                          {p.description || "Tavsif berilmagan"}
                        </p>

                        {/* Dual Currency Price Display */}
                        <div className="p-2.5 rounded-2 mb-3" style={{ backgroundColor: "var(--bg-canvas)" }}>
                          <div className="d-flex align-items-center justify-content-between small mb-1">
                            <span className="text-secondary">7 Kunlik Sinov:</span>
                            <span className="fw-bold text-success font-monospace">
                              {(p.price_promo_uzs
                                ? p.price_promo_uzs / 100
                                : p.code === "pro"
                                ? 26000
                                : p.code === "ultra"
                                ? 39000
                                : 13000
                              ).toLocaleString("uz-UZ")}{" "}
                              so'm
                            </span>
                          </div>
                          <div className="d-flex align-items-center justify-content-between small mb-1">
                            <span className="text-secondary">Oylik:</span>
                            <span className="fw-bold text-primary font-monospace">
                              {monthlyUzsFormatted} so'm/oy
                            </span>
                          </div>
                          <div className="d-flex align-items-center justify-content-between small mb-1">
                            <span className="text-secondary">Yillik:</span>
                            <span className="fw-bold text-primary font-monospace">
                              {yearlyUzsFormatted} so'm/yil
                            </span>
                          </div>
                          <div className="d-flex align-items-center justify-content-between small text-secondary" style={{ fontSize: "0.72rem" }}>
                            <span>USD ekvivalenti:</span>
                            <span>${p.price_monthly}/oy • ${p.price_yearly}/yil</span>
                          </div>
                        </div>

                        {/* Subscribers & Offers Stats */}
                        <div className="d-flex align-items-center justify-content-between small text-secondary mb-3">
                          <span>
                            Obunachilar: <strong className="text-primary">{p.active_subscribers} ta</strong>
                          </span>
                          <span>
                            Maxsus takliflar: <strong className="text-primary">{p.active_offers_count} ta</strong>
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-top d-flex align-items-center justify-content-between">
                        <span className="small text-secondary font-monospace" style={{ fontSize: "0.75rem" }}>
                          Tartib: #{p.display_order}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<IconPencil size={14} />}
                          onClick={() => handleStartEdit(p)}
                        >
                          Tahrirlash
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit Plan Modal */}
          {editingPlan && (
            <div
              className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                backgroundColor: "rgba(0,0,0,0.7)",
                zIndex: 1050,
                backdropFilter: "blur(4px)",
              }}
            >
              <div
                className="linear-card p-4 rounded-3 w-100 shadow-lg"
                style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}
              >
                <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <IconPencil size={18} className="text-primary" />
                    <h4 className="fw-bold text-primary mb-0">
                      {editingPlan.name} ({editingPlan.code.toUpperCase()}) Tarifini Tahrirlash
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="btn btn-link text-secondary p-0"
                    onClick={() => setEditingPlan(null)}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="form-label small text-secondary">Tarif Nomi</label>
                    <input
                      type="text"
                      className="linear-input w-100"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label small text-secondary">Tavsif</label>
                    <input
                      type="text"
                      className="linear-input w-100"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </div>

                  {/* USD Prices */}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">Oylik Narx (USD $)</label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={editPriceMUsd}
                        onChange={(e) => setEditPriceMUsd(Number(e.target.value))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">Yillik Narx (USD $)</label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={editPriceYUsd}
                        onChange={(e) => setEditPriceYUsd(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* 7 Kunlik Mega Chegirma Narxi (stored as tiyin) */}
                  <div className="mb-2">
                    <label className="form-label small text-secondary">
                      7 Kunlik Mega Chegirma Narxi (UZS so'm)
                    </label>
                    <input
                      type="number"
                      className="linear-input w-100 font-monospace"
                      value={Math.round((editPricePromoUzs || 1300000) / 100)}
                      onChange={(e) => setEditPricePromoUzs(Number(e.target.value) * 100)}
                    />
                    <span className="small text-secondary" style={{ fontSize: "0.72rem" }}>
                      Bazada tiyinda: {editPricePromoUzs} tiyin (START: 13 000, PRO: 26 000, ULTRA: 39 000 so'm)
                    </span>
                  </div>

                  {/* UZS Prices (stored as tiyin: 1 UZS = 100 tiyin) */}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">
                        Oylik Narx (UZS so'm)
                      </label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={Math.round(editPriceMUzs / 100)}
                        onChange={(e) => setEditPriceMUzs(Number(e.target.value) * 100)}
                      />
                      <span className="small text-secondary" style={{ fontSize: "0.72rem" }}>
                        Bazada tiyinda: {editPriceMUzs} tiyin
                      </span>
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">
                        Yillik Narx (UZS so'm)
                      </label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={Math.round(editPriceYUzs / 100)}
                        onChange={(e) => setEditPriceYUzs(Number(e.target.value) * 100)}
                      />
                      <span className="small text-secondary" style={{ fontSize: "0.72rem" }}>
                        Bazada tiyinda: {editPriceYUzs} tiyin
                      </span>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-4">
                      <label className="form-label small text-secondary">Tartib Raqami</label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={editDisplayOrder}
                        onChange={(e) => setEditDisplayOrder(Number(e.target.value))}
                      />
                    </div>
                    <div className="col-8">
                      <label className="form-label small text-secondary">O'zgarish Sababi (Audit)</label>
                      <input
                        type="text"
                        className="linear-input w-100"
                        placeholder="Masalan: Yillik aksiya yoki xarajat moslashuvi"
                        value={editChangeReason}
                        onChange={(e) => setEditChangeReason(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="d-flex align-items-center justify-content-between p-2.5 rounded-2 bg-dark bg-opacity-25">
                    <label className="d-flex align-items-center gap-2 small text-primary m-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsPublic}
                        onChange={(e) => setEditIsPublic(e.target.checked)}
                      />
                      <span>Public Katalogda Ko'rsatish (is_public)</span>
                    </label>
                    <label className="d-flex align-items-center gap-2 small text-primary m-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                      />
                      <span>Tarif Faol (is_active)</span>
                    </label>
                  </div>

                  {/* Live Preview Card */}
                  <div className="p-3 rounded-2 border border-secondary border-opacity-20 bg-dark bg-opacity-40">
                    <div className="d-flex align-items-center justify-content-between text-secondary small fw-bold text-uppercase mb-1" style={{ fontSize: "0.7rem" }}>
                      <span>Ko'rinishining Jonli Prevyusi (Live Preview)</span>
                      <span className="badge bg-secondary font-monospace">Versiya: v{(editingPlan.price_version || 1) + 1}</span>
                    </div>
                    <div className="d-flex flex-wrap align-items-baseline gap-3">
                      <div>
                        <span className="text-secondary small">7 kunlik: </span>
                        <span className="fw-bold text-success font-monospace">
                          {(editPricePromoUzs / 100).toLocaleString("uz-UZ")} so'm
                        </span>
                      </div>
                      <div>
                        <span className="text-secondary small">Oylik: </span>
                        <span className="fw-bold text-primary font-monospace">
                          {(editPriceMUzs / 100).toLocaleString("uz-UZ")} so'm
                        </span>
                      </div>
                      <div>
                        <span className="text-secondary small">Yillik: </span>
                        <span className="fw-bold text-primary font-monospace">
                          {(editPriceYUzs / 100).toLocaleString("uz-UZ")} so'm
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top mt-4">
                  <Button variant="secondary" size="sm" onClick={() => setEditingPlan(null)}>
                    Bekor Qilish
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={savingPlan}
                    onClick={handleSavePlanEdit}
                  >
                    Saqlash va Keshni Tozalash
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Create Plan Modal */}
          {showCreatePlanModal && (
            <div
              className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                backgroundColor: "rgba(0,0,0,0.7)",
                zIndex: 1050,
                backdropFilter: "blur(4px)",
              }}
            >
              <div
                className="linear-card p-4 rounded-3 w-100 shadow-lg"
                style={{ maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}
              >
                <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
                  <h4 className="fw-bold text-primary mb-0">Yangi Global Tarif Yaratish</h4>
                  <button
                    type="button"
                    className="btn btn-link text-secondary p-0"
                    onClick={() => setShowCreatePlanModal(false)}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">Plan Kodi (slug)</label>
                      <input
                        type="text"
                        className="linear-input w-100 font-monospace"
                        placeholder="masalan: enterprise"
                        value={newPlanCode}
                        onChange={(e) => setNewPlanCode(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">Plan Nomi</label>
                      <input
                        type="text"
                        className="linear-input w-100"
                        placeholder="Enterprise Plan"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label small text-secondary">Tavsif</label>
                    <input
                      type="text"
                      className="linear-input w-100"
                      placeholder="Ushbu tarif kimlar uchun mo'ljallangan"
                      value={newPlanDesc}
                      onChange={(e) => setNewPlanDesc(e.target.value)}
                    />
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">Oylik USD ($)</label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={newPlanPriceMUsd}
                        onChange={(e) => setNewPlanPriceMUsd(Number(e.target.value))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">Yillik USD ($)</label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={newPlanPriceYUsd}
                        onChange={(e) => setNewPlanPriceYUsd(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">Oylik UZS (so'm)</label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={Math.round(newPlanPriceMUzs / 100)}
                        onChange={(e) => setNewPlanPriceMUzs(Number(e.target.value) * 100)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">Yillik UZS (so'm)</label>
                      <input
                        type="number"
                        className="linear-input w-100 font-monospace"
                        value={Math.round(newPlanPriceYUzs / 100)}
                        onChange={(e) => setNewPlanPriceYUzs(Number(e.target.value) * 100)}
                      />
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-3 pt-2">
                    <label className="d-flex align-items-center gap-2 small text-primary m-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPlanIsPublic}
                        onChange={(e) => setNewPlanIsPublic(e.target.checked)}
                      />
                      <span>Public qilib chiqarish</span>
                    </label>
                    <label className="d-flex align-items-center gap-2 small text-primary m-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPlanIsFeatured}
                        onChange={(e) => setNewPlanIsFeatured(e.target.checked)}
                      />
                      <span>Tavsiya etilgan (Featured)</span>
                    </label>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top mt-4">
                  <Button variant="secondary" size="sm" onClick={() => setShowCreatePlanModal(false)}>
                    Bekor Qilish
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={creatingPlan}
                    onClick={handleCreateNewPlan}
                  >
                    Tarifni Yaratish
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Price Change Modal */}
          {showScheduleModal && (
            <div
              className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                backgroundColor: "rgba(0,0,0,0.7)",
                zIndex: 1050,
                backdropFilter: "blur(4px)",
              }}
            >
              <div
                className="linear-card p-4 rounded-3 w-100 shadow-lg"
                style={{ maxWidth: "540px", maxHeight: "90vh", overflowY: "auto" }}
              >
                <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <IconClock size={18} className="text-primary" />
                    <h4 className="fw-bold text-primary mb-0">Kelajakdagi Narx O'zgarishini Rejalashtirish</h4>
                  </div>
                  <button
                    type="button"
                    className="btn btn-link text-secondary p-0"
                    onClick={() => setShowScheduleModal(false)}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="form-label small text-secondary">Tarif</label>
                    <select
                      className="linear-input w-100"
                      value={schedulePlanCode}
                      onChange={(e) => setSchedulePlanCode(e.target.value)}
                    >
                      <option value="start">START</option>
                      <option value="pro">PRO</option>
                      <option value="ultra">ULTRA</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label small text-secondary">To'lov Davri</label>
                    <select
                      className="linear-input w-100"
                      value={schedulePeriod}
                      onChange={(e) => setSchedulePeriod(e.target.value as any)}
                    >
                      <option value="MEGA_DISCOUNT_7D">7 Kunlik Mega Chegirma (Promotional)</option>
                      <option value="MONTHLY">Oylik To'lov (Monthly)</option>
                      <option value="YEARLY">Yillik To'lov (Yearly)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label small text-secondary">Yangi Narx (UZS so'mda)</label>
                    <input
                      type="number"
                      className="linear-input w-100 font-monospace"
                      value={scheduleNewPriceUzs}
                      onChange={(e) => setScheduleNewPriceUzs(Number(e.target.value))}
                    />
                    <span className="small text-secondary" style={{ fontSize: "0.72rem" }}>
                      TezCheck to'lov tizimiga tiyinda yuboriladi: {scheduleNewPriceUzs * 100} tiyin
                    </span>
                  </div>

                  <div>
                    <label className="form-label small text-secondary">Kuchga Kirish Sanasi (Ixtiyoriy kelajak sana)</label>
                    <input
                      type="datetime-local"
                      className="linear-input w-100"
                      value={scheduleEffectiveAt}
                      onChange={(e) => setScheduleEffectiveAt(e.target.value)}
                    />
                    <span className="small text-secondary" style={{ fontSize: "0.72rem" }}>
                      Bo'sh qoldirilsa, darhol kuchga kiradi va audit tarixiga yoziladi.
                    </span>
                  </div>

                  <div>
                    <label className="form-label small text-secondary">O'zgartirish Sababi (Majburiy Audit Qaydi)</label>
                    <input
                      type="text"
                      className="linear-input w-100"
                      placeholder="Masalan: 2026 Q4 rejalashtirilgan inflyatsiya indeksi"
                      value={scheduleReason}
                      onChange={(e) => setScheduleReason(e.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top mt-4">
                  <Button variant="secondary" size="sm" onClick={() => setShowScheduleModal(false)}>
                    Bekor Qilish
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={schedulingPrice}
                    onClick={handleSchedulePriceChange}
                  >
                    Rejalashtirish va Auditga Saqlash
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: INDIVIDUAL CUSTOMER PRICING & DISCOUNTS */}
      {/* ==================================================================== */}
      {activeSection === "offers" && (
        <div className="space-y-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h3 className="fs-3 fw-bold text-primary mb-1">Mijoz Individual Narx Takliflari</h3>
              <p className="text-secondary small mb-0">
                Muayyan tashkilotga berilgan individual chegirmalar server darajasida tekshiriladi va anti-stacking qoidasi bo'yicha qo'llanadi.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={15} />}
              onClick={() => setShowCreateOfferModal(true)}
            >
              Yangi Chegirma Belgilash
            </Button>
          </div>

          {/* Customer Selection Row */}
          <div className="p-3 rounded-3 border border-secondary border-opacity-20 d-flex flex-wrap align-items-center gap-3 bg-dark bg-opacity-25">
            <div className="d-flex align-items-center gap-2">
              <IconBuildingSkyscraper size={18} className="text-secondary" />
              <span className="small fw-semibold text-primary">Do'konni Tanlang:</span>
            </div>
            <div style={{ minWidth: "260px" }}>
              <select
                className="linear-input w-100"
                value={selectedCustomerOrgId}
                onChange={(e) => setSelectedCustomerOrgId(Number(e.target.value))}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    #{org.id} {org.name} ({org.slug})
                  </option>
                ))}
              </select>
            </div>
            <Badge variant="accent">{customerOffers.length} ta mavjud taklif</Badge>
          </div>

          {offersError && (
            <div className="p-3 rounded-3 bg-danger bg-opacity-10 text-danger small">
              {offersError}
            </div>
          )}

          {/* Offers Table */}
          <Card>
            <CardHeader actions={<Badge variant="accent">Anti-Stacking Protected</Badge>}>
              <CardTitle>Mijoz Takliflari Tarixi</CardTitle>
            </CardHeader>
            <div className="table-responsive">
              <table className="linear-table">
                <thead>
                  <tr>
                    <th>Tarif</th>
                    <th>Interval</th>
                    <th>Valyuta</th>
                    <th>Chegirma Turi</th>
                    <th>Qiymati</th>
                    <th>Amal Qilish Muddati</th>
                    <th>Holati</th>
                    <th>Izoh</th>
                    <th className="text-end">Harakat</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOffers ? (
                    [...Array(3)].map((_, idx) => (
                      <tr key={`skel-offer-${idx}`}>
                        <td colSpan={9}>
                          <div className="skeleton-shimmer skeleton-text w-100" style={{ height: "16px" }} />
                        </td>
                      </tr>
                    ))
                  ) : customerOffers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-5 text-secondary">
                        Ushbu do'konga hali individual chegirma belgilanmagan.
                      </td>
                    </tr>
                  ) : (
                    customerOffers.map((offer) => (
                      <tr key={offer.id}>
                        <td>
                          <span className="fw-bold font-monospace text-primary">
                            {offer.plan_code.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="small text-secondary text-capitalize">
                            {offer.billing_interval === "monthly" ? "Oylik" : "Yillik"}
                          </span>
                        </td>
                        <td>
                          <Badge variant="default">{offer.currency}</Badge>
                        </td>
                        <td>
                          <span className="small text-secondary font-monospace">
                            {offer.discount_type === "percentage"
                              ? "Foiz chegirma"
                              : offer.discount_type === "fixed_amount"
                              ? "Qat'iy chegirma"
                              : "Maxsus narx"}
                          </span>
                        </td>
                        <td>
                          <span className="fw-bold text-success font-monospace">
                            {offer.discount_formatted}
                          </span>
                        </td>
                        <td>
                          <span className="small text-secondary font-monospace">
                            {offer.starts_at.slice(0, 10)} - {offer.expires_at.slice(0, 10)}
                          </span>
                        </td>
                        <td>
                          <Badge
                            variant={
                              offer.status === "active"
                                ? "success"
                                : offer.status === "superseded"
                                ? "warning"
                                : "danger"
                            }
                          >
                            {offer.status}
                          </Badge>
                        </td>
                        <td>
                          <span className="small text-secondary">{offer.notes || "-"}</span>
                        </td>
                        <td className="text-end">
                          {offer.status === "active" && (
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<IconTrash size={14} />}
                              onClick={() => handleRevokeOffer(offer.id)}
                            >
                              Bekor qilish
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Create Offer Modal */}
          {showCreateOfferModal && (
            <div
              className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                backgroundColor: "rgba(0,0,0,0.7)",
                zIndex: 1050,
                backdropFilter: "blur(4px)",
              }}
            >
              <div
                className="linear-card p-4 rounded-3 w-100 shadow-lg"
                style={{ maxWidth: "540px", maxHeight: "90vh", overflowY: "auto" }}
              >
                <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
                  <h4 className="fw-bold text-primary mb-0">Yangi Individual Chegirma Belgilash</h4>
                  <button
                    type="button"
                    className="btn btn-link text-secondary p-0"
                    onClick={() => setShowCreateOfferModal(false)}
                  >
                    <IconX size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">Tarif</label>
                      <select
                        className="linear-input w-100"
                        value={offerPlanCode}
                        onChange={(e) => setOfferPlanCode(e.target.value)}
                      >
                        {plans.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name} ({p.code.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">To'lov Davri</label>
                      <select
                        className="linear-input w-100"
                        value={offerBillingInterval}
                        onChange={(e) => setOfferBillingInterval(e.target.value as any)}
                      >
                        <option value="monthly">Oylik (monthly)</option>
                        <option value="yearly">Yillik (yearly)</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">Valyuta</label>
                      <select
                        className="linear-input w-100"
                        value={offerCurrency}
                        onChange={(e) => setOfferCurrency(e.target.value as any)}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="UZS">UZS (so'm)</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">Chegirma Turi</label>
                      <select
                        className="linear-input w-100"
                        value={offerDiscountType}
                        onChange={(e) => setOfferDiscountType(e.target.value as any)}
                      >
                        <option value="percentage">Foiz (%) Chegirma</option>
                        <option value="fixed_amount">Qat'iy Chegirma (Minor Units)</option>
                        <option value="custom_price">Maxsus Shaxsiy Narx (Minor Units)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label small text-secondary">
                      Chegirma Qiymati{" "}
                      {offerDiscountType === "percentage"
                        ? "(masalan: 20 bo'lsa 20%)"
                        : offerCurrency === "USD"
                        ? "(tsentlarda: $15 chegirma = 1500 tsent)"
                        : "(tiyinda: 100,000 so'm = 10000000 tiyin)"}
                    </label>
                    <input
                      type="number"
                      className="linear-input w-100 font-monospace"
                      value={offerDiscountValue}
                      onChange={(e) => setOfferDiscountValue(Number(e.target.value))}
                    />
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-secondary">Boshlanish Sanasi</label>
                      <input
                        type="date"
                        className="linear-input w-100"
                        value={offerStartsAt}
                        onChange={(e) => setOfferStartsAt(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-secondary">Tugash Sanasi</label>
                      <input
                        type="date"
                        className="linear-input w-100"
                        value={offerExpiresAt}
                        onChange={(e) => setOfferExpiresAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label small text-secondary">Izoh (Admin Notes)</label>
                    <input
                      type="text"
                      className="linear-input w-100"
                      placeholder="Masalan: VIP hamkor yoki sinov muddati uchun maxsus kelishuv"
                      value={offerNotes}
                      onChange={(e) => setOfferNotes(e.target.value)}
                    />
                  </div>

                  <div className="p-2.5 rounded-2 bg-dark bg-opacity-25">
                    <label className="d-flex align-items-center gap-2 small text-primary m-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={offerSupersede}
                        onChange={(e) => setOfferSupersede(e.target.checked)}
                      />
                      <span>Mavjud faol taklif bo'lsa uni almashtirish (Supersede)</span>
                    </label>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top mt-4">
                  <Button variant="secondary" size="sm" onClick={() => setShowCreateOfferModal(false)}>
                    Bekor Qilish
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={creatingOffer}
                    onClick={handleCreateCustomerOffer}
                  >
                    Taklifni Tasdiqlash
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 3: PRICING HISTORY & AUDIT LOGS */}
      {/* ==================================================================== */}
      {activeSection === "history" && (
        <div className="space-y-4">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h3 className="fs-3 fw-bold text-primary mb-1">Narxlar Tarixi va Audit Jurnali</h3>
              <p className="text-secondary small mb-0">
                Tariflar va mijoz chegirmalariga kiritilgan barcha o'zgarishlar o'chmas xronologik jurnalga yozib boriladi.
              </p>
            </div>
          </div>

          <div className="row g-4">
            {/* Global Plan Price Adjustments History */}
            <div className="col-12 col-lg-6">
              <Card>
                <CardHeader actions={<Badge variant="accent">{historyList.length} ta yozuv</Badge>}>
                  <CardTitle>Global Narx O'zgarishlari Tarixi</CardTitle>
                </CardHeader>
                <div className="table-responsive" style={{ maxHeight: "420px" }}>
                  <table className="linear-table">
                    <thead>
                      <tr>
                        <th>Tarif</th>
                        <th>Oylik / Yillik ($)</th>
                        <th>Oylik (UZS)</th>
                        <th>Sababi</th>
                        <th>Sana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistory ? (
                        [...Array(3)].map((_, idx) => (
                          <tr key={`skel-h-${idx}`}>
                            <td colSpan={5}>
                              <div className="skeleton-shimmer skeleton-text w-100" style={{ height: "16px" }} />
                            </td>
                          </tr>
                        ))
                      ) : historyList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-secondary">
                            Narxlar o'zgarishi tarixi hozircha bo'sh
                          </td>
                        </tr>
                      ) : (
                        historyList.map((h) => (
                          <tr key={h.id}>
                            <td>
                              <span className="fw-bold font-monospace text-primary">
                                {(h.plan_code || "PLAN").toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <span className="small text-primary font-monospace">
                                ${h.price_monthly_cents / 100} / ${h.price_yearly_cents / 100}
                              </span>
                            </td>
                            <td>
                              <span className="small text-secondary font-monospace">
                                {(h.price_monthly_uzs / 100).toLocaleString("uz-UZ")}
                              </span>
                            </td>
                            <td>
                              <span className="small text-secondary">{h.change_reason || "-"}</span>
                            </td>
                            <td>
                              <span className="small text-secondary font-monospace">
                                {h.effective_from ? h.effective_from.slice(0, 10) : "-"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Pricing Audit Logs */}
            <div className="col-12 col-lg-6">
              <Card>
                <CardHeader actions={<Badge variant="accent">{auditList.length} ta yozuv</Badge>}>
                  <CardTitle>Narxlar Audit Jurnali</CardTitle>
                </CardHeader>
                <div className="table-responsive" style={{ maxHeight: "420px" }}>
                  <table className="linear-table">
                    <thead>
                      <tr>
                        <th>Harakat</th>
                        <th>Resurs</th>
                        <th>Tashkilot</th>
                        <th>Vaqti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistory ? (
                        [...Array(3)].map((_, idx) => (
                          <tr key={`skel-a-${idx}`}>
                            <td colSpan={4}>
                              <div className="skeleton-shimmer skeleton-text w-100" style={{ height: "16px" }} />
                            </td>
                          </tr>
                        ))
                      ) : auditList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-secondary">
                            Audit yozuvlari topilmadi
                          </td>
                        </tr>
                      ) : (
                        auditList.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <Badge variant="default">{a.action}</Badge>
                            </td>
                            <td>
                              <span className="small text-secondary font-monospace">
                                {a.resource} #{a.resource_id}
                              </span>
                            </td>
                            <td>
                              <span className="small text-secondary">
                                {a.organization_id ? `#${a.organization_id}` : "Global"}
                              </span>
                            </td>
                            <td>
                              <span className="small text-secondary font-monospace">
                                {a.created_at ? a.created_at.slice(0, 19).replace("T", " ") : "-"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 4: PRICING RESOLUTION SIMULATOR (DRY-RUN) */}
      {/* ==================================================================== */}
      {activeSection === "simulator" && (
        <div className="space-y-4">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h3 className="fs-3 fw-bold text-primary mb-1">Narx Hisoblash Simulyatori</h3>
              <p className="text-secondary small mb-0">
                Backend Pricing Resolution Engine algoritmini haqiqiy mijoz va tarif kombinatsiyasida xavfsiz sinab ko'ring.
              </p>
            </div>
          </div>

          {/* Non-billable warning banner */}
          <div className="p-3 rounded-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 d-flex align-items-center gap-2.5">
            <IconInfoCircle size={20} className="text-warning flex-shrink-0" />
            <div className="small text-warning">
              <strong>SIMULYATSIYA REJIMI (NON-BILLABLE DRY-RUN):</strong> Ushbu kalkulyator faqatgina
              hisoblash bosqichlari va chegirma qoidalarini tekshirish uchun mo'ljallangan. Hech qanday
              obuna yoki to'lov o'zgarishi sodir bo'lmaydi.
            </div>
          </div>

          {/* Simulator Inputs */}
          <Card>
            <CardHeader actions={<Badge variant="warning">Dry-Run Test</Badge>}>
              <CardTitle>Simulyatsiya Parametrlari</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="row g-3">
                <div className="col-12 col-md-3">
                  <label className="form-label small text-secondary">Tashkilot / Do'kon</label>
                  <select
                    className="linear-input w-100"
                    value={simOrgId}
                    onChange={(e) => setSimOrgId(Number(e.target.value))}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        #{org.id} {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small text-secondary">Tarif</label>
                  <select
                    className="linear-input w-100"
                    value={simPlanCode}
                    onChange={(e) => setSimPlanCode(e.target.value)}
                  >
                    {plans.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small text-secondary">To'lov Davri</label>
                  <select
                    className="linear-input w-100"
                    value={simInterval}
                    onChange={(e) => setSimInterval(e.target.value as any)}
                  >
                    <option value="monthly">Oylik (monthly)</option>
                    <option value="yearly">Yillik (yearly)</option>
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small text-secondary">Valyuta</label>
                  <select
                    className="linear-input w-100"
                    value={simCurrency}
                    onChange={(e) => setSimCurrency(e.target.value as any)}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="UZS">UZS (so'm)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-top mt-3 d-flex justify-content-end">
                <Button
                  variant="primary"
                  icon={<IconPlayerPlay size={16} />}
                  loading={simulating}
                  onClick={handleRunSimulator}
                >
                  Simulyatsiyani Ishga Tushirish
                </Button>
              </div>
            </CardContent>
          </Card>

          {simError && (
            <div className="p-3 rounded-3 bg-danger bg-opacity-10 text-danger small">
              {simError}
            </div>
          )}

          {/* Simulator Results */}
          {simResult && (
            <div className="space-y-3">
              {/* Summary Cards */}
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="linear-card p-3.5">
                    <div className="text-secondary small fw-bold text-uppercase mb-1" style={{ fontSize: "0.72rem" }}>
                      Katalog Asosiy Narxi
                    </div>
                    <div className="fs-2 fw-bold font-monospace text-primary">
                      {simResult.calculation.catalog_base_price_formatted}
                    </div>
                    <span className="small text-secondary">Standart global narx</span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="linear-card p-3.5">
                    <div className="text-secondary small fw-bold text-uppercase mb-1" style={{ fontSize: "0.72rem" }}>
                      Qo'llangan Chegirma
                    </div>
                    <div className="fs-2 fw-bold font-monospace text-success">
                      {simResult.calculation.discount_amount_formatted}
                    </div>
                    <span className="small text-secondary">
                      Manba: {simResult.calculation.price_source}
                    </span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="linear-card p-3.5 border-primary">
                    <div className="text-secondary small fw-bold text-uppercase mb-1" style={{ fontSize: "0.72rem" }}>
                      Yakuniy To'lov Miqdori
                    </div>
                    <div className="fs-2 fw-bold font-monospace text-primary">
                      {simResult.calculation.effective_price_formatted}
                    </div>
                    <span className="small text-secondary">
                      Valyuta: {simResult.currency} ({simResult.billing_interval})
                    </span>
                  </div>
                </div>
              </div>

              {/* Renewal Outlook & Step-by-Step Trace */}
              <Card>
                <CardHeader actions={<Badge variant="accent">Server Engine Trace</Badge>}>
                  <CardTitle>Bosqichma-bosqich Hisoblash Izohi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {simResult.trace &&
                      simResult.trace.map((step: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-2 d-flex align-items-center justify-content-between"
                          style={{ backgroundColor: "var(--bg-canvas)" }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="badge rounded-circle p-1 d-flex align-items-center justify-content-center"
                              style={{ width: "22px", height: "22px", backgroundColor: "var(--accent)" }}
                            >
                              {step.step}
                            </span>
                            <span className="fw-semibold text-primary small">{step.action}</span>
                          </div>
                          <span className="small text-secondary">{step.outcome}</span>
                        </div>
                      ))}
                  </div>

                  {/* Renewal Transition Policy Alert */}
                  {simResult.calculation.renewal_policy && (
                    <div
                      className={`p-3 rounded-2 border ${
                        simResult.calculation.renewal_policy.will_change_on_renewal
                          ? "border-warning bg-warning bg-opacity-10 text-warning"
                          : "border-success bg-success bg-opacity-10 text-success"
                      }`}
                    >
                      <div className="fw-bold small mb-1">
                        Navbatdagi Yangilanish Siyosati (Platform Owner Decision 2: Option A):
                      </div>
                      <div className="small">
                        {simResult.calculation.renewal_policy.explanation}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
