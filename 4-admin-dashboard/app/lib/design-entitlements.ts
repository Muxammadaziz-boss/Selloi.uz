/**
 * Design Entitlement Matrix & Centralized Plan Access Utility.
 *
 * Enforces subscription-based access to the 3 independent design systems:
 * - PREMIUM: Available exclusively on ULTRA (and Platform Owner).
 * - IOS: Available on PRO and ULTRA.
 * - CLASSIC: Available on all plans (START / STANDARD, PRO, ULTRA).
 *
 * Backend plan entitlement is authoritative: never trust client-only or spoofed storage.
 * While subscription is loading, unknown, or in error, elevated designs are NEVER authorized;
 * the system strictly defaults to Classic.
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
 * Unrecognized or empty plans safely default to "start".
 */
export function normalizePlanCode(rawPlan?: string | null): string {
  if (!rawPlan) return "start";
  const p = String(rawPlan).trim().toLowerCase();
  if (p === "standard") return "start";
  return p;
}

/**
 * Return list of design IDs accessible under the active subscription plan.
 * Verified Platform Owners gain access to all designs.
 * While subscription data is loading, unknown, or in error, only "classic" is returned.
 */
export function getAvailableDesigns(
  subscriptionPlan?: string | null,
  isPlatformOwner = false,
  isSubscriptionLoading = false,
  subscriptionError?: string | null
): DesignId[] {
  if (isPlatformOwner) {
    return ["premium", "ios", "classic"];
  }

  // Never authorize elevated designs while plan data is unknown or verification failed
  if (isSubscriptionLoading || subscriptionError || !subscriptionPlan) {
    return ["classic"];
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
  isPlatformOwner = false,
  isSubscriptionLoading = false,
  subscriptionError?: string | null
): boolean {
  if (!designId) return false;
  const available = getAvailableDesigns(
    subscriptionPlan,
    isPlatformOwner,
    isSubscriptionLoading,
    subscriptionError
  );
  return available.includes(designId as DesignId);
}

/**
 * Return the safe fallback design for a given plan tier.
 * Universal fallback is ALWAYS "classic".
 */
export function getFallbackDesign(
  _subscriptionPlan?: string | null,
  _isPlatformOwner = false
): DesignId {
  return "classic";
}

/**
 * Validate a candidate design (e.g. from localStorage or UI request) against backend entitlement.
 *
 * Rules:
 * - If user is Platform Owner, any valid design ("premium" | "ios" | "classic") is honored.
 * - If subscription is loading, in error, or missing: ALWAYS returns "classic".
 * - On ULTRA: honors "premium", "ios", "classic".
 * - On PRO: honors "ios" and "classic". If "premium" was requested, falls back to "classic".
 * - On START/STANDARD: honors "classic". Any request for "premium" or "ios" falls back to "classic".
 * - Corrupted, spoofed, or invalid strings fall back to "classic".
 */
export function validateDesignSelection(
  storedDesign: string | null | undefined,
  subscriptionPlan: string | null | undefined,
  isPlatformOwner = false,
  isSubscriptionLoading = false,
  subscriptionError?: string | null
): DesignId {
  const target = (storedDesign || "").toLowerCase() as DesignId;
  const isValidDesign = target === "premium" || target === "ios" || target === "classic";

  if (isPlatformOwner) {
    return isValidDesign ? target : "premium";
  }

  // Never authorize elevated designs while subscription verification is in progress or failed
  if (isSubscriptionLoading || subscriptionError || !subscriptionPlan) {
    return "classic";
  }

  if (isValidDesign && canUseDesign(subscriptionPlan, target, false, false, null)) {
    return target;
  }

  // Downgrade fallback: if stored design is restricted or unauthorized, fall back to Classic
  return getFallbackDesign(subscriptionPlan, isPlatformOwner);
}
