"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  DesignId,
  DESIGN_DEFINITIONS,
  getAvailableDesigns,
  canUseDesign,
  validateDesignSelection,
} from "../../lib/design-entitlements";

export interface DesignContextType {
  currentDesign: DesignId;
  availableDesigns: DesignId[];
  activePlan: string;
  isSubscriptionLoading: boolean;
  subscriptionError: string | null;
  isPlatformOwner: boolean;
  isDesignLocked: (id: DesignId) => boolean;
  setDesign: (id: DesignId) => boolean;
  upgradeModalOpen: boolean;
  setUpgradeModalOpen: (open: boolean) => void;
  targetUpgradeDesign: DesignId | null;
  openUpgradeModal: (targetDesign: DesignId) => void;
  closeUpgradeModal: () => void;
}

const DesignContext = createContext<DesignContextType | undefined>(undefined);

export const STORAGE_KEY_DESIGN = "ai_sales_design_system";

export interface DesignProviderProps {
  children: React.ReactNode;
  subscriptionPlan?: string | null;
  isSubscriptionLoading?: boolean;
  subscriptionError?: string | null;
  isPlatformOwner?: boolean;
}

export function DesignProvider({
  children,
  subscriptionPlan = null,
  isSubscriptionLoading = false,
  subscriptionError = null,
  isPlatformOwner = false,
}: DesignProviderProps) {
  // Safe initial default: always Classic (never implicit ULTRA / Premium)
  const [currentDesign, setCurrentDesignState] = useState<DesignId>("classic");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [targetUpgradeDesign, setTargetUpgradeDesign] = useState<DesignId | null>(null);

  const availableDesigns = useMemo((): DesignId[] => {
    return getAvailableDesigns(
      subscriptionPlan,
      isPlatformOwner,
      isSubscriptionLoading,
      subscriptionError
    );
  }, [subscriptionPlan, isPlatformOwner, isSubscriptionLoading, subscriptionError]);

  // Synchronize and strictly validate with backend subscription entitlements
  useEffect(() => {
    // 1. Explicit verified Platform Owner override
    if (isPlatformOwner) {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_DESIGN) : null;
        const validDesign = validateDesignSelection(stored, "ultra", true);
        setCurrentDesignState(validDesign);
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-design", validDesign);
        }
      } catch {
        setCurrentDesignState("classic");
      }
      return;
    }

    // 2. While subscription verification is in flight, unknown, or in error:
    // NEVER authorize Premium or iOS — enforce Classic without flashing
    if (isSubscriptionLoading || subscriptionError || !subscriptionPlan) {
      setCurrentDesignState("classic");
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-design", "classic");
      }
      return;
    }

    // 3. Authoritative subscription data is available: validate saved selection
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_DESIGN) : null;
      const validDesign = validateDesignSelection(
        stored,
        subscriptionPlan,
        false,
        isSubscriptionLoading,
        subscriptionError
      );

      setCurrentDesignState(validDesign);
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-design", validDesign);
      }

      // If stored design was unauthorized (e.g. downgraded or spoofed), sanitize localStorage
      if (stored !== validDesign && typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_DESIGN, validDesign);
      }
    } catch {
      // Safe fallback to classic on storage exception
      setCurrentDesignState("classic");
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-design", "classic");
      }
    }
  }, [subscriptionPlan, isSubscriptionLoading, subscriptionError, isPlatformOwner]);

  const isDesignLocked = useCallback(
    (id: DesignId): boolean => {
      if (isPlatformOwner) return false;
      if (isSubscriptionLoading || subscriptionError || !subscriptionPlan) {
        return id !== "classic";
      }
      return !canUseDesign(subscriptionPlan, id, isPlatformOwner);
    },
    [subscriptionPlan, isSubscriptionLoading, subscriptionError, isPlatformOwner]
  );

  const openUpgradeModal = useCallback((targetDesign: DesignId) => {
    setTargetUpgradeDesign(targetDesign);
    setUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
    setTargetUpgradeDesign(null);
  }, []);

  const setDesign = useCallback(
    (id: DesignId): boolean => {
      // Block locked designs and trigger upgrade modal
      if (isDesignLocked(id)) {
        openUpgradeModal(id);
        return false;
      }

      setCurrentDesignState(id);
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-design", id);
      }
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_DESIGN, id);
        }
      } catch {}

      return true;
    },
    [isDesignLocked, openUpgradeModal]
  );

  return (
    <DesignContext.Provider
      value={{
        currentDesign,
        availableDesigns,
        activePlan: subscriptionPlan || "start",
        isSubscriptionLoading,
        subscriptionError,
        isPlatformOwner,
        isDesignLocked,
        setDesign,
        upgradeModalOpen,
        setUpgradeModalOpen,
        targetUpgradeDesign,
        openUpgradeModal,
        closeUpgradeModal,
      }}
    >
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign(): DesignContextType {
  const context = useContext(DesignContext);
  if (!context) {
    throw new Error("useDesign must be used within a DesignProvider");
  }
  return context;
}
