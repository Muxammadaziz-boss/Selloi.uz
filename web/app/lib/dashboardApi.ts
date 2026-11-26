"use client";

export type PlatformSubTabId =
  | "overview"
  | "stores"
  | "users"
  | "plans"
  | "usage"
  | "system"
  | "audit"
  | "payment-testing";

export type DashboardTabId =
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

export type Overview = {
  conversations: number;
  ai_active: number;
  human_takeover: number;
  knowledge_posts: number;
  orders: number;
};

export type Conversation = {
  id: number;
  customer_name: string;
  username?: string | null;
  chat_id: number;
  status: string;
  handoff_reason?: string | null;
  note?: string | null;
  last_message_at?: string | null;
};

export type Message = {
  id: number;
  direction: string;
  text: string;
  created_at: string;
};

export type KnowledgePost = {
  id: number;
  channel_username: string;
  telegram_message_id: number;
  text: string;
  image_description: string;
  source_url?: string | null;
};

export type ConnectedChannel = {
  id: number;
  channel_username: string;
  title?: string | null;
  is_active: boolean;
  posts_count: number;
  last_synced_at?: string | null;
  created_at?: string | null;
};

export type AdminUser = {
  id: number;
  telegram_user_id: number;
  name: string;
  username?: string | null;
  role: "owner" | "admin" | "moderator";
  permissions: Record<string, boolean>;
  is_active: boolean;
  added_by?: number | null;
  created_at?: string | null;
};

export type OrderItem = {
  id: string;
  db_id?: number;
  conversation_id?: number | null;
  customer: string;
  username: string;
  product: string;
  amount: string;
  status: "New" | "Processing" | "Confirmed" | "Completed" | "Paid" | "Cancelled" | string;
  date: string;
  channel: string;
  latest_payment?: {
    bill_id: string;
    provider: string;
    amount_uzs: number;
    payment_url?: string | null;
    status: string;
    paid_at?: string | null;
  } | null;
};

export type ProductItem = {
  id: string;
  name: string;
  category: string;
  specs: string;
  price: string;
  stock: "In Stock" | "Low Stock" | "Pre-order";
  warranty: string;
};

export interface DashboardUser {
  userId: number;
  telegramUserId?: number;
  email?: string;
  fullName?: string;
  username?: string;
  role?: string;
  organizationId?: number;
  isPlatformOwner?: boolean;
  isPlatformAdmin?: boolean;
}

export interface DashboardProps {
  initialAuthenticated?: boolean;
  initialUser?: DashboardUser | null;
  initialZone?: "platform" | "tenant";
  initialTenantSlug?: string;
  initialTab?: DashboardTabId;
  initialPlan?: string;
}

export interface PendingConfirmState {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => Promise<void>;
}

export const PERMISSION_LABELS_UZ: Record<string, string> = {
  can_view_conversations: "Suhbatlarni ko'rish",
  can_reply_customers: "Mijozlarga javob berish",
  can_takeover: "Suhbatni qabul qilish",
  can_resume_ai: "AI ni qayta yoqish",
  can_view_knowledge: "Bilim bazasini ko'rish",
  can_manage_knowledge: "Bilim bazasini boshqarish",
  can_manage_admins: "Adminlarni boshqarish",
  can_view_orders: "Buyurtmalarni ko'rish",
  can_manage_orders: "Buyurtmalarni boshqarish",
  can_view_analytics: "Statistikani ko'rish",
  can_manage_settings: "Sozlamalarni boshqarish",
};

export const PERMISSION_LABELS_EN: Record<string, string> = {
  can_view_conversations: "View Conversations",
  can_reply_customers: "Reply to Customers",
  can_takeover: "Takeover Chat",
  can_resume_ai: "Resume AI",
  can_view_knowledge: "View Knowledge Base",
  can_manage_knowledge: "Manage Knowledge Base",
  can_manage_admins: "Manage Administrators",
  can_view_orders: "View Orders",
  can_manage_orders: "Manage Orders",
  can_view_analytics: "View Analytics",
  can_manage_settings: "Manage Settings",
};

export const PERMISSION_CATEGORIES_UZ = [
  {
    category: "Mijozlar va Jonli Suhbatlar",
    icon: "💬",
    description: "Mijozlar bilan yozishmalar va AI assistent boshqaruvi",
    permissions: [
      { key: "can_view_conversations", label: "Suhbatlarni ko'rish", desc: "Mijozlar bilan barcha jonli yozishmalarni o'qish" },
      { key: "can_reply_customers", label: "Mijozlarga javob berish", desc: "Telegram orqali mijozlarga bevosita xabar yozish" },
      { key: "can_takeover", label: "Suhbatni qabul qilish", desc: "AI ni to'xtatib, suhbatni o'z nazoratiga olish" },
      { key: "can_resume_ai", label: "AI ni qayta yoqish", desc: "Suhbatni qaytadan AI avtomatik rejimiga o'tkazish" },
    ],
  },
  {
    category: "Mahsulotlar va Buyurtmalar",
    icon: "📦",
    description: "Katalog, Telegram kanal bazasi va savdo buyurtmalari",
    permissions: [
      { key: "can_view_knowledge", label: "Bilim bazasini ko'rish", desc: "Telegram kanalidagi postlar va mahsulotlar ro'yxatini ko'rish" },
      { key: "can_manage_knowledge", label: "Bilim bazasini boshqarish", desc: "Yangi postlarni sinxronlash va kanalni tekshirish" },
      { key: "can_view_orders", label: "Buyurtmalarni ko'rish", desc: "Shakllangan barcha buyurtmalar va shartnomalarni ko'rish" },
      { key: "can_manage_orders", label: "Buyurtmalarni boshqarish", desc: "Buyurtma holatini tasdiqlash, rad etish yoki tahrirlash" },
    ],
  },
  {
    category: "Tizim, Tahlil va Adminlar",
    icon: "⚙️",
    description: "Umumiy statistika, tizim parametrlari va jamoa",
    permissions: [
      { key: "can_view_analytics", label: "Statistikani ko'rish", desc: "Savdo va konversiya ko'rsatkichlarini kuzatish" },
      { key: "can_manage_settings", label: "Sozlamalarni boshqarish", desc: "AI modeli, harorati va tizim sozlamalarini o'zgartirish" },
      { key: "can_manage_admins", label: "Adminlarni boshqarish", desc: "Yangi admin qo'shish va huquqlarini belgilash" },
    ],
  },
];

export const PERMISSION_CATEGORIES_EN = [
  {
    category: "Customers & Live Chat",
    icon: "💬",
    description: "Customer interactions, live messaging, and AI takeover",
    permissions: [
      { key: "can_view_conversations", label: "View Conversations", desc: "Read all incoming customer chat messages" },
      { key: "can_reply_customers", label: "Reply to Customers", desc: "Send direct messages to customers via Telegram" },
      { key: "can_takeover", label: "Takeover Chat", desc: "Pause AI and assume manual human control" },
      { key: "can_resume_ai", label: "Resume AI", desc: "Return conversation back to AI automation" },
    ],
  },
  {
    category: "Products & Orders",
    icon: "📦",
    description: "Catalog management, knowledge channels, and customer orders",
    permissions: [
      { key: "can_view_knowledge", label: "View Knowledge Base", desc: "View Telegram posts and synced product catalogs" },
      { key: "can_manage_knowledge", label: "Manage Knowledge Base", desc: "Sync new posts and inspect channel pipelines" },
      { key: "can_view_orders", label: "View Orders", desc: "Access all incoming customer orders" },
      { key: "can_manage_orders", label: "Manage Orders", desc: "Approve, update, or cancel order transactions" },
    ],
  },
  {
    category: "System, Analytics & Access",
    icon: "⚙️",
    description: "Sales metrics, system parameters, and administrative privileges",
    permissions: [
      { key: "can_view_analytics", label: "View Analytics", desc: "Monitor sales volume and conversion rates" },
      { key: "can_manage_settings", label: "Manage Settings", desc: "Configure AI model, temperature, and store rules" },
      { key: "can_manage_admins", label: "Manage Administrators", desc: "Add or remove admins and grant permissions" },
    ],
  },
];

export const INITIAL_PRODUCTS: ProductItem[] = [];
export const INITIAL_ORDERS: OrderItem[] = [];

export function cleanTelegramUsername(val?: string | null): string {
  if (!val) return "";
  return val
    .trim()
    .replace(/^https?:\/\/(www\.)?t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .replace(/^@+/, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
}

export async function api<T>(path: string, options?: RequestInit & { orgId?: number | string }): Promise<T> {
  const currentOrgId =
    options?.orgId ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("org") ||
          sessionStorage.getItem("active_org_id") ||
          localStorage.getItem("active_org_id") ||
          "1")
      : "1");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Organization-Id": String(currentOrgId),
    ...(options?.headers as Record<string, string> || {}),
  };
  const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  let rawText = "";
  try {
    rawText = await response.text();
  } catch {
    rawText = "";
  }
  let data: any = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    data = {};
  }
  if (!response.ok) {
    if (data.error === "FEATURE_NOT_AVAILABLE" || data.error === "LIMIT_EXCEEDED" || response.status === 402) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("saas-upgrade-needed", { detail: data }));
      }
    }
    const errorDetail =
      data.detail ||
      (typeof data.message === "string" ? data.message : "") ||
      (rawText.length < 200 && rawText ? rawText : `HTTP ${response.status}`);
    throw new Error(errorDetail);
  }
  return data as T;
}

export function timeLabel(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
  return `${d.getDate()}-${months[d.getMonth()]}, ${time}`;
}

export function formatChatTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (isToday) return time;

  const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
  return `${d.getDate()}-${months[d.getMonth()]}, ${time}`;
}
