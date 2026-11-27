"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowUpRight,
  IconBrandTelegram,
  IconCheck,
  IconCreditCard,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconEye,
  IconHeart,
  IconKeyboard,
  IconLoader2,
  IconMessageCircle,
  IconSearch,
  IconSend,
  IconShieldCheck,
  IconShoppingBag,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { Language } from "@/app/lib/i18n/types";
import { DEMO_CATALOG, DemoCategory, DemoProduct } from "./demoCatalog";

interface DemoOrderSummary {
  order_code: string;
  product_id: string;
  product_name: string;
  price: number;
  warranty: string;
  customer_name: string;
  phone: string;
  address: string;
  status: string;
  bot_notified?: boolean;
}

interface DemoMessage {
  id: string;
  seq: number;
  from: "user" | "bot";
  sender_name: string;
  via: "web" | "telegram_bot" | "ai";
  text: string;
  ts: string;
  quoted?: { name: string; text: string } | null;
  order?: DemoOrderSummary | null;
}

type ViewTab = "chat" | "channel";
type ChannelFilter = "all" | DemoCategory;

const COPY: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    desc: string;
    botLabel: string;
    botRole: string;
    channelName: string;
    channelHandle: string;
    channelCount: string;
    liveLabel: string;
    tgLinked: string;
    tgOpen: string;
    catalogTab: string;
    chatTab: string;
    searchPlaceholder: string;
    emptyCatalog: string;
    all: string;
    laptop: string;
    pc: string;
    monitor: string;
    accessory: string;
    orderBtn: string;
    askBtn: string;
    installmentBtn: string;
    inStock: string;
    lowStock: string;
    warrantyLabel: string;
    typingSuffix: string;
    composePlaceholder: string;
    orderFormTitle: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    addressPlaceholder: string;
    submitOrder: string;
    quickPrompts: string[];
    footNote: string;
    viaBotTag: string;
  }
> = {
  uz: {
    eyebrow: "Jonli sinov · @Selloi_ai_bot",
    title: "Do'kon sotuvchisini hoziroq sinab ko'ring",
    desc: "Xabar yozing yoki katalogdagi 100 ta kompyuterdan birini tanlang — real vaqtda AI javob beradi, buyurtma bersangiz @Selloi_ai_bot shu yerda tasdiqlaydi.",
    botLabel: "Selloi AI",
    botRole: "@Selloi_ai_bot · real vaqtda",
    channelName: "TechZone UZ",
    channelHandle: "@Test_pcssss",
    channelCount: "100 ta mahsulot",
    liveLabel: "Jonli aloqa",
    tgLinked: "@Selloi_ai_bot ulangan",
    tgOpen: "@Selloi_ai_bot da ochish",
    catalogTab: "Katalog (100)",
    chatTab: "Suhbat",
    searchPlaceholder: "Model, GPU yoki narx bo'yicha qidiring...",
    emptyCatalog: "So'rov bo'yicha mahsulot topilmadi",
    all: "Hammasi",
    laptop: "Noutbuklar",
    pc: "Gaming PC",
    monitor: "Monitorlar",
    accessory: "Aksessuarlar",
    orderBtn: "Buyurtma berish",
    askBtn: "AI dan so'rash",
    installmentBtn: "12 oy nasiya",
    inStock: "dona bor",
    lowStock: "dona qoldi",
    warrantyLabel: "kafolat",
    typingSuffix: "javob yozmoqda...",
    composePlaceholder: "Savolingizni yozing (masalan: 20 mln atrofida RTX 4070)...",
    orderFormTitle: "Tezkor buyurtma — @Selloi_ai_bot javob qaytaradi",
    namePlaceholder: "Ismingiz",
    phonePlaceholder: "+998 90 123 45 67",
    addressPlaceholder: "Shahar / tuman (masalan: Toshkent)",
    submitOrder: "Tasdiqlash",
    quickPrompts: [
      "20 mln gacha gaming noutbuk",
      "MacBook Pro M4 narxi",
      "RTX 4090 kompyuter bormi?",
      "12 oylik nasiya shartlari",
    ],
    footNote: "Haqiqiy katalog va real vaqtli @Selloi_ai_bot javobi — do'koningiz kanali ham xuddi shunday ulanadi.",
    viaBotTag: "@Selloi_ai_bot javobi",
  },
  ru: {
    eyebrow: "Живое демо · @Selloi_ai_bot",
    title: "Протестируйте AI-продавца прямо сейчас",
    desc: "Напишите вопрос или выберите модель из 100 товаров каталога — AI отвечает в реальном времени, а при заказе @Selloi_ai_bot сразу отвечает здесь же.",
    botLabel: "Selloi AI",
    botRole: "@Selloi_ai_bot · в сети",
    channelName: "TechZone UZ",
    channelHandle: "@Test_pcssss",
    channelCount: "100 товаров",
    liveLabel: "Онлайн",
    tgLinked: "@Selloi_ai_bot подключён",
    tgOpen: "Открыть в @Selloi_ai_bot",
    catalogTab: "Каталог (100)",
    chatTab: "Чат",
    searchPlaceholder: "Поиск по модели, GPU или коду...",
    emptyCatalog: "По вашему запросу ничего не найдено",
    all: "Все",
    laptop: "Ноутбуки",
    pc: "Игровые ПК",
    monitor: "Мониторы",
    accessory: "Аксессуары",
    orderBtn: "Заказать",
    askBtn: "Спросить AI",
    installmentBtn: "Рассрочка 12 мес",
    inStock: "шт. в наличии",
    lowStock: "шт. осталось",
    warrantyLabel: "гарантия",
    typingSuffix: "печатает...",
    composePlaceholder: "Напишите вопрос (например: ноутбук до 20 млн)...",
    orderFormTitle: "Быстрый заказ — @Selloi_ai_bot ответит в чате",
    namePlaceholder: "Ваше имя",
    phonePlaceholder: "+998 90 123 45 67",
    addressPlaceholder: "Город / адрес",
    submitOrder: "Оформить заказ",
    quickPrompts: [
      "Игровой ноутбук до 20 млн",
      "Цена MacBook Pro M4",
      "Есть ПК с RTX 4090?",
      "Условия рассрочки на 12 мес",
    ],
    footNote: "Реальный каталог и мгновенный ответ от @Selloi_ai_bot — ваш канал подключается точно так же.",
    viaBotTag: "Ответ @Selloi_ai_bot",
  },
  en: {
    eyebrow: "Live demo · @Selloi_ai_bot",
    title: "Try the live AI store assistant right now",
    desc: "Ask any question or pick from 100 real products — AI replies in real time, and placing a test order triggers a live confirmation from @Selloi_ai_bot.",
    botLabel: "Selloi AI",
    botRole: "@Selloi_ai_bot · online",
    channelName: "TechZone UZ",
    channelHandle: "@Test_pcssss",
    channelCount: "100 items",
    liveLabel: "Live stream",
    tgLinked: "@Selloi_ai_bot linked",
    tgOpen: "Continue in @Selloi_ai_bot",
    catalogTab: "Catalog (100)",
    chatTab: "Chat",
    searchPlaceholder: "Search by model, GPU, or code...",
    emptyCatalog: "No matching products found",
    all: "All",
    laptop: "Laptops",
    pc: "Gaming PCs",
    monitor: "Monitors",
    accessory: "Accessories",
    orderBtn: "Order item",
    askBtn: "Ask AI",
    installmentBtn: "12-mo plan",
    inStock: "in stock",
    lowStock: "left",
    warrantyLabel: "warranty",
    typingSuffix: "typing...",
    composePlaceholder: "Ask about specs, budget, or installments...",
    orderFormTitle: "Quick order — @Selloi_ai_bot replies live",
    namePlaceholder: "Your name",
    phonePlaceholder: "+998 90 123 45 67",
    addressPlaceholder: "City / district",
    submitOrder: "Confirm order",
    quickPrompts: [
      "Gaming laptop under 20M UZS",
      "MacBook Pro M4 price",
      "RTX 4090 PC options",
      "12-month installment details",
    ],
    footNote: "Backed by the real 100-item catalog and live @Selloi_ai_bot order replies.",
    viaBotTag: "@Selloi_ai_bot reply",
  },
};

function fmtPrice(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}

function fmtCount(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function nowTime() {
  return new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function CategoryIcon({ cat }: { cat: DemoCategory }) {
  if (cat === "pc") return <IconDeviceDesktop size={14} />;
  if (cat === "monitor") return <IconDeviceDesktop size={14} />;
  if (cat === "accessory") return <IconKeyboard size={14} />;
  return <IconDeviceLaptop size={14} />;
}

function ChannelPostCard({
  p,
  copy,
  onAsk,
  onOrder,
  onInstallment,
}: {
  p: DemoProduct;
  copy: (typeof COPY)["uz"];
  onAsk: (p: DemoProduct) => void;
  onOrder: (p: DemoProduct) => void;
  onInstallment: (p: DemoProduct) => void;
}) {
  const seed = hashSeed(p.id);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState((seed % 72) + 12);
  const views = (seed % 1900) + 140;

  const catLabel =
    p.category === "pc"
      ? copy.pc
      : p.category === "monitor"
      ? copy.monitor
      : p.category === "accessory"
      ? copy.accessory
      : copy.laptop;

  return (
    <article className="sdemo-card">
      <div className="sdemo-card-head">
        <span className="sdemo-cat-pill">
          <CategoryIcon cat={p.category} />
          <span>{catLabel}</span>
        </span>
        <div className="sdemo-card-meta-right">
          <span className="sdemo-sku">{p.id}</span>
          <span className={`sdemo-stock${p.stock <= 2 ? " is-low" : ""}`}>
            {p.stock} {p.stock <= 2 ? copy.lowStock : copy.inStock}
          </span>
        </div>
      </div>

      <h3 className="sdemo-card-title">{p.name}</h3>
      <p className="sdemo-card-specs">{p.specs}</p>

      <div className="sdemo-card-pricing">
        <span className="sdemo-price">{fmtPrice(p.price)}</span>
        <span className="sdemo-warranty">
          <IconShieldCheck size={13} />
          <span>
            {p.warranty} {copy.warrantyLabel}
          </span>
        </span>
      </div>

      <div className="sdemo-card-actions">
        <button type="button" className="sdemo-btn-order" onClick={() => onOrder(p)}>
          <IconShoppingBag size={14} />
          <span>{copy.orderBtn}</span>
        </button>
        <button type="button" className="sdemo-btn-ghost" onClick={() => onAsk(p)}>
          <IconSparkles size={14} />
          <span>{copy.askBtn}</span>
        </button>
        <button type="button" className="sdemo-btn-ghost" onClick={() => onInstallment(p)}>
          <IconCreditCard size={14} />
          <span>{copy.installmentBtn}</span>
        </button>
      </div>

      <div className="sdemo-card-foot">
        <button
          type="button"
          className={`sdemo-like-btn${liked ? " is-active" : ""}`}
          onClick={() => {
            setLiked((prev) => !prev);
            setLikes((n) => (liked ? n - 1 : n + 1));
          }}
        >
          <IconHeart size={13} />
          <span>{likes}</span>
        </button>
        <span className="sdemo-views">
          <IconEye size={13} />
          <span>{fmtCount(views)}</span>
        </span>
      </div>
    </article>
  );
}

function ChatBubble({
  msg,
  copy,
  onOpenCatalog,
}: {
  msg: DemoMessage;
  copy: (typeof COPY)["uz"];
  onOpenCatalog: () => void;
}) {
  const isUser = msg.from === "user";
  const isTelegramBot = !isUser && msg.via === "telegram_bot";

  return (
    <div className={`sdemo-msg-row${isUser ? " is-out" : ""}`}>
      {!isUser && (
        <div className={`sdemo-avatar-sm${isTelegramBot ? " is-tg" : ""}`} aria-hidden="true">
          {isTelegramBot ? <IconBrandTelegram size={15} /> : <IconSparkles size={15} />}
        </div>
      )}
      <div className={`sdemo-bubble${isUser ? " is-out" : " is-in"}${isTelegramBot ? " is-bot-reply" : ""}`}>
        {!isUser && (
          <div className="sdemo-bubble-head">
            <span className="sdemo-bubble-author">{msg.sender_name || copy.botLabel}</span>
            {isTelegramBot && (
              <span className="sdemo-bot-pill">
                <IconBrandTelegram size={11} />
                <span>{copy.viaBotTag}</span>
              </span>
            )}
          </div>
        )}

        {msg.quoted && (
          <div className="sdemo-quote">
            <div className="sdemo-quote-title">{msg.quoted.name}</div>
            <div className="sdemo-quote-body">{msg.quoted.text}</div>
          </div>
        )}

        <div className="sdemo-bubble-text">{msg.text}</div>

        {msg.order && (
          <div className="sdemo-receipt">
            <div className="sdemo-receipt-top">
              <span className="sdemo-receipt-code">{msg.order.order_code}</span>
              <span className="sdemo-receipt-status">
                <IconCheck size={12} />
                <span>{msg.order.status}</span>
              </span>
            </div>
            <div className="sdemo-receipt-row">
              <span>{msg.order.product_name}</span>
              <strong>{fmtPrice(msg.order.price)}</strong>
            </div>
            <button type="button" className="sdemo-receipt-link" onClick={onOpenCatalog}>
              {copy.catalogTab}
            </button>
          </div>
        )}

        <div className="sdemo-bubble-time">
          <span>{msg.ts}</span>
          {isUser && <IconCheck size={12} className="sdemo-tick" />}
        </div>
      </div>
    </div>
  );
}

export function ConversationDemoSection({ language = "uz" }: { language?: Language }) {
  const copy = COPY[language] || COPY.uz;

  const [tab, setTab] = useState<ViewTab>("chat");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [channelSearch, setChannelSearch] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>("Selloi_ai_bot");
  const [botUrl, setBotUrl] = useState<string>("https://t.me/Selloi_ai_bot");
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramHandle, setTelegramHandle] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "msg_welcome",
      seq: 1,
      from: "bot",
      sender_name: "Selloi AI",
      via: "ai",
      text:
        language === "ru"
          ? "Здравствуйте. Напишите, какой ноутбук, ПК или монитор из каталога TechZone вас интересует — подберу подходящие варианты и сразу покажу ответ @Selloi_ai_bot при заказе."
          : language === "en"
          ? "Hello. Ask about any laptop, PC, or monitor in our 100-item catalog — I will match options live and trigger an instant @Selloi_ai_bot confirmation if you order."
          : "Assalomu alaykum. TechZone katalogidan qaysi noutbuk, kompyuter yoki monitor kerakligini yozing — mos variantlarni tanlab beraman.\n\nSinov chog'ida buyurtma bersangiz, @Selloi_ai_bot shu yerda tasdiq javobini yuboradi.",
      ts: nowTime(),
    },
  ]);

  const [orders, setOrders] = useState<DemoOrderSummary[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingSender, setTypingSender] = useState<string | null>(null);
  const [quotedProduct, setQuotedProduct] = useState<DemoProduct | null>(null);
  const [orderDrawerProduct, setOrderDrawerProduct] = useState<DemoProduct | null>(null);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("Toshkent");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const latestSeqRef = useRef<number>(1);
  const msgIdsRef = useRef<Set<string>>(new Set(["msg_welcome"]));

  const appendUniqueMessages = useCallback((incoming: DemoMessage[]) => {
    if (!incoming || incoming.length === 0) return;
    setMessages((prev) => {
      const next = [...prev];
      let changed = false;
      for (const m of incoming) {
        if (!m || msgIdsRef.current.has(m.id)) {
          // Update welcome copy if language refreshed
          if (m?.id === "msg_welcome" && prev.length === 1 && prev[0]?.id === "msg_welcome" && prev[0].text !== m.text) {
            next[0] = m;
            changed = true;
          }
          continue;
        }
        msgIdsRef.current.add(m.id);
        next.push(m);
        if (m.seq > latestSeqRef.current) latestSeqRef.current = m.seq;
        if (m.order) {
          setOrders((oPrev) =>
            oPrev.some((x) => x.order_code === m.order!.order_code) ? oPrev : [...oPrev, m.order!]
          );
        }
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // Initialize or resume real-time backend session
  useEffect(() => {
    let cancelled = false;
    const savedSid = typeof window !== "undefined" ? sessionStorage.getItem("selloi_demo_sid") : null;

    fetch("/api/demo/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: savedSid || null, language }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.session_id) return;
        setSessionId(data.session_id);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("selloi_demo_sid", data.session_id);
        }
        if (data.bot_username) setBotUsername(data.bot_username);
        if (data.bot_url) setBotUrl(data.bot_url);
        setTelegramLinked(Boolean(data.telegram_linked));
        setTelegramHandle(data.telegram_username || null);
        if (Array.isArray(data.orders)) setOrders(data.orders);
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          // Reset dedupe set if session brought server history
          if (data.messages.length > 1 || messages.length <= 1) {
            msgIdsRef.current = new Set(data.messages.map((m: DemoMessage) => m.id));
            latestSeqRef.current = data.latest_seq || data.messages[data.messages.length - 1]?.seq || 1;
            setMessages(data.messages);
          }
        }
      })
      .catch(() => {
        // Silent graceful fallback if backend unavailable in static preview
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  // Connect live SSE stream for instant @Selloi_ai_bot replies & Telegram sync
  useEffect(() => {
    if (!sessionId) return;
    let closed = false;
    const es = new EventSource(`/api/demo/events?session_id=${encodeURIComponent(sessionId)}`);

    es.addEventListener("connected", () => {
      if (!closed) setLiveConnected(true);
    });

    es.addEventListener("message", (evt) => {
      try {
        const msg = JSON.parse((evt as MessageEvent).data) as DemoMessage;
        appendUniqueMessages([msg]);
        setTypingSender(null);
      } catch {
        // ignore malformed frame
      }
    });

    es.addEventListener("typing", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as { active?: boolean; sender?: string };
        setTypingSender(data.active ? data.sender || "Selloi AI" : null);
      } catch {
        // ignore
      }
    });

    es.addEventListener("telegram_linked", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as { telegram_linked?: boolean; telegram_username?: string | null };
        setTelegramLinked(Boolean(data.telegram_linked));
        if (data.telegram_username) setTelegramHandle(data.telegram_username);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      if (!closed) setLiveConnected(false);
    };

    // Periodic lightweight delta check every 5s so even across proxy reconnects nothing is missed
    const syncTimer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/demo/session?session_id=${encodeURIComponent(sessionId)}&after_seq=${latestSeqRef.current}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          appendUniqueMessages(data.messages);
        }
        if (data.telegram_linked) {
          setTelegramLinked(true);
          if (data.telegram_username) setTelegramHandle(data.telegram_username);
        }
      } catch {
        // ignore transient network check
      }
    }, 5000);

    return () => {
      closed = true;
      es.close();
      clearInterval(syncTimer);
    };
  }, [sessionId, appendUniqueMessages]);

  useEffect(() => {
    if (messagesBoxRef.current) {
      messagesBoxRef.current.scrollTo({
        top: messagesBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, typingSender, orderDrawerProduct]);

  const filteredProducts = useMemo(() => {
    let list = channelFilter === "all" ? DEMO_CATALOG : DEMO_CATALOG.filter((p) => p.category === channelFilter);
    if (channelSearch.trim()) {
      const q = channelSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.specs.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [channelFilter, channelSearch]);

  const ensureActiveSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    try {
      const res = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.session_id) {
        setSessionId(data.session_id);
        if (data.bot_url) setBotUrl(data.bot_url);
        if (typeof window !== "undefined") sessionStorage.setItem("selloi_demo_sid", data.session_id);
        return data.session_id;
      }
    } catch {
      return null;
    }
    return null;
  }, [sessionId, language]);

  const sendMessage = useCallback(
    async (text: string, quoted?: DemoProduct | null) => {
      const clean = text.trim();
      if (!clean && !quoted) return;
      const finalText = clean || `${quoted?.name} narxi va mavjudligi haqida ma'lumot bering`;

      setTab("chat");
      setInput("");
      setQuotedProduct(null);
      setErrorBanner(null);

      const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const sid = await ensureActiveSession();

      if (!sid) {
        // Offline fallback (e.g. standalone frontend test without backend)
        appendUniqueMessages([
          {
            id: tempId,
            seq: latestSeqRef.current + 1,
            from: "user",
            sender_name: "Siz",
            via: "web",
            text: finalText,
            ts: nowTime(),
            quoted: quoted ? { name: quoted.name, text: fmtPrice(quoted.price) } : null,
          },
        ]);
        return;
      }

      setSending(true);
      setTypingSender("Selloi AI");
      try {
        const res = await fetch("/api/demo/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sid,
            text: finalText,
            product_id: quoted?.id || null,
            language,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorBanner(data.detail || "Xabar yuborishda xatolik yuz berdi");
        } else {
          const toAdd: DemoMessage[] = [];
          if (data.user_message) toAdd.push(data.user_message);
          if (data.bot_message) toAdd.push(data.bot_message);
          appendUniqueMessages(toAdd);
        }
      } catch {
        setErrorBanner("Aloqa uzildi, qayta urinib ko'ring.");
      } finally {
        setSending(false);
        setTypingSender(null);
      }
    },
    [ensureActiveSession, language, appendUniqueMessages]
  );

  const handleOpenOrderDrawer = useCallback((p: DemoProduct) => {
    setOrderDrawerProduct(p);
    setQuotedProduct(null);
    setErrorBanner(null);
    setTab("chat");
  }, []);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderDrawerProduct || !custName.trim() || !custPhone.trim()) return;

    const sid = await ensureActiveSession();
    setOrderSubmitting(true);
    setErrorBanner(null);
    setTypingSender(`@${botUsername}`);

    try {
      if (!sid) throw new Error("Sessiya ochilmadi");
      const res = await fetch("/api/demo/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sid,
          product_id: orderDrawerProduct.id,
          customer_name: custName.trim(),
          phone: custPhone.trim(),
          address: custAddress.trim() || "Toshkent",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorBanner(data.detail || "Buyurtmani tasdiqlab bo'lmadi");
        return;
      }
      const toAdd: DemoMessage[] = [];
      if (data.user_message) toAdd.push(data.user_message);
      if (data.bot_message) toAdd.push(data.bot_message);
      appendUniqueMessages(toAdd);
      setOrderDrawerProduct(null);
    } catch {
      setErrorBanner("Buyurtma yuborishda tarmoq xatoligi yuz berdi.");
    } finally {
      setOrderSubmitting(false);
      setTypingSender(null);
    }
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    sendMessage(input, quotedProduct);
  };

  const filterOptions: { key: ChannelFilter; label: string }[] = [
    { key: "all", label: copy.all },
    { key: "laptop", label: copy.laptop },
    { key: "pc", label: copy.pc },
    { key: "monitor", label: copy.monitor },
    { key: "accessory", label: copy.accessory },
  ];

  const lastPreview = messages[messages.length - 1]?.text.split("\n")[0].slice(0, 36) || copy.botRole;

  return (
    <section className="sdemo-section selloi-reveal-item" id="suhbat-namunasi">
      <div className="sdemo-header">
        <div className="sdemo-eyebrow">
          <span className={`sdemo-live-dot${liveConnected ? " is-live" : ""}`} />
          <span>{copy.eyebrow}</span>
        </div>
        <h2 className="sdemo-title">{copy.title}</h2>
        <p className="sdemo-subtitle">{copy.desc}</p>
      </div>

      <div className="sdemo-shell">
        {/* Top Workspace Bar */}
        <div className="sdemo-topbar">
          <div className="sdemo-topbar-left">
            <div className="sdemo-mobile-tabs">
              <button
                type="button"
                className={`sdemo-mobile-tab${tab === "chat" ? " is-active" : ""}`}
                onClick={() => setTab("chat")}
              >
                <IconMessageCircle size={14} />
                <span>{copy.chatTab}</span>
              </button>
              <button
                type="button"
                className={`sdemo-mobile-tab${tab === "channel" ? " is-active" : ""}`}
                onClick={() => setTab("channel")}
              >
                <IconShoppingBag size={14} />
                <span>{copy.catalogTab}</span>
              </button>
            </div>
            <div className="sdemo-topbar-brand">
              <IconBrandTelegram size={16} className="sdemo-tg-accent" />
              <span>@{botUsername}</span>
              <span className="sdemo-sep">/</span>
              <span className="sdemo-muted">{copy.channelName}</span>
            </div>
          </div>

          <div className="sdemo-topbar-right">
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`sdemo-bot-connect${telegramLinked ? " is-linked" : ""}`}
            >
              <IconBrandTelegram size={14} />
              <span>{telegramLinked ? (telegramHandle ? `@${telegramHandle}` : copy.tgLinked) : copy.tgOpen}</span>
              {!telegramLinked && <IconArrowUpRight size={13} />}
            </a>
          </div>
        </div>

        {/* Workspace Split */}
        <div className="sdemo-workspace">
          {/* Sidebar */}
          <aside className="sdemo-sidebar">
            <div className="sdemo-side-heading">Kanallar va bot</div>

            <button
              type="button"
              className={`sdemo-nav-item${tab === "chat" ? " is-active" : ""}`}
              onClick={() => setTab("chat")}
            >
              <div className="sdemo-nav-icon is-bot">
                <IconSparkles size={18} />
              </div>
              <div className="sdemo-nav-meta">
                <div className="sdemo-nav-title">
                  <span>{copy.botLabel}</span>
                  <span className="sdemo-verified-dot" title="Verified" />
                </div>
                <div className="sdemo-nav-sub">{lastPreview}</div>
              </div>
              {typingSender && <span className="sdemo-pulse-pill" />}
            </button>

            <button
              type="button"
              className={`sdemo-nav-item${tab === "channel" ? " is-active" : ""}`}
              onClick={() => setTab("channel")}
            >
              <div className="sdemo-nav-icon is-store">
                <IconShoppingBag size={18} />
              </div>
              <div className="sdemo-nav-meta">
                <div className="sdemo-nav-title">
                  <span>{copy.channelName}</span>
                </div>
                <div className="sdemo-nav-sub">
                  {copy.channelHandle} · {copy.channelCount}
                </div>
              </div>
              <span className="sdemo-count-badge">100</span>
            </button>

            {orders.length > 0 && (
              <div className="sdemo-side-orders">
                <div className="sdemo-side-heading">Buyurtmalar ({orders.length})</div>
                {orders.slice(-3).reverse().map((ord) => (
                  <div key={ord.order_code} className="sdemo-side-order-card">
                    <div className="sdemo-side-order-top">
                      <span>{ord.order_code}</span>
                      <span className="sdemo-side-order-ok">{ord.status}</span>
                    </div>
                    <div className="sdemo-side-order-name">{ord.product_name}</div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Main Stage */}
          <div className="sdemo-main">
            {tab === "channel" ? (
              <>
                <div className="sdemo-pane-header">
                  <div>
                    <div className="sdemo-pane-title">{copy.channelName}</div>
                    <div className="sdemo-pane-sub">
                      {copy.channelHandle} · {copy.channelCount}
                    </div>
                  </div>
                  <button type="button" className="sdemo-switch-btn" onClick={() => setTab("chat")}>
                    <IconMessageCircle size={14} />
                    <span>{copy.chatTab}</span>
                  </button>
                </div>

                <div className="sdemo-toolbar">
                  <div className="sdemo-search-wrap">
                    <IconSearch size={15} className="sdemo-search-icon" />
                    <input
                      className="sdemo-search-input"
                      placeholder={copy.searchPlaceholder}
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                    />
                  </div>
                  <div className="sdemo-filters">
                    {filterOptions.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`sdemo-filter-btn${channelFilter === opt.key ? " is-active" : ""}`}
                        onClick={() => setChannelFilter(opt.key)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sdemo-feed">
                  {filteredProducts.length === 0 ? (
                    <div className="sdemo-empty">{copy.emptyCatalog}</div>
                  ) : (
                    filteredProducts.map((p) => (
                      <ChannelPostCard
                        key={p.id}
                        p={p}
                        copy={copy}
                        onAsk={(item) => {
                          setQuotedProduct(item);
                          setOrderDrawerProduct(null);
                          setTab("chat");
                        }}
                        onOrder={handleOpenOrderDrawer}
                        onInstallment={(item) =>
                          sendMessage(`${item.name} (${fmtPrice(item.price)}) uchun 12 oylik nasiya shartlarini hisoblab bering`, item)
                        }
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="sdemo-pane-header">
                  <div>
                    <div className="sdemo-pane-title">
                      {copy.botLabel} <span className="sdemo-handle-muted">@{botUsername}</span>
                    </div>
                    <div className="sdemo-pane-sub">
                      {typingSender ? `${typingSender} ${copy.typingSuffix}` : copy.liveLabel}
                    </div>
                  </div>
                  <button type="button" className="sdemo-switch-btn" onClick={() => setTab("channel")}>
                    <IconShoppingBag size={14} />
                    <span>{copy.catalogTab}</span>
                  </button>
                </div>

                <div className="sdemo-messages" ref={messagesBoxRef}>
                  {messages.map((m) => (
                    <ChatBubble
                      key={m.id}
                      msg={m}
                      copy={copy}
                      onOpenCatalog={() => setTab("channel")}
                    />
                  ))}
                  {typingSender && (
                    <div className="sdemo-msg-row">
                      <div className="sdemo-avatar-sm is-tg" aria-hidden="true">
                        <IconBrandTelegram size={15} />
                      </div>
                      <div className="sdemo-bubble is-in sdemo-typing-bubble">
                        <span className="tg-typing-dot" />
                        <span className="tg-typing-dot" />
                        <span className="tg-typing-dot" />
                      </div>
                    </div>
                  )}
                </div>

                {errorBanner && <div className="sdemo-error-bar">{errorBanner}</div>}

                {/* Quick Order Drawer */}
                {orderDrawerProduct && (
                  <form className="sdemo-order-drawer" onSubmit={handleOrderSubmit}>
                    <div className="sdemo-order-drawer-head">
                      <div>
                        <div className="sdemo-order-drawer-title">{copy.orderFormTitle}</div>
                        <div className="sdemo-order-drawer-item">
                          {orderDrawerProduct.name} · <strong>{fmtPrice(orderDrawerProduct.price)}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="sdemo-icon-close"
                        onClick={() => setOrderDrawerProduct(null)}
                        aria-label="Close order drawer"
                      >
                        <IconX size={15} />
                      </button>
                    </div>
                    <div className="sdemo-order-fields">
                      <input
                        className="sdemo-field"
                        placeholder={copy.namePlaceholder}
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        required
                      />
                      <input
                        className="sdemo-field"
                        placeholder={copy.phonePlaceholder}
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        required
                      />
                      <input
                        className="sdemo-field sdemo-field-addr"
                        placeholder={copy.addressPlaceholder}
                        value={custAddress}
                        onChange={(e) => setCustAddress(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="sdemo-order-submit"
                        disabled={orderSubmitting || !custName.trim() || !custPhone.trim()}
                      >
                        {orderSubmitting ? <IconLoader2 size={14} className="spin" /> : <IconSend size={14} />}
                        <span>{copy.submitOrder}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Quick Prompt Chips */}
                <div className="sdemo-quick-row">
                  {copy.quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="sdemo-quick-chip"
                      disabled={sending}
                      onClick={() => sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Quoted Product Context */}
                {quotedProduct && (
                  <div className="sdemo-quote-bar">
                    <div className="sdemo-quote-bar-accent" />
                    <div className="sdemo-quote-bar-info">
                      <div className="sdemo-quote-bar-title">{quotedProduct.name}</div>
                      <div className="sdemo-quote-bar-sub">{fmtPrice(quotedProduct.price)}</div>
                    </div>
                    <button
                      type="button"
                      className="sdemo-icon-close"
                      onClick={() => setQuotedProduct(null)}
                      aria-label="Clear quoted product"
                    >
                      <IconX size={15} />
                    </button>
                  </div>
                )}

                {/* Input Compose Bar */}
                <form className="sdemo-compose" onSubmit={handleSubmitChat}>
                  <input
                    className="sdemo-compose-input"
                    placeholder={copy.composePlaceholder}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    className="sdemo-send-btn"
                    disabled={sending || (!input.trim() && !quotedProduct)}
                    aria-label="Send message"
                  >
                    {sending ? <IconLoader2 size={17} className="spin" /> : <IconSend size={17} />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="sdemo-footnote">{copy.footNote}</p>
    </section>
  );
}

export default ConversationDemoSection;
