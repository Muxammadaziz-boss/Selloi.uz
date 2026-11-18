"use client";

import React, { useState, useEffect } from "react";
import { Sidebar, NavTabId, PlatformSubTabId } from "./Sidebar";
import { Topbar, OrganizationItem } from "./Topbar";
import { CommandPalette } from "./CommandPalette";

export interface AppShellProps {
  children: React.ReactNode;
  activeTab: NavTabId;
  onSelectTab: (tabId: NavTabId) => void;
  organizations: OrganizationItem[];
  activeOrgId: number;
  onSelectOrg: (orgId: number) => void;
  onOpenNewStoreModal: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  loading: boolean;
  onRefresh: () => void;
  isPlatformOwner?: boolean;
  zone: "store" | "platform";
  onSwitchZone: (zone: "store" | "platform") => void;
  platformSubTab?: PlatformSubTabId;
  onSelectPlatformSubTab?: (subTab: PlatformSubTabId) => void;
  storesCount?: number;
  storeName?: string;
  adminName?: string;
  adminRole?: string;
  adminAvatarUrl?: string;
  aiModel?: string;
  unreadCount?: number;
  productsCount?: number;
  ordersCount?: number;
  logoUrl?: string;
  onOpenLogoModal?: () => void;
  onLogout: () => void;
  breadcrumb: string;
  tabTitle: string;
}

export function AppShell({
  children,
  activeTab,
  onSelectTab,
  organizations,
  activeOrgId,
  onSelectOrg,
  onOpenNewStoreModal,
  theme,
  onToggleTheme,
  loading,
  onRefresh,
  isPlatformOwner = false,
  zone,
  onSwitchZone,
  platformSubTab,
  onSelectPlatformSubTab,
  storesCount,
  storeName = "AI Sales Control",
  adminName = "Admin",
  adminRole = "admin",
  adminAvatarUrl,
  aiModel,
  unreadCount = 0,
  productsCount = 0,
  ordersCount = 0,
  logoUrl = "/logo.svg",
  onOpenLogoModal,
  onLogout,
  breadcrumb,
  tabTitle,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Global Command Palette Shortcut: ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="d-flex w-100" style={{ minHeight: "100vh", backgroundColor: "var(--bg-canvas)" }}>
      {/* Desktop & Mobile Drawer Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          onSelectTab(tabId);
          setMobileNavOpen(false);
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        isPlatformOwner={isPlatformOwner}
        zone={zone}
        onSwitchZone={(z) => {
          onSwitchZone(z);
          setMobileNavOpen(false);
        }}
        platformSubTab={platformSubTab}
        onSelectPlatformSubTab={(sub) => {
          onSelectPlatformSubTab?.(sub);
          setMobileNavOpen(false);
        }}
        storesCount={storesCount}
        storeName={storeName}
        unreadCount={unreadCount}
        productsCount={productsCount}
        ordersCount={ordersCount}
        logoUrl={logoUrl}
        onOpenLogoModal={onOpenLogoModal}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content View with Topbar */}
      <div className="d-flex flex-column flex-grow-1 overflow-x-hidden" style={{ minWidth: 0 }}>
        <Topbar
          breadcrumb={breadcrumb}
          tabTitle={tabTitle}
          organizations={organizations}
          activeOrgId={activeOrgId}
          onSelectOrg={onSelectOrg}
          onOpenNewStoreModal={onOpenNewStoreModal}
          theme={theme}
          onToggleTheme={onToggleTheme}
          loading={loading}
          onRefresh={onRefresh}
          adminName={adminName}
          adminRole={adminRole}
          adminAvatarUrl={adminAvatarUrl}
          aiModel={aiModel}
          onLogout={onLogout}
          onOpenProfile={() => onSelectTab("profile")}
          isPlatformOwner={isPlatformOwner}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
          onSwitchZone={onSwitchZone}
        />

        {/* Tab Page Workspace */}
        <main
          className="flex-grow-1 p-3 p-md-4 custom-scrollbar"
          style={{
            maxWidth: "1600px",
            width: "100%",
            margin: "0 auto",
          }}
        >
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectTab={onSelectTab}
        onToggleTheme={onToggleTheme}
        theme={theme}
        onRefresh={onRefresh}
        onOpenNewStoreModal={onOpenNewStoreModal}
        isPlatformOwner={isPlatformOwner}
        onSwitchZone={onSwitchZone}
        onSelectPlatformSubTab={onSelectPlatformSubTab}
      />
    </div>
  );
}
