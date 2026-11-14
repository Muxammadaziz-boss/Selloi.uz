"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  isPlatformOwner?: boolean;
}

export function DesignProvider({
  children,
  subscriptionPlan = "ultra",
  isPlatformOwner = false,
}: DesignProviderProps) {
  const [currentDesign, setCurrentDesignState] = useState<DesignId>("premium");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [targetUpgradeDesign, setTargetUpgradeDesign] = useState<DesignId | null>(null);

  const availableDesigns = getAvailableDesigns(subscriptionPlan, isPlatformOwner);

  // Sync and validate with backend subscription entitlements
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_DESIGN) : null;
      const validDesign = validateDesignSelection(stored, subscriptionPlan, isPlatformOwner);
      setCurrentDesignState(validDesign);
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-design", validDesign);
      }
      if (stored !== validDesign && typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_DESIGN, validDesign);
      }
    } catch (e) {
      // Fallback safely to classic on storage exception
      setCurrentDesignState("classic");
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-design", "classic");
      }
    }
  }, [subscriptionPlan, isPlatformOwner]);

  const isDesignLocked = useCallback(
    (id: DesignId): boolean => {
      return !canUseDesign(subscriptionPlan, id, isPlatformOwner);
    },
    [subscriptionPlan, isPlatformOwner]
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
      } catch (e) {}

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
