"use client";

import React from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconLayoutDashboard,
  IconMessageDots,
  IconBooks,
  IconPackage,
  IconShoppingCart,
  IconUsers,
  IconChartBar,
  IconCpu,
  IconShieldLock,
  IconUserCheck,
  IconHistory,
  IconUser,
  IconGauge,
  IconCreditCard,
  IconLayersLinked,
  IconBuildingStore,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";

export type NavTabId =
  | "overview"
  | "inbox"
  | "knowledge"
  | "products"
  | "orders"
  | "customers"
  | "analytics"
  | "settings"
  | "admins"
  | "team"
  | "logs"
  | "profile"
  | "usage"
  | "billing"
  | "pricing"
  | "platform";

export type PlatformSubTabId = "overview" | "stores" | "users" | "plans" | "usage" | "system" | "audit" | "payment-testing";

export interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  badge?: string | number;
  count?: number;
  subTab?: PlatformSubTabId;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tabId: NavTabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isPlatformOwner?: boolean;
  isStrictPlatformOwner?: boolean;
  zone: "store" | "platform";
  onSwitchZone: (zone: "store" | "platform") => void;
  platformSubTab?: PlatformSubTabId;
  onSelectPlatformSubTab?: (subTab: PlatformSubTabId) => void;
  storesCount?: number;
  usersCount?: number;
  systemHealthOk?: boolean;
  storeName?: string;
  unreadCount?: number;
  productsCount?: number;
  ordersCount?: number;
  logoUrl?: string;
  onOpenLogoModal?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  isPlatformOwner = false,
  isStrictPlatformOwner = false,
  zone,
  onSwitchZone,
  platformSubTab = "overview",
  onSelectPlatformSubTab,
  storesCount = 0,
  usersCount = 0,
  systemHealthOk = true,
  storeName = "AI Sales Control",
  unreadCount = 0,
  productsCount = 0,
  ordersCount = 0,
  logoUrl = "/logo.svg",
  onOpenLogoModal,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { t } = useLanguage();

  const storeNavGroups: NavGroup[] = [
    {
      title: t("nav.group.workspace"),
      items: [
        { id: "overview", label: t("nav.item.overview"), icon: IconLayoutDashboard },
        { id: "inbox", label: t("nav.item.inbox"), icon: IconMessageDots, badge: unreadCount > 0 ? unreadCount : undefined },
        { id: "knowledge", label: t("nav.item.knowledge"), icon: IconBooks },
      ],
    },
    {
      title: t("nav.group.sales"),
      items: [
        { id: "products", label: t("nav.item.products"), icon: IconPackage, count: productsCount > 0 ? productsCount : undefined },
        { id: "orders", label: t("nav.item.orders"), icon: IconShoppingCart, count: ordersCount > 0 ? ordersCount : undefined },
        { id: "customers", label: t("nav.item.customers"), icon: IconUsers },
      ],
    },
    {
      title: t("nav.group.intelligence"),
      items: [
        { id: "analytics", label: t("nav.item.analytics"), icon: IconChartBar },
        { id: "settings", label: t("nav.item.settings"), icon: IconCpu },
      ],
    },
    {
      title: t("nav.group.saas"),
      items: [
        { id: "usage", label: t("nav.item.usage"), icon: IconGauge },
        { id: "billing", label: t("nav.item.billing"), icon: IconCreditCard },
        { id: "pricing", label: t("nav.item.pricing"), icon: IconLayersLinked },
      ],
    },
    {
      title: t("nav.group.system"),
      items: [
        { id: "admins", label: t("nav.item.admins"), icon: IconShieldLock },
        { id: "team", label: t("nav.item.team"), icon: IconUserCheck },
        { id: "logs", label: t("nav.item.logs"), icon: IconHistory },
      ],
    },
  ];

  storeNavGroups.push({
    title: t("nav.group.account"),
    items: [
      { id: "profile", label: t("nav.item.profile"), icon: IconUser },
    ],
  });

  const platformNavGroups: NavGroup[] = [
    {
      title: t("nav.group.platform"),
      items: [
        { id: "platform", label: t("nav.item.overview"), icon: IconLayoutDashboard, subTab: "overview" },
        { id: "platform", label: t("nav.item.stores"), icon: IconBuildingStore, count: storesCount > 0 ? storesCount : undefined, subTab: "stores" },
        { id: "platform", label: t("nav.item.users"), icon: IconUsers, count: usersCount > 0 ? usersCount : undefined, subTab: "users" },
        { id: "platform", label: t("nav.item.plans"), icon: IconLayersLinked, subTab: "plans" },
        { id: "platform", label: t("nav.item.ai_costs"), icon: IconCpu, subTab: "usage" },
      ],
    },
    {
      title: t("nav.group.finance"),
      items: [
        { id: "platform", label: t("nav.item.payment_testing"), icon: IconCreditCard, subTab: "payment-testing" },
      ],
    },
    {
      title: t("nav.group.security"),
      items: [
        { id: "platform", label: t("nav.item.system_health"), icon: IconShieldLock, badge: systemHealthOk ? "OK" : "!", subTab: "system" },
        { id: "platform", label: t("nav.item.audit_logs"), icon: IconHistory, subTab: "audit" },
      ],
    },
    {
      title: t("nav.group.account"),
      items: [
        { id: "profile", label: t("nav.item.profile"), icon: IconUser },
      ],
    },
  ];

  const navGroups = zone === "platform" ? platformNavGroups : storeNavGroups;

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="d-md-none position-fixed"
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1040,
          }}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`d-flex flex-column border-end flex-shrink-0 sidebar-container ${
          mobileOpen ? "d-flex position-fixed start-0 top-0 bottom-0 shadow-lg" : "d-none d-md-flex"
        }`}
        style={{
          width: mobileOpen ? "270px" : collapsed ? "64px" : "var(--sidebar-width, 240px)",
          minWidth: mobileOpen ? "270px" : collapsed ? "64px" : "var(--sidebar-width, 240px)",
          height: "100vh",
          position: mobileOpen ? "fixed" : "sticky",
          top: 0,
          left: 0,
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
          transition: "width var(--transition-base), min-width var(--transition-base)",
          zIndex: mobileOpen ? 1050 : 1020,
          userSelect: "none",
        }}
      >
        {/* Brand Header */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-3 border-bottom"
          style={{ borderColor: "var(--border-subtle)", height: "60px" }}
        >
          <div
            className="d-flex align-items-center gap-2.5 overflow-hidden cursor-pointer"
            onClick={onOpenLogoModal}
            title={t("sidebar.change_logo")}
          >
            <div
              className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
              style={{
                width: "32px",
                height: "32px",
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: "20px", height: "20px", objectFit: "contain" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo.svg";
                }}
              />
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="d-flex flex-column overflow-hidden text-truncate">
                <span
                  className="fw-bold text-primary text-truncate lh-1"
                  style={{ fontSize: "0.88rem", letterSpacing: "-0.01em" }}
                >
                  {zone === "platform" ? (isStrictPlatformOwner ? "Sayt egasi (Owner)" : "Sayt Admini") : storeName}
                </span>
                <span
                  className="text-secondary small mt-1"
                  style={{ fontSize: "0.68rem", letterSpacing: "0.02em" }}
                >
                  {zone === "platform" ? "Selloi Admin Panel" : "Do'kon Dashboardi"}
                </span>
              </div>
            )}
          </div>

          {/* Desktop/Tablet Sidebar Collapse Toggle Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="btn btn-sm p-1 d-none d-md-flex align-items-center justify-content-center rounded"
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              width: "24px",
              height: "24px",
            }}
            title={collapsed ? (t("common.expand", { defaultValue: "Kengaytirish" })) : (t("common.collapse", { defaultValue: "Yig'ish" }))}
          >
            {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
          </button>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="btn btn-sm p-1 d-flex d-md-none align-items-center justify-content-center rounded"
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              width: "28px",
              height: "28px",
            }}
            aria-label="Menyuni yopish"
          >
            <IconX size={16} />
          </button>
        </div>

      {/* Navigation Group Items */}
      <div className="flex-grow-1 overflow-y-auto px-2 py-3 custom-scrollbar">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className={groupIdx > 0 ? "mt-3 pt-2" : ""}>
            {!collapsed ? (
              <div
                className="px-2 mb-1.5 text-uppercase fw-semibold nav-group-title"
                style={{
                  fontSize: "0.68rem",
                  letterSpacing: "0.08em",
                  color: "var(--text-secondary)",
                }}
              >
                {group.title}
              </div>
            ) : (
              <div
                className="my-2 border-top"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            )}

            <div className="d-flex flex-column gap-0.5">
              {group.items.map((item) => {
                const IconComponent = item.icon;
                const isActive =
                  zone === "platform"
                    ? item.id === "profile"
                      ? activeTab === "profile"
                      : activeTab === "platform" && item.subTab === platformSubTab
                    : activeTab === item.id;
                return (
                  <button
                    key={`${item.id}-${item.subTab || item.label}`}
                    type="button"
                    onClick={() => {
                      if (zone === "platform") {
                        if (item.id === "profile") {
                          onSelectTab("profile");
                        } else if (item.subTab && onSelectPlatformSubTab) {
                          onSelectPlatformSubTab(item.subTab);
                          onSelectTab("platform");
                        } else {
                          onSelectTab(item.id);
                        }
                      } else {
                        if (item.id === "platform") {
                          onSwitchZone("platform");
                        }
                        onSelectTab(item.id);
                      }
                      onCloseMobile?.();
                    }}
                    className={`nav-link-item ${
                      isActive ? "linear-active text-primary fw-medium" : "text-secondary"
                    } d-flex align-items-center gap-2.5 px-2.5 py-1.5 rounded text-start w-100 border-0 transition-all`}
                    style={{
                      backgroundColor: isActive ? "var(--bg-surface-hover)" : "transparent",
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      height: "32px",
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <IconComponent
                      size={16}
                      style={{
                        color: isActive ? "var(--accent)" : "inherit",
                        flexShrink: 0,
                      }}
                    />
                    {!collapsed && (
                      <span className="flex-grow-1 text-truncate">{item.label}</span>
                    )}
                    {!collapsed && item.badge !== undefined && (
                      <span
                        className="badge rounded-pill"
                        style={{
                          fontSize: "0.65rem",
                          padding: "2px 6px",
                          backgroundColor:
                            item.badge === "!"
                              ? "var(--danger-subtle)"
                              : typeof item.badge === "number"
                              ? "var(--accent)"
                              : "var(--accent-subtle)",
                          color:
                            item.badge === "!"
                              ? "var(--danger-text)"
                              : typeof item.badge === "number"
                              ? "#ffffff"
                              : "var(--accent-text)",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {!collapsed && item.count !== undefined && (
                      <span
                        className="small fw-semibold"
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>


    </aside>
    </>
  );
}
