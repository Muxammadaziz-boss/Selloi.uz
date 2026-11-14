/**
 * Design Entitlement Matrix & Centralized Plan Access Utility.
 *
 * Enforces subscription-based access to the 3 independent design systems:
 * - PREMIUM: Available exclusively on ULTRA (and Platform Owner).
 * - IOS: Available on PRO and ULTRA.
 * - CLASSIC: Available on all plans (START / STANDARD, PRO, ULTRA).
 *
 * Backend plan entitlement is authoritative: never trust client-only or spoofed storage.
 */

export type DesignId = "premium" | "ios" | "classic";

export type PlanCode = "start" | "standard" | "pro" | "ultra" | string;

export interface DesignMetadata {
  id: DesignId;
  name: string;
  badge: string;
  description: string;
  minPlan: "ultra" | "pro" | "start";
  minPlanLabel: string;
  allowedPlans: string[];
}

export const DESIGN_DEFINITIONS: Record<DesignId, DesignMetadata> = {
  premium: {
    id: "premium",
    name: "Premium Minimal",
    badge: "ULTRA",
    description: "Chuqur qora minimalist SaaS interfeysi, nozik ajratgichlar va aniq metrikalar.",
    minPlan: "ultra",
    minPlanLabel: "Ultra",
    allowedPlans: ["ultra"],
  },
  ios: {
    id: "ios",
    name: "Apple iOS Uslubi",
    badge: "PRO",
    description: "Muzlatilgan shisha (frosted glass), SF Pro tipografiyasi va iMessage uslubidagi jonli chat.",
    minPlan: "pro",
    minPlanLabel: "Pro & Ultra",
    allowedPlans: ["pro", "ultra"],
  },
  classic: {
    id: "classic",
    name: "Classic Standart",
    badge: "STANDART",
    description: "Klassik professional korporativ boshqaruv paneli va ixcham jadvallar.",
    minPlan: "start",
    minPlanLabel: "Barcha Tariflar",
    allowedPlans: ["start", "standard", "pro", "ultra"],
  },
};

/**
 * Normalize plan codes from backend subscriptions or user objects.
 * Handles "start", "standard", "pro", "ultra" case-insensitively.
 */
export function normalizePlanCode(rawPlan?: string | null): string {
  if (!rawPlan) return "start";
  const p = String(rawPlan).trim().toLowerCase();
  if (p === "standard") return "start";
  return p;
}

/**
 * Return list of design IDs accessible under the active subscription plan.
 * Platform Owners automatically gain access to all designs.
 */
export function getAvailableDesigns(
  subscriptionPlan?: string | null,
  isPlatformOwner = false
): DesignId[] {
  if (isPlatformOwner) {
    return ["premium", "ios", "classic"];
  }

  const plan = normalizePlanCode(subscriptionPlan);

  switch (plan) {
    case "ultra":
      return ["premium", "ios", "classic"];
    case "pro":
      return ["ios", "classic"];
    case "start":
    default:
      return ["classic"];
  }
}

/**
 * Check whether a specific design can be used under the active plan.
 */
export function canUseDesign(
  subscriptionPlan: string | null | undefined,
  designId: string | null | undefined,
  isPlatformOwner = false
): boolean {
  if (!designId) return false;
  const available = getAvailableDesigns(subscriptionPlan, isPlatformOwner);
  return available.includes(designId as DesignId);
}

/**
 * Return the safe fallback design for a given plan tier.
 * Default fallback is always "classic".
 */
export function getFallbackDesign(
  _subscriptionPlan?: string | null,
  _isPlatformOwner = false
): DesignId {
  // Classic is universally supported on all subscription tiers
  return "classic";
}

/**
 * Validate a candidate design (e.g. from localStorage) against backend entitlement.
 * If the user's plan was downgraded or the stored value is unauthorized/invalid,
 * safely falls back to Classic to prevent unauthorized design spoofing.
 */
export function validateDesignSelection(
  storedDesign: string | null | undefined,
  subscriptionPlan: string | null | undefined,
  isPlatformOwner = false
): DesignId {
  const target = (storedDesign || "").toLowerCase() as DesignId;

  if (target === "premium" || target === "ios" || target === "classic") {
    if (canUseDesign(subscriptionPlan, target, isPlatformOwner)) {
      return target;
    }
  }

  // Downgrade fallback: if stored design is restricted or corrupted, select Classic
  return getFallbackDesign(subscriptionPlan, isPlatformOwner);
}
