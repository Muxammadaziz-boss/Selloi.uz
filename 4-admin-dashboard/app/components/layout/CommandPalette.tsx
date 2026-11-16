"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconSearch,
  IconLayoutDashboard,
  IconMessageDots,
  IconShoppingCart,
  IconPackage,
  IconUsers,
  IconSettings,
  IconBooks,
  IconSpeakerphone,
  IconChartBar,
  IconUserCheck,
  IconFileText,
  IconShieldLock,
  IconUser,
  IconSun,
  IconMoon,
  IconRefresh,
  IconBuildingStore,
  IconPlus,
  IconCornerDownLeft,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { NavTabId, PlatformSubTabId } from "./Sidebar";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navigatsiya" | "Tezkor Amallar" | "Tizim" | "Navigation" | "Quick Actions" | "System" | string;
  icon: React.ReactNode;
  shortcut?: string;
  perform: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tabId: NavTabId) => void;
  onToggleTheme: () => void;
  theme: "dark" | "light";
  onRefresh: () => void;
  onOpenNewStoreModal: () => void;
  isPlatformOwner?: boolean;
  onSwitchZone?: (zone: "store" | "platform") => void;
  onSelectPlatformSubTab?: (subTab: PlatformSubTabId) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectTab,
  onToggleTheme,
  theme,
  onRefresh,
  onOpenNewStoreModal,
  isPlatformOwner = false,
  onSwitchZone,
  onSelectPlatformSubTab,
}: CommandPaletteProps) {
  const { language, setLanguage, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Command items definition
  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: "tab-overview",
        title: "Boshqaruv Paneli (Overview)",
        subtitle: "Asosiy tahliliy ko'rsatkichlar va AI monitoring",
        category: "Navigatsiya",
        icon: <IconLayoutDashboard size={18} className="text-accent" />,
        shortcut: "G O",
        perform: () => onSelectTab("overview"),
      },
      {
        id: "tab-inbox",
        title: "Telegram Xabarlar (Inbox)",
        subtitle: "Jonli mijozlar dialogi va chat nazorati",
        category: "Navigatsiya",
        icon: <IconMessageDots size={18} className="text-info" />,
        shortcut: "G I",
        perform: () => onSelectTab("inbox"),
      },
      {
        id: "tab-orders",
        title: "Buyurtmalar (Orders)",
        subtitle: "Mijozlar buyurtmalari va to'lovlar oqimi",
        category: "Navigatsiya",
        icon: <IconShoppingCart size={18} className="text-success" />,
        shortcut: "G B",
        perform: () => onSelectTab("orders"),
      },
      {
        id: "tab-products",
        title: "Mahsulotlar Katalogi (Products)",
        subtitle: "Tovarlar, narxlar va qoldiqlar boshqaruvi",
        category: "Navigatsiya",
        icon: <IconPackage size={18} className="text-warning" />,
        shortcut: "G P",
        perform: () => onSelectTab("products"),
      },
      {
        id: "tab-customers",
        title: "Mijozlar Bazasi (Customers)",
        subtitle: "Telegram xaridorlari va LTV tarixi",
        category: "Navigatsiya",
        icon: <IconUsers size={18} className="text-primary" />,
        perform: () => onSelectTab("customers"),
      },
      {
        id: "tab-knowledge",
        title: "Bilimlar Bazasi (Knowledge)",
        subtitle: "AI javoblari uchun kontekst va qoidalar",
        category: "Navigatsiya",
        icon: <IconBooks size={18} className="text-secondary" />,
        perform: () => onSelectTab("knowledge"),
      },
      {
        id: "tab-billing",
        title: "Obuna va To'lovlar (Billing)",
        subtitle: "SaaS tarifi, balans va hisob-kitoblar",
        category: "Navigatsiya",
        icon: <IconSpeakerphone size={18} className="text-info" />,
        perform: () => onSelectTab("billing"),
      },
      {
        id: "tab-analytics",
        title: "Savdo Analitikasi (Analytics)",
        subtitle: "Konversiya, voronka va oylik daromad grafigi",
        category: "Navigatsiya",
        icon: <IconChartBar size={18} className="text-success" />,
        perform: () => onSelectTab("analytics"),
      },
      {
        id: "tab-settings",
        title: "AI & Tizim Sozlamalari (Settings)",
        subtitle: "Gemini parametrlari va bot webhook sozlamalari",
        category: "Navigatsiya",
        icon: <IconSettings size={18} className="text-warning" />,
        perform: () => onSelectTab("settings"),
      },
      {
        id: "tab-team",
        title: "Jamoa va Rollar (Team)",
        subtitle: "Operatorlar, menejerlar va ruxsatlar",
        category: "Navigatsiya",
        icon: <IconUserCheck size={18} className="text-primary" />,
        perform: () => onSelectTab("team"),
      },
      {
        id: "tab-logs",
        title: "Tizim Qaydlari (Logs)",
        subtitle: "Audit loglari va xatoliklar jurnali",
        category: "Navigatsiya",
        icon: <IconFileText size={18} className="text-secondary" />,
        perform: () => onSelectTab("logs"),
      },
      {
        id: "tab-profile",
        title: "Admin Profili va Dizayn (Profile)",
        subtitle: "Mavzu, dizayn tizimlari va Olline/Pogonia shriftlari",
        category: "Navigatsiya",
        icon: <IconUser size={18} className="text-accent" />,
        perform: () => onSelectTab("profile"),
      },

      // Quick Actions
      {
        id: "action-theme",
        title: theme === "dark" 
          ? (language === "uz" ? "Yorug' Mavzuga O'tish (Light Mode)" : "Switch to Light Mode")
          : (language === "uz" ? "Qorong'i Mavzuga O'tish (Dark Mode)" : "Switch to Dark Mode"),
        subtitle: language === "uz" ? "Interfeys rang rejimini almashtirish" : "Toggle interface color appearance",
        category: language === "uz" ? "Tezkor Amallar" : "Quick Actions",
        icon: theme === "dark" ? <IconSun size={18} className="text-warning" /> : <IconMoon size={18} className="text-info" />,
        shortcut: "T",
        perform: onToggleTheme,
      },
      {
        id: "action-language",
        title: language === "uz" ? "Tilni Inglizchaga O'tkazish (Switch to English)" : "O'zbek Tiliga O'tish (Switch to Uzbek)",
        subtitle: language === "uz" ? "Barcha interfeys matnlarini to'liq ingliz tiliga o'tkazish" : "Switch interface language to Uzbek",
        category: language === "uz" ? "Tezkor Amallar" : "Quick Actions",
        icon: <IconSparkles size={18} className="text-accent" />,
        shortcut: "L",
        perform: () => setLanguage(language === "uz" ? "en" : "uz"),
      },
      {
        id: "action-new-store",
        title: "Yangi Do'kon Qo'shish (New Store)",
        subtitle: "Yangi tenant tashkilotini ro'yxatdan o'tkazish",
        category: "Tezkor Amallar",
        icon: <IconPlus size={18} className="text-success" />,
        shortcut: "N",
        perform: onOpenNewStoreModal,
      },
      {
        id: "action-refresh",
        title: "Ma'lumotlarni Yangilash (Sync)",
        subtitle: "Serverdan real-vaqt yangilanishlarini tortib olish",
        category: "Tezkor Amallar",
        icon: <IconRefresh size={18} className="text-primary" />,
        shortcut: "R",
        perform: onRefresh,
      },
    ];

    if (isPlatformOwner) {
      list.unshift({
        id: "action-platform-owner",
        title: "Platforma Egasi Nazorati (Platform Owner)",
        subtitle: "Barcha tenantlar, hisob-kitoblar va global audit",
        category: "Tizim",
        icon: <IconShieldLock size={18} className="text-danger" />,
        perform: () => {
          if (onSwitchZone) onSwitchZone("platform");
          if (onSelectPlatformSubTab) onSelectPlatformSubTab("overview");
        },
      });
    }

    return list;
  }, [
    onSelectTab,
    onToggleTheme,
    theme,
    onOpenNewStoreModal,
    onRefresh,
    isPlatformOwner,
    onSwitchZone,
    onSelectPlatformSubTab,
  ]);

  // Filtered by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.subtitle?.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].perform();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tezkor Buyruqlar Paneli (Command Palette)"
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-start justify-content-center p-3"
      style={{
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rounded-3 border overflow-hidden d-flex flex-column shadow-lg"
        style={{
          width: "100%",
          maxWidth: "600px",
          marginTop: "12vh",
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
        }}
      >
        {/* Search Input Bar */}
        <div
          className="d-flex align-items-center px-3 py-2.5 border-bottom gap-2"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <IconSearch size={18} style={{ color: "var(--text-tertiary)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={language === "uz" ? "Buyruq qidiring yoki bo'limga o'ting... (Esc - yopish)" : "Type a command or search... (Esc to close)"}
            className="border-0 bg-transparent flex-grow-1 text-primary"
            style={{
              outline: "none",
              fontSize: "0.95rem",
              color: "var(--text-primary)",
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="btn btn-sm btn-link p-0 text-secondary"
            >
              <IconX size={16} />
            </button>
          ) : (
            <span
              className="badge rounded-1 font-monospace px-1.5 py-0.5 border"
              style={{
                fontSize: "0.7rem",
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="custom-scrollbar overflow-y-auto p-1.5"
          style={{ maxHeight: "360px" }}
        >
          {filteredItems.length === 0 ? (
            <div className="py-4 text-center text-secondary small">
              "{query}" bo'yicha hech qanday buyruq topilmadi
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.perform();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className="d-flex align-items-center justify-content-between px-3 py-2 rounded-2 cursor-pointer transition-fast"
                  style={{
                    backgroundColor: isSelected ? "var(--bg-surface-hover)" : "transparent",
                    color: "var(--text-primary)",
                  }}
                >
                  <div className="d-flex align-items-center gap-2.5 text-truncate">
                    <span className="d-flex align-items-center">{item.icon}</span>
                    <div className="d-flex flex-column text-truncate">
                      <span className="fw-medium text-truncate" style={{ fontSize: "0.85rem" }}>
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-secondary text-truncate" style={{ fontSize: "0.74rem" }}>
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                    {item.shortcut && (
                      <span
                        className="badge font-monospace px-1 py-0.5 border"
                        style={{
                          fontSize: "0.68rem",
                          backgroundColor: "var(--bg-surface-elevated)",
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {item.shortcut}
                      </span>
                    )}
                    {isSelected && (
                      <IconCornerDownLeft size={14} style={{ color: "var(--accent)" }} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2 border-top text-secondary small"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--bg-surface-elevated)",
            fontSize: "0.72rem",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded border me-1">↑</kbd>
              <kbd className="px-1 py-0.5 rounded border me-1">↓</kbd> Tanlash
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border me-1">↵</kbd> Kirish
            </span>
          </div>
          <span>
            <IconSparkles size={12} className="text-accent me-1" />
            Telegram AI Sales Control Center
          </span>
        </div>
      </div>
    </div>
  );
}
