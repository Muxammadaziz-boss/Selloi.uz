"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  IconActivity,
  IconAdjustments,
  IconAlertCircle,
  IconArrowUpRight,
  IconArrowRight,
  IconBolt,
  IconBrandApple,
  IconBrandTelegram,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconCrown,
  IconDatabase,
  IconDeviceMobile,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFilter,
  IconHeadset,
  IconHelpCircle,
  IconHistory,
  IconKey,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLock,
  IconLogout,
  IconMessageDots,
  IconMessages,
  IconMoon,
  IconPackage,
  IconPalette,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSend,
  IconServer,
  IconSettings,
  IconShieldCheck,
  IconShieldLock,
  IconShoppingCart,
  IconSparkles,
  IconSun,
  IconTrash,
  IconTrendingUp,
  IconTypography,
  IconUpload,
  IconUser,
  IconUserCheck,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
  IconX,
  IconBuildingSkyscraper,
  IconGauge,
  IconCreditCard,
  IconCoin,
  IconChartBar,
} from "@tabler/icons-react";

import { ConfirmModal } from "./components/ui/ConfirmModal";
import { Toast, ToastContainer } from "./components/ui/Toast";
import { Skeleton } from "./components/ui/Skeleton";
import { AppShell } from "./components/layout/AppShell";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { InboxTab } from "./components/tabs/InboxTab";
import { DesignProvider } from "./components/design/DesignContext";
import { LanguageProvider, useLanguage } from "./lib/i18n";
import { playNotificationChime, showBrowserNotification } from "../lib/sound";
import {
  type AdminUser,
  type ConnectedChannel,
  type Conversation,
  type DashboardProps,
  type DashboardTabId,
  type DashboardUser,
  type KnowledgePost,
  type Message,
  type OrderItem,
  type Overview,
  type PendingConfirmState,
  type ProductItem,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  PERMISSION_CATEGORIES_EN,
  PERMISSION_CATEGORIES_UZ,
  PERMISSION_LABELS_EN,
  PERMISSION_LABELS_UZ,
  api,
  cleanTelegramUsername,
  formatChatTime,
  timeLabel,
} from "./lib/dashboardApi";
import { usePlatformData } from "./hooks/usePlatformData";
import { useStoreAutomation } from "./hooks/useStoreAutomation";
import { useChatAndCatalogActions } from "./hooks/useChatAndCatalogActions";
import type { StorePaymentConfigData } from "./components/settings/StorePaymentSettingsCard";
import type { FollowupBundle } from "./components/settings/SmartFollowupSettingsCard";
import type { StoreReportBundle } from "./components/settings/DailyReportSettingsCard";

export type { DashboardUser, DashboardProps };

function TabPanelSkeleton() {
  return (
    <div className="linear-card p-4 space-y-3">
      <Skeleton width={220} height={22} />
      <Skeleton width="60%" height={14} />
      <div className="row g-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="col-12 col-md-4">
            <div className="linear-card p-3 space-y-2">
              <Skeleton width="50%" height={14} />
              <Skeleton width="80%" height={24} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const UsageTab = dynamic(() => import("./components/saas/UsageTab").then((m) => m.UsageTab), {
  loading: () => <TabPanelSkeleton />,
});
const BillingTab = dynamic(() => import("./components/saas/BillingTab").then((m) => m.BillingTab), {
  loading: () => <TabPanelSkeleton />,
});
const PricingTab = dynamic(() => import("./components/saas/PricingTab").then((m) => m.PricingTab), {
  loading: () => <TabPanelSkeleton />,
});
const PlatformOwnerTab = dynamic(
  () => import("./components/saas/PlatformOwnerTab").then((m) => m.PlatformOwnerTab),
  { loading: () => <TabPanelSkeleton /> }
);
const OnboardingModal = dynamic(
  () => import("./components/saas/OnboardingModal").then((m) => m.OnboardingModal),
  { ssr: false }
);
const UpgradeModal = dynamic(
  () => import("./components/saas/UpgradeModal").then((m) => m.UpgradeModal),
  { ssr: false }
);
const KnowledgeTab = dynamic(
  () => import("./components/tabs/KnowledgeTab").then((m) => m.KnowledgeTab),
  { loading: () => <TabPanelSkeleton /> }
);
const ProductsTab = dynamic(
  () => import("./components/tabs/ProductsTab").then((m) => m.ProductsTab),
  { loading: () => <TabPanelSkeleton /> }
);
const OrdersTab = dynamic(
  () => import("./components/tabs/OrdersTab").then((m) => m.OrdersTab),
  { loading: () => <TabPanelSkeleton /> }
);
const CustomersTab = dynamic(
  () => import("./components/tabs/CustomersTab").then((m) => m.CustomersTab),
  { loading: () => <TabPanelSkeleton /> }
);
const AnalyticsTab = dynamic(
  () => import("./components/tabs/AnalyticsTab").then((m) => m.AnalyticsTab),
  { loading: () => <TabPanelSkeleton /> }
);
const SettingsTab = dynamic(
  () => import("./components/tabs/SettingsTab").then((m) => m.SettingsTab),
  { loading: () => <TabPanelSkeleton /> }
);
const AdminsTab = dynamic(
  () => import("./components/tabs/AdminsTab").then((m) => m.AdminsTab),
  { loading: () => <TabPanelSkeleton /> }
);
const TeamTab = dynamic(
  () => import("./components/tabs/TeamTab").then((m) => m.TeamTab),
  { loading: () => <TabPanelSkeleton /> }
);
const LogsTab = dynamic(
  () => import("./components/tabs/LogsTab").then((m) => m.LogsTab),
  { loading: () => <TabPanelSkeleton /> }
);
const ProfileTab = dynamic(
  () => import("./components/tabs/ProfileTab").then((m) => m.ProfileTab),
  { loading: () => <TabPanelSkeleton /> }
);

function AppLogo({
  src,
  size = "md",
  className = "",
}: {
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const currentSrc = src || "/logo.svg";

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const dims = {
    sm: { size: 28 },
    md: { size: 38 },
    lg: { size: 52 },
    xl: { size: 68 },
  }[size];

  if (imgError) {
    return (
      <span
        className={`avatar bg-primary text-white rounded-3 shadow-sm ${className}`}
        style={{
          width: dims.size,
          height: dims.size,
          minWidth: dims.size,
        }}
      >
        <IconSparkles size={Math.round(dims.size * 0.55)} />
      </span>
    );
  }

  return (
    <div
      className={`app-brand-logo-container ${className}`}
      style={{
        width: dims.size,
        height: dims.size,
        minWidth: dims.size,
      }}
    >
      <img
        src={currentSrc}
        alt="Brand Logo"
        width={dims.size}
        height={dims.size}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}

const DEFAULT_TG_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'><rect width='44' height='44' rx='22' fill='%236366f1'/><text x='50%' y='54%' font-size='14' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle'>TG</text></svg>";

const FONT_OPTIONS = [
  {
    id: "olline",
    name: "Olline",
    styleTag: "Geometric Bold",
    isNew: true,
    fontFamily: "'Olline', 'Outfit', 'Syne', sans-serif",
    description: "Zamonaviy geometrik qalin va kuchli vizual dizayn shrifti",
  },
  {
    id: "pogonia",
    name: "Pogonia",
    styleTag: "Aesthetic Rounded",
    isNew: true,
    fontFamily: "'Pogonia', 'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif",
    description: "Estetik yumaloq neo-grotesk va zamonaviy iliq shrift",
  },
  {
    id: "inter",
    name: "Inter",
    styleTag: "Standard Default",
    isNew: false,
    fontFamily: "'Inter', sans-serif",
    description: "Standart neytral va professional tizimli interfeys shrifti",
  },
  {
    id: "sf-pro",
    name: "SF Pro",
    styleTag: "Apple iOS",
    isNew: false,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    description: "Apple iOS ekotizimining toza va silliq tizim shrifti",
  },
  {
    id: "jakarta",
    name: "Plus Jakarta",
    styleTag: "SaaS Modern",
    isNew: false,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    description: "Zamonaviy texnologik startaplar va panellar shrifti",
  },
];

function TelegramUserAvatar({
  userId,
  name,
  size = "md",
  className = "",
  isSelected = false,
}: {
  userId?: number | string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  isSelected?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [userId]);

  const sizeMap = {
    xs: { className: "avatar-xs", iconSize: 13, px: 24 },
    sm: { className: "avatar-sm", iconSize: 16, px: 32 },
    md: { className: "", iconSize: 20, px: 38 },
    lg: { className: "avatar-lg", iconSize: 26, px: 48 },
    xl: { className: "avatar-xl", iconSize: 34, px: 64 },
  }[size];

  const hasAvatar = Boolean(userId) && !imgError;
  const avatarUrl = userId ? `/api/proxy?path=/admin/users/${userId}/avatar` : "";

  return (
    <span
      className={`avatar ${sizeMap.className} rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0 overflow-hidden ${className}`}
      style={{
        background: isSelected
          ? "#ffffff"
          : "linear-gradient(135deg, rgba(34, 158, 217, 0.22) 0%, rgba(0, 136, 204, 0.12) 100%)",
        color: isSelected ? "#0088cc" : "#229ed9",
        border: isSelected ? "none" : "1px solid rgba(34, 158, 217, 0.3)",
        boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
        width: sizeMap.px,
        height: sizeMap.px,
        minWidth: sizeMap.px,
      }}
      title={name || "Telegram Foydalanuvchisi"}
    >
      {hasAvatar ? (
        <img
          src={avatarUrl}
          alt={name || "Avatar"}
          width={sizeMap.px}
          height={sizeMap.px}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgError(true)}
        />
      ) : (
        <IconBrandTelegram size={sizeMap.iconSize} />
      )}
    </span>
  );
}

function MiniSparkline({
  data,
  color = "#206bc4",
  id,
  height = 36,
}: {
  data: number[];
  color?: string;
  id: string;
  height?: number;
}) {
  const width = 140;
  const safeData = data.length >= 2 ? data : [data[0] || 0, data[0] || 0];
  const min = Math.min(...safeData);
  const max = Math.max(...safeData) || 1;
  const range = max - min || 1;
  const padding = 3;
  const effectiveHeight = height - padding * 2;

  const points = safeData.map((val, idx) => {
    const x = (idx / (safeData.length - 1)) * width;
    const y = height - padding - ((val - min) / range) * effectiveHeight;
    return { x, y };
  });

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }

  const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const lastPoint = points[points.length - 1];
  const topPct = (lastPoint.y / height) * 100;

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="sparkline-svg"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          <linearGradient id={`sparkGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#sparkGrad-${id})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Standalone HTML circular dot: perfectly round, immune to SVG non-uniform aspect ratio stretch */}
      <div
        className="sparkline-dot"
        style={{
          position: "absolute",
          right: "2px",
          top: `calc(${topPct}% - 4px)`,
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 0 3px ${color}33, 0 0 8px ${color}99`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function DashboardContent({
  initialAuthenticated = false,
  initialUser = null,
  initialZone,
  initialTenantSlug,
  initialTab,
  initialPlan,
}: DashboardProps) {
  const { language, setLanguage, t } = useLanguage();
  const permissionLabels = language === "uz" ? PERMISSION_LABELS_UZ : PERMISSION_LABELS_EN;
  const permissionCategories = language === "uz" ? PERMISSION_CATEGORIES_UZ : PERMISSION_CATEGORIES_EN;
  const [currentUser, setCurrentUser] = useState<DashboardUser | null>(initialUser);
  const isPlatformOwner = Boolean(currentUser?.isPlatformOwner);
  const isPlatformAdmin = Boolean(currentUser?.isPlatformAdmin);
  const hasPlatformAccess = isPlatformOwner || isPlatformAdmin;

  const [zone, setZone] = useState<"platform" | "tenant">(() => {
    if (initialZone) {
      return initialZone === "platform" && !hasPlatformAccess ? "tenant" : initialZone;
    }
    return hasPlatformAccess ? "platform" : "tenant";
  });

  const [isOwnerImpersonating, setIsOwnerImpersonating] = useState<boolean>(false);

  const [activeStoreMeta, setActiveStoreMeta] = useState<{ id: number; name: string; slug: string } | null>(null);

  const [tenantLogs, setTenantLogs] = useState<any[]>([]);

  const [tab, setTab] = useState<DashboardTabId>(() => {
    const valid = [
      "overview", "inbox", "knowledge", "products", "orders", "customers",
      "analytics", "settings", "admins", "team", "logs", "profile",
      "usage", "billing", "pricing", "platform"
    ];
    if (initialTab && valid.includes(initialTab)) {
      return initialTab;
    }
    return "overview";
  });

  // SaaS Multi-Tenant & Subscription States
  const [userOrganizations, setUserOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<number>(initialUser?.organizationId || 1);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmState | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState<boolean>(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [upgradeModalConfig, setUpgradeModalConfig] = useState<{
    isOpen: boolean;
    featureName?: string;
    requiredPlan?: string;
    message?: string;
  }>({ isOpen: false });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [uiStyle, setUiStyle] = useState<"tabler" | "ios">("tabler");
  const [appFont, setAppFont] = useState<string>("olline");
  const [logoUrl, setLogoUrl] = useState<string>("/logo.svg");
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string>("");
  const [activeAdminTelegramId, setActiveAdminTelegramId] = useState<number>(() => initialUser?.telegramUserId || 0);
  const [loginTelegramId, setLoginTelegramId] = useState<string>("");
  const [navAvatarError, setNavAvatarError] = useState(false);
  const [profileAvatarError, setProfileAvatarError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [customLogoInput, setCustomLogoInput] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [posts, setPosts] = useState<KnowledgePost[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [channel, setChannel] = useState<string>("");
  const [channels, setChannels] = useState<ConnectedChannel[]>([]);
  const [newChannelInput, setNewChannelInput] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<ProductItem>>({
    category: "Gaming",
    stock: "In Stock",
    warranty: "2 oy kafolat",
  });

  const [inboxFilter, setInboxFilter] = useState<"all" | "ai" | "human">("all");
  const [inboxSearch, setInboxSearch] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [productSearch, setProductSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [customerNotes, setCustomerNotes] = useState<Record<number, string>>({});

  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [infoToast, setInfoToast] = useState("");
  const [sseConnected, setSseConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const soundHydratedRef = useRef(false);

  const selectedRef = useRef<number | null>(selected);
  const tabRef = useRef<string>(tab);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    if (!soundHydratedRef.current) {
      soundHydratedRef.current = true;
      try {
        const saved = localStorage.getItem("selloi_sound_alerts");
        if (saved !== null) {
          const val = saved !== "false";
          soundEnabledRef.current = val;
          setSoundEnabled(val);
          return;
        }
      } catch {}
    }
    soundEnabledRef.current = soundEnabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("selloi_sound_alerts", soundEnabled ? "true" : "false");
    }
  }, [soundEnabled]);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        playNotificationChime("message");
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Auto-dismiss notification toasts after 4 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (infoToast) {
      const timer = setTimeout(() => setInfoToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [infoToast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    const planParam = params.get("plan") || initialPlan;

    if (statusParam === "promo_success") {
      setSuccess("7 kunlik Mega Chegirma to'lovi muvaffaqiyatli qabul qilindi va faollashtirildi!");
    } else if (statusParam === "sub_success") {
      setSuccess("Obuna to'lovi muvaffaqiyatli qabul qilindi!");
    } else if (statusParam === "success") {
      setSuccess("To'lov muvaffaqiyatli amalga oshirildi!");
    } else if (statusParam === "cancelled") {
      setError("To'lov bekor qilindi.");
    }

    if (planParam) {
      const validPlans = ["start", "standard", "standart", "pro", "ultra"];
      if (validPlans.includes(planParam.toLowerCase())) {
        setTab("billing");
      }
    }
  }, [initialPlan]);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // New admin form state
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"admin" | "moderator">("moderator");
  const [managingPermissionsAdmin, setManagingPermissionsAdmin] = useState<AdminUser | null>(null);

  // AI settings state
  const [aiModel, setAiModel] = useState("gemini-3.1-flash-lite");
  const [aiTemperature, setAiTemperature] = useState(0.2);
  const [autoHandoff, setAutoHandoff] = useState(true);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [doubleConfirmation, setDoubleConfirmation] = useState(true);

  const loadMessages = useCallback(async (id: number) => {
    try {
      setMessages(await api<Message[]>(`/admin/conversations/${id}/messages`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xabarlar yuklanmadi");
    }
  }, []);

  const {
    storePaymentConfig,
    setStorePaymentConfig,
    followupBundle,
    setFollowupBundle,
    reportBundle,
    setReportBundle,
    currentOrgDetails,
    setCurrentOrgDetails,
    botTokenInput,
    setBotTokenInput,
    showBotToken,
    setShowBotToken,
    botTokenVerifying,
    botTokenResult,
    customPromptInput,
    setCustomPromptInput,
    telegramApiIdInput,
    setTelegramApiIdInput,
    telegramApiHashInput,
    setTelegramApiHashInput,
    telegramPhoneInput,
    setTelegramPhoneInput,
    adminChatIdInput,
    setAdminChatIdInput,
    showApiHash,
    setShowApiHash,
    webhookSetting,
    webhookStatusChecking,
    webhookInfo,
    savingOrgSettings,
    handleVerifyBotToken,
    handleSaveBotSettings,
    handleSetWebhook,
    handleCheckWebhookStatus,
    handleRunAiPlayground,
    handleOpenPlayground,
    handleSaveStorePaymentConfig,
    handleSendOrderPayment,
    handleSendConversationPayment,
    handleMarkOrderPaid,
    handleCheckOrderPayment,
    handleSaveFollowupConfig,
    handlePreviewFollowup,
    handleRunFollowupNow,
    handleSaveReportConfig,
    handlePreviewDailyReport,
    handleSendDailyReportNow,
  } = useStoreAutomation({
    activeOrgId,
    selectedConversationId: selected,
    setTab,
    setOrders,
    loadMessages,
    setSuccess,
    setError,
    setInfoToast,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [o, c, p, a, s, chList, prodsList, ordersList, tenantLogsRes, storePayCfg, followupRes, reportRes] = await Promise.all([
        api<Overview>("/admin/overview"),
        api<Conversation[]>("/admin/conversations"),
        api<KnowledgePost[]>("/admin/knowledge"),
        api<AdminUser[]>("/admin/admins").catch(() => []),
        api<{ public_channel?: string }>("/admin/settings").catch(() => ({ public_channel: "" })),
        api<ConnectedChannel[]>("/admin/channels").catch(() => []),
        api<ProductItem[]>("/admin/products").catch(() => []),
        api<OrderItem[]>("/admin/orders").catch(() => []),
        api<{ logs?: any[] }>("/admin/logs").catch(() => ({ logs: [] })),
        api<StorePaymentConfigData>("/admin/payments/config").catch(() => null),
        api<FollowupBundle>("/admin/followup/config").catch(() => null),
        api<StoreReportBundle>("/admin/reports/config").catch(() => null),
      ]);
      setOverview(o);
      setConversations(c);
      setPosts(p);
      setAdmins(a);
      setChannels(chList);
      setProducts(prodsList || []);
      setOrders(ordersList || []);
      setTenantLogs(tenantLogsRes?.logs || []);
      setStorePaymentConfig(storePayCfg);
      setFollowupBundle(followupRes);
      setReportBundle(reportRes);
      const serverNotes: Record<number, string> = {};
      (c || []).forEach((conv) => {
        if (conv.note) {
          serverNotes[conv.id] = conv.note;
        }
      });
      setCustomerNotes(serverNotes);
      if (chList.length > 0) {
        setChannel(chList[0].channel_username);
      } else if (s?.public_channel) {
        setChannel(s.public_channel);
      } else if (p.length > 0 && p[0].channel_username) {
        setChannel(p[0].channel_username);
      }
      setSelected((curr) => curr ?? c[0]?.id ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ma'lumotlarni yuklab bo'lmadi";
      if (!hasPlatformAccess && msg.includes("ruxsati mavjud emas")) {
        setShowOnboardingModal(true);
        setInfoToast("Ishni boshlash uchun birinchi do'koningizni yarating.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [hasPlatformAccess, setFollowupBundle, setReportBundle, setStorePaymentConfig]);

  const {
    perform,
    sendReply,
    handleSaveCustomerNote,
    handleSendCatalogProposal,
    handleSendDiscountProposal,
    handleDeletePost,
    handleSaveProductEdit,
    handleCreateProduct,
    handleExtractProductsFromPosts,
    handleUpdateOrderStatus,
    handleDeleteOrder,
    handleDeleteProduct,
    handleSyncKnowledge,
    handleConnectChannel,
    handleSyncChannel,
    handleDeleteChannel,
  } = useChatAndCatalogActions({
    selected,
    draft,
    setDraft,
    setBusy,
    setSuccess,
    setError,
    load,
    loadMessages,
    products,
    setProducts,
    editingProduct,
    setEditingProduct,
    newProduct,
    setNewProduct,
    setIsAddingProduct,
    setOrders,
    setPosts,
    setConversations,
    setCustomerNotes,
    newChannelInput,
    setNewChannelInput,
    setPendingConfirm,
  });

  const loadSaaSDataRef = useRef<(orgId?: number) => Promise<void>>(async () => {});
  const loadSaaSDataBridge = useCallback((orgId?: number) => loadSaaSDataRef.current(orgId), []);

  const {
    platformMetrics,
    setPlatformMetrics,
    platformOrgs,
    setPlatformOrgs,
    platformUsers,
    systemHealth,
    auditLogs,
    platformSubTab,
    setPlatformSubTab,
    loadPlatformData,
    handleUpdatePlanConfig,
    handleEnterStore,
    handleExitStore,
    handleAppointSiteAdmin,
    handleToggleSiteAdmin,
    handleToggleUserStatus,
    handleCreateStore,
    handleUpdateStoreStatus,
    handleDeleteStore,
    handleInspectStore,
    handleUpdateStoreSubscription,
    handleSendPlatformDailyReport,
    handleSendPlatformBroadcast,
  } = usePlatformData({
    zone,
    activeOrgId,
    setActiveOrgId,
    setZone,
    setTab,
    setLoading,
    setBusy,
    setSuccess,
    setError,
    setActiveStoreMeta,
    setIsOwnerImpersonating,
    setPendingConfirm,
    loadStoreData: load,
    loadSaaSData: loadSaaSDataBridge,
  });

  useEffect(() => {
    if (!authenticated) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.authenticated) {
            setAuthenticated(true);
            if (data.user) {
              setCurrentUser(data.user);
              if ((data.user.isPlatformOwner || data.user.isPlatformAdmin) && !initialZone) {
                setZone("platform");
              }
            }
          }
        })
        .catch(() => {})
        .finally(() => clearTimeout(timer));
    }
  }, [authenticated, initialZone]);

  const urlSyncDoneRef = useRef(false);

  // Hydrate client-only storage/URL state after SSR mount to prevent React hydration mismatches
  useEffect(() => {
    try {
      const imp = localStorage.getItem("owner_impersonating_store");
      if (imp) {
        setIsOwnerImpersonating(true);
        setActiveStoreMeta(JSON.parse(imp));
      }
    } catch {}
    try {
      const qOrg = new URLSearchParams(window.location.search).get("org");
      const sessionSaved = sessionStorage.getItem("active_org_id");
      const saved = localStorage.getItem("active_org_id");
      const rawOrg = qOrg || sessionSaved || saved;
      if (rawOrg && !isNaN(parseInt(rawOrg, 10))) {
        setActiveOrgId(parseInt(rawOrg, 10));
      }
    } catch {}
  }, []);

  // Synchronize tab with URL hash on mount and hashchange
  useEffect(() => {
    const validTabs: Array<typeof tab> = [
      "overview",
      "inbox",
      "knowledge",
      "products",
      "orders",
      "customers",
      "analytics",
      "settings",
      "admins",
      "team",
      "logs",
      "profile",
      "usage",
      "billing",
      "pricing",
      "platform",
    ];

    const syncFromUrl = () => {
      if (typeof window === "undefined") return;
      const onAdminPath = window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/platform");
      const onCustomerOnlyPath =
        window.location.pathname.startsWith("/dashboard") || window.location.pathname.startsWith("/settings");

      if (hasPlatformAccess && onCustomerOnlyPath) {
        window.location.replace("/admin");
        return;
      }

      if (onAdminPath && hasPlatformAccess) {
        setZone("platform");
      } else if (window.location.pathname.startsWith("/t/") || window.location.pathname.startsWith("/dashboard")) {
        setZone("tenant");
      }
      const h = window.location.hash.replace("#", "") as (typeof validTabs)[number];
      if (h && validTabs.includes(h)) {
        if (h === "platform") {
          if (hasPlatformAccess) {
            setTab("platform");
            setZone("platform");
          } else {
            setTab("overview");
            setZone("tenant");
          }
        } else if (onAdminPath && hasPlatformAccess && h === "profile") {
          setTab("profile");
          setZone("platform");
        } else {
          setTab(h);
          if (h !== "profile") {
            setZone("tenant");
          }
        }
      } else if (window.location.pathname.startsWith("/settings/billing")) {
        setTab("billing");
      } else if (window.location.pathname.startsWith("/settings")) {
        setTab("settings");
      } else {
        const qTab = new URLSearchParams(window.location.search).get("tab") as (typeof validTabs)[number] | null;
        if (qTab && validTabs.includes(qTab)) {
          setTab(qTab);
        }
      }
    };

    syncFromUrl();
    urlSyncDoneRef.current = true;
    window.addEventListener("hashchange", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("hashchange", syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  // Sync window URL hash when tab changes
  useEffect(() => {
    if (!urlSyncDoneRef.current) return;
    if (typeof window !== "undefined") {
      const targetHash = `#${tab}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, "", targetHash);
      }
    }
  }, [tab]);

  // Real-time Server-Sent Events stream scoped to active tenant organization
  useEffect(() => {
    if (!authenticated || zone === "platform" || typeof EventSource === "undefined") {
      setSseConnected(false);
      return;
    }

    const orgIdParam = activeOrgId || currentUser?.organizationId || 1;
    const streamUrl = `/api/events?organization_id=${encodeURIComponent(String(orgIdParam))}`;
    const source = new EventSource(streamUrl);

    const refreshInboxSummary = () => {
      api<Overview>("/admin/overview").then(setOverview).catch(() => {});
      api<Conversation[]>("/admin/conversations").then(setConversations).catch(() => {});
    };

    const parsePayload = (ev: MessageEvent): any => {
      try {
        return JSON.parse(ev.data || "{}");
      } catch {
        return {};
      }
    };

    source.onopen = () => {
      setSseConnected(true);
    };

    source.addEventListener("connected", () => {
      setSseConnected(true);
    });

    source.addEventListener("message.created", (ev) => {
      const data = parsePayload(ev as MessageEvent);
      refreshInboxSummary();
      const targetConvId = Number(data.conversation_id || 0);
      if (targetConvId > 0 && selectedRef.current === targetConvId) {
        void loadMessages(targetConvId);
      }
      if (data.direction === "customer") {
        if (soundEnabledRef.current) {
          playNotificationChime("message");
        }
        const customerLabel = String(data.customer_name || "Mijoz");
        const snippet = String(data.text || "").slice(0, 75);
        if (tabRef.current !== "inbox" || selectedRef.current !== targetConvId) {
          setInfoToast(`${customerLabel}: ${snippet}`);
        }
        showBrowserNotification(`Yangi xabar: ${customerLabel}`, snippet);
      }
    });

    source.addEventListener("conversation.updated", () => {
      refreshInboxSummary();
    });

    source.addEventListener("handoff.required", (ev) => {
      const data = parsePayload(ev as MessageEvent);
      refreshInboxSummary();
      if (soundEnabledRef.current) {
        playNotificationChime("handoff");
      }
      const customerLabel = String(data.customer_name || "Mijoz");
      const reason = data.reason ? ` (${String(data.reason).slice(0, 60)})` : "";
      setInfoToast(`Operator kerak: ${customerLabel}${reason}`);
      showBrowserNotification("Operator yordami kerak", `${customerLabel}${reason}`);
    });

    source.addEventListener("order.created", (ev) => {
      const data = parsePayload(ev as MessageEvent);
      refreshInboxSummary();
      api<OrderItem[]>("/admin/orders").then(setOrders).catch(() => {});
      if (soundEnabledRef.current) {
        playNotificationChime("order");
      }
      const customerLabel = String(data.customer_name || "Mijoz");
      const prod = data.product_summary ? ` - ${String(data.product_summary).slice(0, 50)}` : "";
      setSuccess(`Yangi buyurtma: ${customerLabel}${prod}`);
      showBrowserNotification("Yangi buyurtma!", `${customerLabel}${prod}`);
    });

    source.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      setSseConnected(false);
      source.close();
    };
  }, [authenticated, zone, activeOrgId, currentUser?.organizationId, loadMessages]);

  // Fallback polling every 30 seconds only when SSE is disconnected
  useEffect(() => {
    if (!authenticated || zone === "platform" || sseConnected) return;
    const interval = setInterval(() => {
      api<Overview>("/admin/overview").then(setOverview).catch(() => {});
      api<Conversation[]>("/admin/conversations").then(setConversations).catch(() => {});
      if (selectedRef.current !== null) {
        void loadMessages(selectedRef.current);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [authenticated, zone, sseConnected, loadMessages]);

  useEffect(() => {
    if (authenticated && selected !== null) void loadMessages(selected);
  }, [authenticated, selected, loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Modal Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLogoModal) setShowLogoModal(false);
        if (showOnboardingModal) setShowOnboardingModal(false);
        if (upgradeModalConfig.isOpen) setUpgradeModalConfig({ isOpen: false });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLogoModal, showOnboardingModal, upgradeModalConfig.isOpen]);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      const savedStyle = localStorage.getItem("ai_sales_ui_style") as "tabler" | "ios" | null;
      if (savedStyle === "ios" || savedStyle === "tabler") {
        setUiStyle(savedStyle);
        document.documentElement.setAttribute("data-ui-style", savedStyle);
      } else {
        document.documentElement.setAttribute("data-ui-style", "tabler");
      }
      const savedFont = localStorage.getItem("ai_sales_app_font") || "quicksand";
      setAppFont(savedFont);
      document.documentElement.setAttribute("data-font", savedFont);
    } catch {}
  }, []);

  const handleSelectFont = (fontId: string) => {
    setAppFont(fontId);
    document.documentElement.setAttribute("data-font", fontId);
    try {
      localStorage.setItem("ai_sales_app_font", fontId);
    } catch {}
  };

  const toggleUiStyle = () => {
    const next = uiStyle === "tabler" ? "ios" : "tabler";
    setUiStyle(next);
    document.documentElement.setAttribute("data-ui-style", next);
    try {
      localStorage.setItem("ai_sales_ui_style", next);
    } catch {}
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.setAttribute("data-bs-theme", next);
    if (next === "light") {
      document.documentElement.classList.remove("theme-dark");
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
      document.documentElement.classList.add("theme-dark");
    }
    try {
      localStorage.setItem("ai_sales_theme", next);
    } catch {}
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_sales_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ai_sales_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    try {
      const savedLogo = localStorage.getItem("ai_sales_custom_logo");
      if (savedLogo) {
        setLogoUrl(savedLogo);
        setCustomLogoInput(savedLogo);
      }
    } catch {}
  }, []);

  function handleLogoUpload(file: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setLogoUrl(result);
        setCustomLogoInput(result);
        try {
          localStorage.setItem("ai_sales_custom_logo", result);
        } catch {}
        setSuccess("Logotip muvaffaqiyatli o'rnatildi!");
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSaveLogoUrl(url: string) {
    const trimmed = url.trim() || "/logo.svg";
    setLogoUrl(trimmed);
    try {
      if (trimmed === "/logo.svg") {
        localStorage.removeItem("ai_sales_custom_logo");
      } else {
        localStorage.setItem("ai_sales_custom_logo", trimmed);
      }
    } catch {}
    setSuccess("Logotip yangilandi!");
  }

  useEffect(() => {
    try {
      const savedAdminId = localStorage.getItem("ai_sales_active_admin_id");
      if (savedAdminId && !isNaN(Number(savedAdminId))) {
        setActiveAdminTelegramId(Number(savedAdminId));
        setLoginTelegramId(savedAdminId);
      }
      const savedAvatar = localStorage.getItem("ai_sales_admin_avatar");
      if (savedAvatar) {
        setAdminAvatarUrl(savedAvatar);
      }
    } catch {}
  }, []);



  function handleAdminAvatarUpload(file: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setAdminAvatarUrl(result);
        try {
          localStorage.setItem("ai_sales_admin_avatar", result);
        } catch {}
        setSuccess("Admin avatari muvaffaqiyatli o'rnatildi!");
      }
    };
    reader.readAsDataURL(file);
  }

  function handleResetAdminAvatar() {
    setAdminAvatarUrl("");
    try {
      localStorage.removeItem("ai_sales_admin_avatar");
    } catch {}
    setSuccess("Admin avatari standart holatga qaytarildi!");
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Kirish amalga oshmadi");
      setAuthenticated(true);
      if (data.user) {
        setCurrentUser(data.user);
        if ((data.user.isPlatformOwner || data.user.isPlatformAdmin) && !initialZone) {
          setZone("platform");
        }
      }
      if (loginTelegramId) {
        const num = Number(loginTelegramId);
        if (num && !isNaN(num)) {
          setActiveAdminTelegramId(num);
          setNavAvatarError(false);
          setProfileAvatarError(false);
          try {
            localStorage.setItem("ai_sales_active_admin_id", String(num));
          } catch {}
        }
      }
      setPassword("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Parol noto'g'ri");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setAuthenticated(false);
    setCurrentUser(null);
    setSubscriptionData(null);
    setOverview(null);
    setConversations([]);
    setMessages([]);
    setAdmins([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("ai_sales_design_system");
      document.documentElement.setAttribute("data-design", "classic");
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selected) ?? null,
    [conversations, selected]
  );

  const currentAdmin = useMemo(() => {
    if (activeAdminTelegramId > 0) {
      const found = admins.find((a) => a.telegram_user_id === activeAdminTelegramId);
      if (found) return found;
    }
    if (currentUser) {
      return {
        id: currentUser.userId,
        telegram_user_id: currentUser.telegramUserId || 0,
        name: currentUser.fullName || (currentUser.email ? currentUser.email.split("@")[0] : "Admin"),
        username: currentUser.username || (currentUser.email?.includes("@telegram.selloi.uz") ? currentUser.email.replace("@telegram.selloi.uz", "") : ""),
        role: currentUser.role || (currentUser.isPlatformOwner ? "owner" : "admin"),
        isPlatformOwner: Boolean(currentUser.isPlatformOwner),
        email: currentUser.email,
        permissions: {},
      };
    }
    return admins.length > 0 ? admins[0] : null;
  }, [admins, activeAdminTelegramId, currentUser]);

  // Load SaaS tenant, subscription, usage, and financial metrics
  const loadSaaSData = useCallback(async (orgId?: number) => {
    setIsSubscriptionLoading(true);
    setSubscriptionError(null);
    try {
      const effectiveOrgId = orgId || activeOrgId;
      try {
        const sub = await api<any>(`/api/subscription?organization_id=${effectiveOrgId}`);
        setSubscriptionData(sub);
      } catch (err: any) {
        setSubscriptionData(null);
        setSubscriptionError(err?.message || "Obuna ma'lumotlarini yuklab bo'lmadi");
      } finally {
        setIsSubscriptionLoading(false);
      }

      try {
        const usage = await api<any>(`/api/usage?organization_id=${effectiveOrgId}`);
        setUsageData(usage);
      } catch {}

      try {
        const pl = await api<any>("/api/plans");
        setPlansList(pl.plans || []);
      } catch {}

      try {
        const orgs = await api<any>("/api/organizations");
        setUserOrganizations(orgs.organizations || []);
      } catch {}

      try {
        const currentOrgRes = await api<any>(`/api/organizations/current?organization_id=${effectiveOrgId}`);
        if (currentOrgRes) {
          setCurrentOrgDetails(currentOrgRes);
          if (currentOrgRes.custom_system_prompt) {
            setCustomPromptInput(currentOrgRes.custom_system_prompt);
          }
          setTelegramApiIdInput(currentOrgRes.telegram_api_id ? String(currentOrgRes.telegram_api_id) : "");
          setTelegramPhoneInput(currentOrgRes.telegram_phone || "");
          setAdminChatIdInput(currentOrgRes.admin_chat_id || "");
        }
      } catch {}

      if (hasPlatformAccess) {
        try {
          const m = await api<any>("/api/platform/metrics");
          setPlatformMetrics(m);
        } catch {}
        try {
          const o = await api<any>("/api/platform/organizations");
          setPlatformOrgs(o.organizations || []);
        } catch {}
      }
    } catch (e) {
      console.error("loadSaaSData error:", e);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [
    activeOrgId,
    hasPlatformAccess,
    currentAdmin?.role,
    setCurrentOrgDetails,
    setCustomPromptInput,
    setTelegramApiIdInput,
    setTelegramPhoneInput,
    setAdminChatIdInput,
    setPlatformMetrics,
    setPlatformOrgs,
  ]);

  useEffect(() => {
    loadSaaSDataRef.current = loadSaaSData;
  }, [loadSaaSData]);

  useEffect(() => {
    if (!authenticated) return;
    if (zone === "platform") {
      void loadPlatformData();
      if (currentUser?.organizationId) {
        void loadSaaSData(currentUser.organizationId);
      } else {
        setIsSubscriptionLoading(false);
      }
    } else {
      void load();
      void loadSaaSData(activeOrgId);
    }
  }, [authenticated, zone, activeOrgId, currentUser?.organizationId, loadPlatformData, load, loadSaaSData]);

  // Handle Saas Upgrade event
  useEffect(() => {
    const handleUpgradeNeeded = (evt: any) => {
      const detail = evt.detail || {};
      setUpgradeModalConfig({
        isOpen: true,
        featureName: detail.feature || "Ushbu xususiyat",
        requiredPlan: detail.required_plan || "pro",
        message: detail.detail || "Ushbu imkoniyatdan foydalanish uchun yuqoriroq tarifga o'tish lozim.",
      });
    };
    window.addEventListener("saas-upgrade-needed", handleUpgradeNeeded);
    return () => window.removeEventListener("saas-upgrade-needed", handleUpgradeNeeded);
  }, []);

  const handleUpgradePlan = async (planCode: string, billingCycle: "monthly" | "yearly" = "monthly") => {
    setBusy(true);
    try {
      await api("/api/subscription/upgrade", {
        method: "POST",
        body: JSON.stringify({ new_plan_code: planCode, billing_cycle: billingCycle }),
      });
      setSuccess(`${planCode.toUpperCase()} tarif rejasiga muvaffaqiyatli o'tildi!`);
      await loadSaaSData(activeOrgId);
    } catch (err: any) {
      setError(err.message || "Tarifni o'zgartirishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSubscription = async () => {
    setBusy(true);
    try {
      await api("/api/subscription/cancel", { method: "POST" });
      setSuccess("Obunani bekor qilish rejalashtirildi (davr oxirigacha faol).");
      await loadSaaSData(activeOrgId);
    } catch (err: any) {
      setError(err.message || "Obunani bekor qilishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const handleResumeSubscription = async () => {
    setBusy(true);
    try {
      await api("/api/subscription/resume", { method: "POST" });
      setSuccess("Obunangiz yana to'liq faollashtirildi!");
      await loadSaaSData(activeOrgId);
    } catch (err: any) {
      setError(err.message || "Obunani qayta faollashtirishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrganization = async (data: any) => {
    setBusy(true);
    try {
      const res = await api<any>("/api/organizations", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setSuccess(`${data.name} muvaffaqiyatli yaratildi! 7 kunlik sinov muddati boshlandi.`);
      if (res.organization?.id) {
        const org = res.organization;
        if (org.slug) {
          const meta = { id: org.id, name: org.name, slug: org.slug };
          if (typeof window !== "undefined") {
            sessionStorage.setItem("active_org_id", String(org.id));
            localStorage.setItem("active_org_id", String(org.id));
            localStorage.setItem("owner_impersonating_store", JSON.stringify(meta));
            window.history.pushState(null, "", `/t/${org.slug}`);
          }
          setActiveStoreMeta(meta);
          setIsOwnerImpersonating(true);
          setZone("tenant");
        }
        switchOrganization(org.id);
      }
      setShowOnboardingModal(false);
    } catch (err: any) {
      setError(err.message || "Tashkilot yaratishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const switchOrganization = (orgId: number) => {
    setActiveOrgId(orgId);
    setSubscriptionData(null);
    setIsSubscriptionLoading(true);
    setSubscriptionError(null);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("active_org_id", String(orgId));
      localStorage.setItem("active_org_id", String(orgId));
      const url = new URL(window.location.href);
      url.searchParams.set("org", String(orgId));
      window.history.replaceState(null, "", url.toString());
    }
    setSuccess(`Faol tashkilot almashtirildi: #${orgId}`);
    load();
    loadSaaSData(orgId);
  };

  useEffect(() => {
    if (initialTenantSlug && platformOrgs.length > 0) {
      const matched = platformOrgs.find((o) => o.slug === initialTenantSlug);
      if (matched && matched.id !== activeOrgId) {
        setActiveOrgId(matched.id);
        const meta = { id: matched.id, name: matched.name, slug: matched.slug };
        setActiveStoreMeta(meta);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("active_org_id", String(matched.id));
          localStorage.setItem("active_org_id", String(matched.id));
          localStorage.setItem("owner_impersonating_store", JSON.stringify(meta));
        }
        setIsOwnerImpersonating(true);
        load();
        loadSaaSData(matched.id);
      }
    }
  }, [initialTenantSlug, platformOrgs, activeOrgId, load, loadSaaSData]);



  const currentChannelName = useMemo(() => {
    const raw = channel || (posts.length > 0 ? posts[0].channel_username : "");
    if (!raw) return "";
    return raw.startsWith("@") ? raw : `@${raw}`;
  }, [channel, posts]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        inboxSearch.trim() === "" ||
        c.customer_name.toLowerCase().includes(inboxSearch.toLowerCase()) ||
        (c.username && c.username.toLowerCase().includes(inboxSearch.toLowerCase())) ||
        String(c.chat_id).includes(inboxSearch);

      if (!matchesSearch) return false;
      if (inboxFilter === "ai") return c.status === "ai_active";
      if (inboxFilter === "human") return c.status !== "ai_active";
      return true;
    });
  }, [conversations, inboxSearch, inboxFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!productSearch.trim()) return true;
      const s = productSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(s) ||
        p.specs.toLowerCase().includes(s) ||
        p.category.toLowerCase().includes(s) ||
        p.price.toLowerCase().includes(s)
      );
    });
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!orderSearch.trim()) return true;
      const s = orderSearch.toLowerCase();
      return (
        o.customer.toLowerCase().includes(s) ||
        o.product.toLowerCase().includes(s) ||
        o.id.toLowerCase().includes(s) ||
        o.username.toLowerCase().includes(s)
      );
    });
  }, [orders, orderSearch]);

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!newAdminId.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api("/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          telegram_user_id: parseInt(newAdminId.trim(), 10),
          name: newAdminName.trim(),
          username: cleanTelegramUsername(newAdminUsername) || null,
          role: newAdminRole,
        }),
      });
      setSuccess("Yangi admin muvaffaqiyatli qo'shildi!");
      setNewAdminId("");
      setNewAdminName("");
      setNewAdminUsername("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin qo'shishda xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAdmin(telegram_user_id: number, name: string) {
    const target = admins.find((a) => a.telegram_user_id === telegram_user_id);
    if (target?.role === "owner") {
      setError("Owner (Bosh admin)ni o'chirib bo'lmaydi");
      return;
    }
    setPendingConfirm({
      title: "Adminni o'chirish",
      message: `${name || telegram_user_id} adminlik huquqidan o'chirilsinmi?`,
      confirmText: "O'chirish",
      onConfirm: async () => {
        await api(`/admin/admins/${telegram_user_id}`, { method: "DELETE" });
        setSuccess(`${name || "Admin"} tizimdan muvaffaqiyatli o'chirildi.`);
        if (managingPermissionsAdmin?.telegram_user_id === telegram_user_id) {
          setManagingPermissionsAdmin(null);
        }
        await load();
      },
    });
  }

  async function handleTogglePermission(telegram_user_id: number, permission: string, currentVal: boolean) {
    const target = admins.find((a) => a.telegram_user_id === telegram_user_id);
    if (target?.role === "owner") {
      setError("Owner ruxsatlarini o'zgartirib bo'lmaydi");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/admin/admins/${telegram_user_id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permission, value: !currentVal }),
      });
      setAdmins((prev) =>
        prev.map((a) => {
          if (a.telegram_user_id === telegram_user_id) {
            return { ...a, permissions: { ...a.permissions, [permission]: !currentVal } };
          }
          return a;
        })
      );
      setManagingPermissionsAdmin((prev) => {
        if (prev && prev.telegram_user_id === telegram_user_id) {
          return { ...prev, permissions: { ...prev.permissions, [permission]: !currentVal } };
        }
        return prev;
      });
      setSuccess("Ruxsat holati muvaffaqiyatli yangilandi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ruxsatni o'zgartirishda xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchPermissions(telegram_user_id: number, targetValue: boolean) {
    const target = admins.find((a) => a.telegram_user_id === telegram_user_id);
    if (!target || target.role === "owner") return;
    setBusy(true);
    setError("");
    try {
      const keys = Object.keys(permissionLabels);
      for (const k of keys) {
        if (Boolean(target.permissions?.[k]) !== targetValue) {
          await api(`/admin/admins/${telegram_user_id}/permissions`, {
            method: "PATCH",
            body: JSON.stringify({ permission: k, value: targetValue }),
          });
        }
      }
      setAdmins((prev) =>
        prev.map((a) => {
          if (a.telegram_user_id === telegram_user_id) {
            const newPerms: Record<string, boolean> = { ...(a.permissions || {}) };
            keys.forEach((k) => {
              newPerms[k] = targetValue;
            });
            return { ...a, permissions: newPerms };
          }
          return a;
        })
      );
      setManagingPermissionsAdmin((prev) => {
        if (prev && prev.telegram_user_id === telegram_user_id) {
          const newPerms: Record<string, boolean> = { ...(prev.permissions || {}) };
          keys.forEach((k) => {
            newPerms[k] = targetValue;
          });
          return { ...prev, permissions: newPerms };
        }
        return prev;
      });
      setSuccess(targetValue ? "Barcha ruxsatlar faollashtirildi!" : "Barcha ruxsatlar o'chirildi!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ruxsatlarni yangilashda xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(telegram_user_id: number, role: string) {
    const target = admins.find((a) => a.telegram_user_id === telegram_user_id);
    if (target?.role === "owner") {
      setError("Owner rolini o'zgartirib bo'lmaydi");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<{ ok: boolean; role: "owner" | "admin" | "moderator"; permissions: Record<string, boolean> }>(
        `/admin/admins/${telegram_user_id}/role`,
        { method: "PATCH", body: JSON.stringify({ role }) }
      );
      setAdmins((prev) =>
        prev.map((a) => {
          if (a.telegram_user_id === telegram_user_id) {
            return { ...a, role: res.role, permissions: res.permissions };
          }
          return a;
        })
      );
      setManagingPermissionsAdmin((prev) => {
        if (prev && prev.telegram_user_id === telegram_user_id) {
          return { ...prev, role: res.role, permissions: res.permissions };
        }
        return prev;
      });
      setSuccess("Admin roli muvaffaqiyatli yangilandi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rolni o'zgartirishda xatolik");
    } finally {
      setBusy(false);
    }
  }

  // Enforce authentication via /login
  useEffect(() => {
    if (!authenticated) {
      const onAdminPath =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/platform"));
      window.location.href = onAdminPath ? "/login?redirect=/admin" : "/login?redirect=/dashboard";
    }
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center min-vh-100 gap-3"
        style={{ background: "var(--bg-canvas, #0D0D0D)" }}
      >
        <div
          className="d-flex align-items-center justify-content-center rounded-3 border"
          style={{
            width: 52,
            height: 52,
            backgroundColor: "var(--accent-subtle, rgba(255, 76, 99, 0.14))",
            borderColor: "var(--accent-border, rgba(255, 76, 99, 0.35))",
          }}
        >
          <IconSparkles size={24} style={{ color: "var(--accent, #FF4C63)" }} className="spin" />
        </div>
        <span className="small text-secondary" style={{ letterSpacing: "0.04em" }}>
          Selloi yuklanmoqda...
        </span>
      </div>
    );
  }

  const breadcrumb = tab === "profile" ? t("breadcrumb.profile") : (
    zone === "platform" ? (
      platformSubTab === "overview" ? "ADMIN PANEL / UMUMIY KO'RINISH" :
      platformSubTab === "stores" ? "ADMIN PANEL / DO'KONLAR" :
      platformSubTab === "users" ? "ADMIN PANEL / FOYDALANUVCHILAR" :
      platformSubTab === "plans" ? "ADMIN PANEL / TARIFLAR & NARXLAR" :
      platformSubTab === "payment-testing" ? "ADMIN PANEL / PAYMENT TESTING" :
      platformSubTab === "usage" ? "ADMIN PANEL / AI XARAJATI" :
      platformSubTab === "system" ? "ADMIN PANEL / TIZIM HOLATI" :
      "ADMIN PANEL / AUDIT JURNALI"
    ) : (
      tab === "overview" ? t("breadcrumb.overview") :
      tab === "inbox" ? t("breadcrumb.inbox") :
      tab === "knowledge" ? t("breadcrumb.knowledge") :
      tab === "products" ? t("breadcrumb.products") :
      tab === "orders" ? t("breadcrumb.orders") :
      tab === "customers" ? t("breadcrumb.customers") :
      tab === "usage" ? t("breadcrumb.usage") :
      tab === "billing" ? t("breadcrumb.billing") :
      tab === "pricing" ? t("breadcrumb.pricing") :
      tab === "platform" ? t("breadcrumb.platform") :
      tab === "analytics" ? t("breadcrumb.analytics") :
      tab === "settings" ? t("breadcrumb.settings") :
      tab === "admins" ? t("breadcrumb.admins") :
      tab === "team" ? t("breadcrumb.team") :
      tab === "logs" ? t("breadcrumb.logs") :
      t("breadcrumb.profile")
    )
  );

  const tabTitle = tab === "profile" ? t("profile.title") : (
    zone === "platform" ? (
      platformSubTab === "overview" ? t("platform.overview_title", { defaultValue: "Umumiy Ko'rinish" }) :
      platformSubTab === "stores" ? t("nav.item.stores") :
      platformSubTab === "users" ? t("nav.item.users") :
      platformSubTab === "plans" ? t("nav.item.plans") :
      platformSubTab === "payment-testing" ? "Payment Testing Studio" :
      platformSubTab === "usage" ? "AI Xarajati" :
      platformSubTab === "system" ? t("nav.item.system_health") :
      t("nav.item.audit_logs")
    ) : (
      tab === "overview" ? t("overview.title") :
      tab === "inbox" ? t("inbox.title") :
      tab === "knowledge" ? t("knowledge.title") :
      tab === "products" ? t("products.title") :
      tab === "orders" ? t("orders.title") :
      tab === "customers" ? t("customers.title") :
      tab === "usage" ? t("nav.item.usage") :
      tab === "billing" ? t("nav.item.billing") :
      tab === "pricing" ? t("nav.item.pricing") :
      tab === "platform" ? t("nav.item.platform") :
      tab === "analytics" ? t("analytics.title") :
      tab === "settings" ? t("settings.title") :
      tab === "admins" ? t("admins.title") :
      tab === "team" ? t("team.title") :
      tab === "logs" ? t("logs.title") :
      t("profile.title")
    )
  );

  return (
    <DesignProvider
      subscriptionPlan={subscriptionData?.plan?.code || null}
      isSubscriptionLoading={isSubscriptionLoading}
      subscriptionError={subscriptionError}
      isPlatformOwner={isPlatformOwner}
    >
      <div className="linear-app">
      <AppShell
        activeTab={tab}
        onSelectTab={(newTab) => {
          if (newTab === "platform" && !hasPlatformAccess) {
            return;
          }
          setTab(newTab);
          if (newTab === "platform") {
            setZone("platform");
          } else if (newTab !== "profile" && zone === "platform") {
            setZone("tenant");
          }
          if (typeof window !== "undefined") {
            const targetHash = `#${newTab}`;
            if (window.location.hash !== targetHash) {
              window.history.pushState(null, "", targetHash);
            }
          }
        }}
        platformSubTab={platformSubTab}
        onSelectPlatformSubTab={setPlatformSubTab}
        storesCount={platformOrgs.length}
        usersCount={platformUsers.length}
        systemHealthOk={!systemHealth || systemHealth.status === "ok"}
        organizations={userOrganizations}
        activeOrgId={activeOrgId}
        onSelectOrg={switchOrganization}
        onOpenNewStoreModal={() => setShowOnboardingModal(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        loading={loading}
        onRefresh={zone === "platform" ? loadPlatformData : load}
        isPlatformOwner={hasPlatformAccess}
        isStrictPlatformOwner={isPlatformOwner}
        zone={zone === "platform" && hasPlatformAccess ? "platform" : "store"}
        onSwitchZone={(z) => {
          if (z === "platform") {
            if (!hasPlatformAccess) return;
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin")) {
              window.location.href = "/admin";
              return;
            }
            setZone("platform");
            setTab("platform");
          } else {
            if (typeof window !== "undefined" && (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/platform"))) {
              window.location.href = "/dashboard";
              return;
            }
            setZone("tenant");
            setTab("overview");
          }
        }}
        storeName={activeStoreMeta?.name || userOrganizations.find((o) => o.id === activeOrgId)?.name || "AI Sales Central"}
        adminName={currentAdmin?.name || "Admin"}
        adminRole={currentAdmin?.role || "admin"}
        adminAvatarUrl={Boolean(activeAdminTelegramId) && activeAdminTelegramId > 0 && !navAvatarError ? `/api/proxy?path=/admin/users/${activeAdminTelegramId}/avatar` : ""}
        aiModel={aiModel}
        unreadCount={conversations.filter((c) => c.status === "human_takeover").length}
        productsCount={products.length}
        ordersCount={orders.length}
        logoUrl={logoUrl}
        onOpenLogoModal={() => setShowLogoModal(true)}
        onLogout={logout}
        onReturnToAdmin={hasPlatformAccess && zone !== "platform" ? handleExitStore : undefined}
        breadcrumb={breadcrumb}
        tabTitle={tabTitle}
      >
        {/* Global Floating Toast Notifications */}
        {(error || success || infoToast) && (
          <ToastContainer>
            {error && <Toast type="error" message={error} onClose={() => setError("")} />}
            {success && <Toast type="success" message={success} onClose={() => setSuccess("")} />}
            {infoToast && <Toast type="info" message={infoToast} onClose={() => setInfoToast("")} />}
          </ToastContainer>
        )}

        {/* Tab Modules */}
        {(zone === "platform" || tab === "platform") && hasPlatformAccess && tab !== "profile" ? (
          <PlatformOwnerTab
            subTab={platformSubTab}
            metrics={platformMetrics}
            organizations={platformOrgs}
            usersList={platformUsers}
            systemHealth={systemHealth}
            auditLogs={auditLogs}
            loading={loading}
            isCurrentUserOwner={isPlatformOwner}
            onRefresh={loadPlatformData}
            onUpdatePlan={handleUpdatePlanConfig}
            onEnterStore={handleEnterStore}
            onSwitchSubTab={setPlatformSubTab}
            onCreateStore={handleCreateStore}
            onUpdateStoreStatus={handleUpdateStoreStatus}
            onDeleteStore={handleDeleteStore}
            onAppointSiteAdmin={handleAppointSiteAdmin}
            onToggleSiteAdmin={handleToggleSiteAdmin}
            onToggleUserStatus={handleToggleUserStatus}
            onInspectStore={handleInspectStore}
            onUpdateStoreSubscription={handleUpdateStoreSubscription}
            onSendDailyReport={handleSendPlatformDailyReport}
            onSendBroadcast={handleSendPlatformBroadcast}
          />
        ) : (
          <>
            {tab === "overview" && (
              <OverviewTab
                overview={overview}
                conversations={conversations}
                orders={orders}
                channels={channels}
                productsCount={products.length}
                botConfigured={Boolean(currentOrgDetails?.telegram_bot_token_set)}
                aiModel={aiModel}
                storeName={activeStoreMeta?.name || userOrganizations.find((o) => o.id === activeOrgId)?.name || "Do'kon Boshqaruv Paneli"}
                planCode={subscriptionData?.plan?.code || null}
                sseConnected={sseConnected}
                followupEnabled={Boolean(followupBundle?.config?.is_enabled)}
                paymentProvider={storePaymentConfig?.is_enabled ? storePaymentConfig?.provider : null}
                dailyReportEnabled={Boolean(reportBundle?.config?.is_enabled)}
                dailyReportHour={reportBundle?.config?.send_hour ?? 21}
                usageMessagesItem={
                  Array.isArray(usageData?.items)
                    ? usageData.items.find((it: any) => it.metric === "ai_messages") || null
                    : null
                }
                onSendDailyReportNow={handleSendDailyReportNow}
                onSelectConversation={(id) => setSelected(id)}
                onNavigateTab={(targetTab, filter) => {
                  setTab(targetTab);
                  if (filter) setInboxFilter(filter as any);
                }}
                onRefresh={load}
                loading={loading}
              />
            )}

            {tab === "inbox" && (
              <InboxTab
                conversations={conversations}
                selectedId={selected}
                onSelectConversation={(id) => setSelected(id)}
                messages={messages}
                inboxFilter={inboxFilter}
                setInboxFilter={setInboxFilter}
                inboxSearch={inboxSearch}
                setInboxSearch={setInboxSearch}
                draft={draft}
                setDraft={setDraft}
                onSendMessage={sendReply}
                onTakeover={(convId) => perform(`/admin/conversations/${convId}/takeover`)}
                onResumeAi={(convId) => perform(`/admin/conversations/${convId}/resume`)}
                busy={busy}
                customerNotes={customerNotes}
                onSaveCustomerNote={handleSaveCustomerNote}
                onSendCatalogProposal={handleSendCatalogProposal}
                onSendDiscountProposal={handleSendDiscountProposal}
                onSendConversationPayment={handleSendConversationPayment}
                sseConnected={sseConnected}
                soundEnabled={soundEnabled}
                onToggleSound={handleToggleSound}
              />
            )}

            {tab === "knowledge" && (
              <KnowledgeTab
                channels={channels}
                posts={posts}
                channelFilter={channelFilter}
                setChannelFilter={setChannelFilter}
                newChannelInput={newChannelInput}
                setNewChannelInput={setNewChannelInput}
                onConnectChannel={handleConnectChannel}
                onSyncChannel={handleSyncChannel}
                onDeleteChannel={handleDeleteChannel}
                onDeletePost={handleDeletePost}
                onExtractProducts={handleExtractProductsFromPosts}
                onOpenPlayground={handleOpenPlayground}
                busy={busy}
              />
            )}

            {tab === "products" && (
              <ProductsTab
                products={products}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                isAddingProduct={isAddingProduct}
                setIsAddingProduct={setIsAddingProduct}
                editingProduct={editingProduct}
                setEditingProduct={setEditingProduct}
                newProduct={newProduct}
                setNewProduct={setNewProduct}
                onSaveProduct={() => {
                  if (editingProduct) void handleSaveProductEdit();
                  else void handleCreateProduct();
                }}
                onDeleteProduct={handleDeleteProduct}
                onExtractProducts={handleExtractProductsFromPosts}
                busy={busy}
              />
            )}

            {tab === "orders" && (
              <OrdersTab
                orders={orders}
                orderSearch={orderSearch}
                setOrderSearch={setOrderSearch}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onDeleteOrder={handleDeleteOrder}
                onSendOrderPayment={handleSendOrderPayment}
                onMarkOrderPaid={handleMarkOrderPaid}
                onCheckOrderPayment={handleCheckOrderPayment}
                busy={busy}
              />
            )}

            {tab === "customers" && (
              <CustomersTab
                conversations={conversations}
                onSelectConversation={(id) => setSelected(id)}
                onNavigateInbox={() => setTab("inbox")}
                loading={loading}
              />
            )}

            {tab === "analytics" && (
              <AnalyticsTab
                conversations={conversations}
                orders={orders}
                overview={overview}
              />
            )}

            {tab === "settings" && (
              <SettingsTab
                aiModel={aiModel}
                setAiModel={setAiModel}
                aiTemperature={aiTemperature}
                setAiTemperature={setAiTemperature}
                autoHandoff={autoHandoff}
                setAutoHandoff={setAutoHandoff}
                doubleConfirmation={doubleConfirmation}
                setDoubleConfirmation={setDoubleConfirmation}
                businessHoursOnly={businessHoursOnly}
                setBusinessHoursOnly={setBusinessHoursOnly}
                onSaveAiSettings={() => setSuccess("AI sozlamalari muvaffaqiyatli saqlandi!")}
                currentOrgDetails={currentOrgDetails}
                botTokenInput={botTokenInput}
                setBotTokenInput={setBotTokenInput}
                showBotToken={showBotToken}
                setShowBotToken={setShowBotToken}
                botTokenVerifying={botTokenVerifying}
                onVerifyBotToken={handleVerifyBotToken}
                botTokenResult={botTokenResult}
                activeOrgId={activeOrgId}
                webhookSetting={webhookSetting}
                onSetWebhook={handleSetWebhook}
                webhookStatusChecking={webhookStatusChecking}
                onCheckWebhookStatus={handleCheckWebhookStatus}
                webhookInfo={webhookInfo}
                customPromptInput={customPromptInput}
                setCustomPromptInput={setCustomPromptInput}
                telegramApiIdInput={telegramApiIdInput}
                setTelegramApiIdInput={setTelegramApiIdInput}
                telegramApiHashInput={telegramApiHashInput}
                setTelegramApiHashInput={setTelegramApiHashInput}
                telegramPhoneInput={telegramPhoneInput}
                setTelegramPhoneInput={setTelegramPhoneInput}
                adminChatIdInput={adminChatIdInput}
                setAdminChatIdInput={setAdminChatIdInput}
                showApiHash={showApiHash}
                setShowApiHash={setShowApiHash}
                onSaveBotSettings={handleSaveBotSettings}
                savingOrgSettings={savingOrgSettings}
                logoUrl={logoUrl}
                customLogoInput={customLogoInput}
                setCustomLogoInput={setCustomLogoInput}
                onSaveLogoUrl={handleSaveLogoUrl}
                onLogoUpload={handleLogoUpload}
                channels={channels}
                onRunPlayground={handleRunAiPlayground}
                storePaymentConfig={storePaymentConfig}
                onSaveStorePaymentConfig={handleSaveStorePaymentConfig}
                followupBundle={followupBundle}
                onSaveFollowupConfig={handleSaveFollowupConfig}
                onPreviewFollowup={handlePreviewFollowup}
                onRunFollowupNow={handleRunFollowupNow}
                reportBundle={reportBundle}
                onSaveReportConfig={handleSaveReportConfig}
                onPreviewReport={handlePreviewDailyReport}
                onSendReportNow={handleSendDailyReportNow}
              />
            )}

            {tab === "admins" && (
              <AdminsTab
                admins={admins}
                newAdminId={newAdminId}
                setNewAdminId={setNewAdminId}
                newAdminName={newAdminName}
                setNewAdminName={setNewAdminName}
                newAdminUsername={newAdminUsername}
                setNewAdminUsername={setNewAdminUsername}
                newAdminRole={newAdminRole}
                setNewAdminRole={setNewAdminRole}
                onAddAdmin={handleAddAdmin}
                onRoleChange={handleRoleChange}
                onDeleteAdmin={handleDeleteAdmin}
                managingPermissionsAdmin={managingPermissionsAdmin}
                setManagingPermissionsAdmin={setManagingPermissionsAdmin}
                onTogglePermission={handleTogglePermission}
                busy={busy}
                permissionLabels={permissionLabels}
                permissionCategories={permissionCategories}
              />
            )}

            {tab === "team" && (
              <TeamTab permissionLabels={permissionLabels} />
            )}

            {tab === "logs" && (
              <LogsTab logs={tenantLogs} loading={loading} />
            )}

            {tab === "profile" && (
              <ProfileTab
                currentAdmin={currentAdmin}
                activeAdminTelegramId={activeAdminTelegramId}
                profileAvatarError={profileAvatarError}
                setProfileAvatarError={setProfileAvatarError}
                theme={theme}
                setTheme={setTheme}
                appFont={appFont}
                onSelectFont={handleSelectFont}
                onLogout={logout}
                permissionLabels={permissionLabels}
                onNavigateToBilling={() => setTab("billing")}
                onReturnToAdmin={hasPlatformAccess && zone !== "platform" ? handleExitStore : undefined}
              />
            )}

            {tab === "usage" && (
              <UsageTab
                usageData={usageData}
                loading={loading}
                onRefresh={() => loadSaaSData(activeOrgId)}
                onUpgradeClick={() => setTab("pricing")}
              />
            )}

            {tab === "billing" && (
              <BillingTab
                subscription={subscriptionData}
                loading={loading}
                onRefresh={() => loadSaaSData(activeOrgId)}
                onUpgradeClick={() => setTab("pricing")}
                onCancelSubscription={handleCancelSubscription}
                onResumeSubscription={handleResumeSubscription}
                initialPlan={initialPlan}
              />
            )}

            {tab === "pricing" && (
              <PricingTab
                plans={plansList}
                currentPlanCode={subscriptionData?.plan?.code || "pro"}
                onSelectPlan={handleUpgradePlan}
                loading={busy}
              />
            )}
          </>
        )}
      </AppShell>

      {/* Modal for logo settings */}
      {showLogoModal && (
        <div className="modal modal-blur fade show d-block" role="dialog" aria-modal="true" aria-label="Kompaniya Logotipini Sozlash" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow-lg" style={{ background: "var(--bg-surface-elevated)", borderRadius: 16 }}>
              <div className="modal-header border-bottom border-subtle">
                <h5 className="modal-title text-primary d-flex align-items-center gap-2">
                  <span>Kompaniya Logotipini Sozlash</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowLogoModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-4 p-3 rounded" style={{ background: "var(--bg-canvas)" }}>
                  <div className="text-secondary small mb-2">Joriy logotip ko'rinishi:</div>
                  <AppLogo src={customLogoInput || logoUrl} size="xl" />
                </div>

                <div className="mb-3">
                  <label className="form-label text-secondary small">Fayl yuklash (PNG, SVG, JPG, WebP):</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="linear-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-secondary small">Yoki Logotip URL manzili:</label>
                  <div className="d-flex gap-2">
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="/logo.svg yoki https://..."
                      value={customLogoInput}
                      onChange={(e) => setCustomLogoInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => handleSaveLogoUrl(customLogoInput)}
                    >
                      Qo'llash
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top border-subtle d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-ghost-secondary btn-sm"
                  onClick={() => {
                    handleSaveLogoUrl("/logo.svg");
                    setCustomLogoInput("/logo.svg");
                  }}
                >
                  Standart logotip
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    handleSaveLogoUrl(customLogoInput);
                    setShowLogoModal(false);
                  }}
                >
                  Tayyor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Wizard Modal */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={handleCreateOrganization}
      />

      {/* Unified Selloi Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          const action = pendingConfirm.onConfirm;
          setBusy(true);
          try {
            await action();
            setPendingConfirm(null);
          } catch (err: any) {
            setPendingConfirm(null);
            setError(err?.message || "Amalni bajarishda xatolik yuz berdi");
          } finally {
            setBusy(false);
          }
        }}
        title={pendingConfirm?.title || "Amalni tasdiqlang"}
        message={pendingConfirm?.message || ""}
        confirmText={pendingConfirm?.confirmText || "Tasdiqlash"}
        cancelText="Bekor qilish"
        variant="danger"
        loading={busy}
      />

      {/* Feature / Limit Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalConfig.isOpen}
        onClose={() => setUpgradeModalConfig({ isOpen: false })}
        featureName={upgradeModalConfig.featureName}
        requiredPlan={upgradeModalConfig.requiredPlan}
        message={upgradeModalConfig.message}
        onUpgradeToPlan={(planCode) => handleUpgradePlan(planCode, "monthly")}
      />
      </div>
    </DesignProvider>
  );
}

export default function Dashboard(props: DashboardProps) {
  return (
    <LanguageProvider>
      <DashboardContent {...props} />
    </LanguageProvider>
  );
}
