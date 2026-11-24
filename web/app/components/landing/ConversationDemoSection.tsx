"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Language } from "@/app/lib/i18n/types";
import { SelloiTranslations } from "./selloiI18n";
import {
  TELEGRAM_COMPUTER_CATALOG,
  TelegramComputerProduct,
  ComputerCategory,
  formatUzs,
  matchCatalogProducts,
} from "./telegramDemoCatalog";
import {
  TgPaperPlaneIcon,
  TgVerifiedBadge,
  TgDoubleCheckIcon,
  TgMegaphoneIcon,
  TgBotIcon,
  TgSearchIcon,
  TgMenuIcon,
  TgAttachIcon,
  TgSmileIcon,
  TgEyeIcon,
  TgPinIcon,
  TgHardwareIcon,
} from "./TelegramIcons";

interface ConversationDemoSectionProps {
  onOpenOnboarding: () => void;
  isAuthenticated?: boolean;
  language?: Language;
  t: SelloiTranslations["suhbatNamunasi"];
}

interface TgChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  time: string;
  quote?: {
    author: string;
    text: string;
  };
  photoProduct?: TelegramComputerProduct;
  matchedProducts?: TelegramComputerProduct[];
  showUtilityButtons?: boolean;
  orderProduct?: TelegramComputerProduct;
  orderCode?: string;
}

const HERO_LAPTOP = TELEGRAM_COMPUTER_CATALOG[0]; // TZ-001 ASUS ROG Strix G16
const VISION_RIG = TELEGRAM_COMPUTER_CATALOG[37] || TELEGRAM_COMPUTER_CATALOG[35]; // TZ-038 / PC build

function formatTimeNow(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function TgOrderCard({
  product,
  orderCode,
  language,
  t,
}: {
  product: TelegramComputerProduct;
  orderCode: string;
  language: Language;
  t: SelloiTranslations["suhbatNamunasi"];
}) {
  return (
    <div className="selloi-tg-order-card">
      <div className="selloi-tg-order-top">
        <span className="selloi-tg-order-title">
          <span className="selloi-tg-order-check">✓</span>
          <span>
            {t.orderBadge.replace("#TZ-4821", `#${orderCode}`)}
          </span>
        </span>
        <span className="selloi-tg-order-badge">{t.orderChipLabel}</span>
      </div>
      <div className="selloi-tg-order-rows">
        <div className="selloi-tg-order-row">
          <span>{t.orderProductLabel}</span>
          <strong>
            {product.name} ({product.code})
          </strong>
        </div>
        <div className="selloi-tg-order-row">
          <span>{t.orderPriceLabel}</span>
          <strong className="selloi-tg-order-price">
            {formatUzs(product.priceUzs, language)}
          </strong>
        </div>
      </div>
      <div className="selloi-tg-order-status">
        <span className="selloi-tg-order-dot" />
        <span>
          {t.orderStatus} • {product.warrantyMonths} {t.tg.warrantyLabel}
        </span>
      </div>
    </div>
  );
}

function TgPhotoAttachment({
  product,
  language,
  photoLabel,
  caption,
}: {
  product: TelegramComputerProduct;
  language: Language;
  photoLabel: string;
  caption: string;
}) {
  return (
    <div className="selloi-tg-photo-msg">
      <div className="selloi-tg-photo-art">
        <div className="selloi-tg-photo-top-row">
          <span className="selloi-tg-photo-pill">{photoLabel}</span>
          <span className="selloi-tg-photo-code">{product.code}</span>
        </div>
        <div className="selloi-tg-photo-icon-wrap">
          <TgHardwareIcon category={product.category} size={36} />
        </div>
        <div className="selloi-tg-photo-caption-bar">
          <strong>{product.name}</strong>
          <span>{formatUzs(product.priceUzs, language)}</span>
        </div>
      </div>
      <p className="selloi-tg-bubble-text">{caption}</p>
    </div>
  );
}

export default function ConversationDemoSection({
  onOpenOnboarding,
  isAuthenticated = false,
  language = "uz",
  t,
}: ConversationDemoSectionProps) {
  const tg = t.tg;

  // Pane state: "chat" = Selloi AI seller, "channel" = TechZone UZ 100-product channel
  const [activePane, setActivePane] = useState<"chat" | "channel">("chat");

  // Automated demo state (runs until user interacts)
  const [step, setStep] = useState<number>(0);
  const [typedInput, setTypedInput] = useState<string>("");
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Interactive Live Telegram Chat state
  const [interactiveMode, setInteractiveMode] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>("");
  const [customMessages, setCustomMessages] = useState<TgChatMessage[]>([]);
  const [isBotTyping, setIsBotTyping] = useState<boolean>(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);

  // Sidebar & 100-Product Channel Filter state
  const [sidebarSearch, setSidebarSearch] = useState<string>("");
  const [channelCategory, setChannelCategory] = useState<"all" | ComputerCategory>("all");
  const [channelQuery, setChannelQuery] = useState<string>("");
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>({});

  const sectionRef = useRef<HTMLElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isHoveredRef = useRef<boolean>(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    return TELEGRAM_COMPUTER_CATALOG.filter((item) => {
      if (channelCategory !== "all" && item.category !== channelCategory) {
        return false;
      }
      if (!q) return true;
      return `${item.code} ${item.brand} ${item.name} ${item.specs} ${item.category}`
        .toLowerCase()
        .includes(q);
    });
  }, [channelCategory, channelQuery]);

  // Viewport Intersection trigger
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || hasStarted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted]);

  // Keep chat scrolled smoothly to bottom (never scrolling outer window)
  useEffect(() => {
    if (activePane === "chat" && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activePane, step, customMessages.length, isBotTyping]);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, []);

  // Automated Telegram Showcase sequence
  useEffect(() => {
    if (!hasStarted || interactiveMode || activePane !== "chat") return;
    let timer: ReturnType<typeof setTimeout>;
    let checkHover: ReturnType<typeof setInterval> | null = null;

    if (step === 0) {
      const fullText = t.step1UserText;
      let charIdx = 0;
      setTypedInput("");

      const typeInterval = setInterval(() => {
        charIdx++;
        setTypedInput(fullText.slice(0, charIdx));
        if (charIdx >= fullText.length) {
          clearInterval(typeInterval);
          timer = setTimeout(() => {
            setTypedInput("");
            setStep(1);
          }, 320);
        }
      }, 20);

      return () => {
        clearInterval(typeInterval);
        clearTimeout(timer);
      };
    }

    if (step === 1) {
      timer = setTimeout(() => setStep(2), 750);
    } else if (step === 2) {
      timer = setTimeout(() => setStep(3), 1350);
    } else if (step === 3) {
      timer = setTimeout(() => {
        setTypedInput(t.uploadingPhotoText);
        setStep(4);
      }, 1600);
    } else if (step === 4) {
      timer = setTimeout(() => {
        setTypedInput("");
        setStep(5);
      }, 850);
    } else if (step === 5) {
      timer = setTimeout(() => setStep(6), 700);
    } else if (step === 6) {
      timer = setTimeout(() => setStep(7), 1350);
    } else if (step === 7) {
      timer = setTimeout(() => setStep(8), 1000);
    } else if (step === 8) {
      timer = setTimeout(() => {
        if (!isHoveredRef.current) {
          setStep(0);
        } else {
          checkHover = setInterval(() => {
            if (!isHoveredRef.current) {
              if (checkHover) clearInterval(checkHover);
              setStep(0);
            }
          }, 1000);
        }
      }, 11000);
    }

    return () => {
      clearTimeout(timer);
      if (checkHover) clearInterval(checkHover);
    };
  }, [hasStarted, interactiveMode, activePane, step, t]);

  const enterInteractiveMode = () => {
    setHasStarted(true);
    setInteractiveMode(true);
    setTypedInput("");
  };

  const buildSmartBotResponse = (
    query: string,
    explicitPrompt?: SelloiTranslations["suhbatNamunasi"]["quickPrompts"][number]
  ): Omit<TgChatMessage, "id" | "role" | "time"> => {
    const q = query.toLowerCase();

    if (explicitPrompt?.id === "order") {
      return {
        text: explicitPrompt.botReply,
        orderProduct: HERO_LAPTOP,
        orderCode: "TZ-4821",
      };
    }

    if (/(yetkaz|dostav|достав|courier|kuryer|manzil|adres|deliver|shipping)/i.test(q)) {
      return {
        text: tg.deliveryReplyText,
        showUtilityButtons: true,
      };
    }

    if (/(buyurtma|zakaz|заказ|olaman|rasmiy|order|checkout|buy now)/i.test(q)) {
      const { matches } = matchCatalogProducts(query, TELEGRAM_COMPUTER_CATALOG);
      const chosen = matches[0] || HERO_LAPTOP;
      return {
        text: tg.orderConfirmedPrefix,
        orderProduct: chosen,
        orderCode: `TZ-${4800 + chosen.id}`,
      };
    }

    const { matches, budgetUzs } = matchCatalogProducts(query, TELEGRAM_COMPUTER_CATALOG);
    if (explicitPrompt) {
      return {
        text: explicitPrompt.botReply,
        matchedProducts: matches,
        showUtilityButtons: true,
      };
    }

    const prefix = budgetUzs ? tg.matchedBudgetText : tg.matchedHeaderText;
    return {
      text: prefix,
      matchedProducts: matches,
      showUtilityButtons: true,
    };
  };

  const sendUserText = (
    rawText: string,
    options?: {
      quote?: { author: string; text: string };
      photoProduct?: TelegramComputerProduct;
      prompt?: SelloiTranslations["suhbatNamunasi"]["quickPrompts"][number];
      directOrderProduct?: TelegramComputerProduct;
      directConsultProduct?: TelegramComputerProduct;
    }
  ) => {
    const clean = rawText.trim();
    if (!clean || isBotTyping) return;

    enterInteractiveMode();
    setActivePane("chat");
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

    const nowTime = formatTimeNow();
    const userMsg: TgChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: clean,
      time: nowTime,
      quote: options?.quote,
      photoProduct: options?.photoProduct,
    };

    setCustomMessages((prev) => [...prev, userMsg]);
    setUserInput("");

    const isPhoto = Boolean(options?.photoProduct);
    setIsBotTyping(true);
    setIsAnalyzingPhoto(isPhoto);

    replyTimerRef.current = setTimeout(() => {
      setIsBotTyping(false);
      setIsAnalyzingPhoto(false);

      let botPayload: Omit<TgChatMessage, "id" | "role" | "time">;
      if (options?.directOrderProduct) {
        const prod = options.directOrderProduct;
        botPayload = {
          text: tg.orderConfirmedPrefix,
          orderProduct: prod,
          orderCode: `TZ-${4800 + prod.id}`,
        };
      } else if (options?.directConsultProduct) {
        const prod = options.directConsultProduct;
        const monthly = Math.round((prod.priceUzs * 1.16) / 12);
        botPayload = {
          text: `${prod.name} (${prod.code}) • ${prod.specs} — ${tg.inStockLabel}: ${prod.stock}, ${prod.warrantyMonths} ${tg.warrantyLabel}. ${formatUzs(prod.priceUzs, language)} (${formatUzs(monthly, language).replace(/ (so‘m|сум|UZS)$/i, "")} ${tg.installmentSuffix}).`,
          matchedProducts: [prod],
          showUtilityButtons: true,
        };
      } else if (options?.photoProduct) {
        botPayload = {
          text: tg.photoVisionReply,
          matchedProducts: [options.photoProduct],
          showUtilityButtons: true,
        };
      } else {
        botPayload = buildSmartBotResponse(clean, options?.prompt);
      }

      setCustomMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          time: formatTimeNow(),
          ...botPayload,
        },
      ]);
    }, isPhoto ? 1100 : 720);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendUserText(userInput);
  };

  const handleQuickPrompt = (
    prompt: SelloiTranslations["suhbatNamunasi"]["quickPrompts"][number]
  ) => {
    if (prompt.id === "photo") {
      sendUserText(prompt.userText, { photoProduct: VISION_RIG, prompt });
    } else {
      sendUserText(prompt.userText, { prompt });
    }
  };

  const handlePhotoAttachClick = () => {
    sendUserText(tg.photoVisionPrompt, { photoProduct: VISION_RIG });
  };

  const handleProductConsult = (product: TelegramComputerProduct) => {
    sendUserText(
      `${product.name} (${product.code}) — ${tg.askProductPromptPrefix}`,
      {
        quote: {
          author: `${tg.channelTitle} • ${product.code}`,
          text: `${product.name} — ${formatUzs(product.priceUzs, language)}`,
        },
        directConsultProduct: product,
      }
    );
  };

  const handleProductOrder = (product: TelegramComputerProduct) => {
    sendUserText(
      `${product.name} (${product.code}) — ${tg.orderButton.replace(/^🛒\s*/, "")}`,
      {
        quote: {
          author: `${tg.channelTitle} • ${product.code}`,
          text: `${product.name} — ${formatUzs(product.priceUzs, language)}`,
        },
        directOrderProduct: product,
      }
    );
  };

  const handleAskDelivery = () => {
    sendUserText(tg.deliveryInfoButton.replace(/^🚚\s*/, ""));
  };

  const handleToggleLike = (productId: number) => {
    setLikedPosts((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    setInteractiveMode(false);
    setActivePane("chat");
    setUserInput("");
    setCustomMessages([]);
    setIsBotTyping(false);
    setIsAnalyzingPhoto(false);
    setHasStarted(true);
    setTypedInput("");
    setStep(0);
  };

  const handleCtaClick = () => {
    if (isAuthenticated) {
      window.location.href = "/dashboard";
    } else {
      onOpenOnboarding();
    }
  };

  const isAutoTypingHeader = !interactiveMode && (step === 2 || step === 6);
  const botTypingNow = isBotTyping || isAutoTypingHeader;
  const analyzingNow = isAnalyzingPhoto || (!interactiveMode && step === 6);
  const headerStatusText = analyzingNow
    ? tg.botAnalyzingStatus
    : botTypingNow
    ? tg.botTypingStatus
    : tg.botOnlineSub;

  const activeInputValue = interactiveMode ? userInput : typedInput;
  const canSubmit = interactiveMode && userInput.trim().length > 0 && !isBotTyping;

  // Sidebar live preview text
  const lastMsg = customMessages[customMessages.length - 1];
  const sidebarBotPreview = botTypingNow
    ? headerStatusText
    : lastMsg
    ? lastMsg.text
    : interactiveMode
    ? tg.chatPreviewFallback
    : step >= 3
    ? t.step2BotText
    : tg.chatPreviewFallback;

  const sq = sidebarSearch.trim().toLowerCase();
  const showBotRow = !sq || `${tg.botTitle} selloi ai bot`.toLowerCase().includes(sq);
  const showChannelRow = !sq || `${tg.channelTitle} ${tg.channelHandle} kompyuter pc laptop`.toLowerCase().includes(sq);

  return (
    <section
      ref={sectionRef}
      className="selloi-demo-section selloi-reveal-item"
      id="suhbat-namunasi"
      data-node-id="182:375"
    >
      <div className="selloi-container">
        <div className="selloi-demo-grid">
          {/* Left Column Content */}
          <div className="selloi-demo-left">
            <div>
              <p className="selloi-section-tag" data-node-id="182:376">
                {t.tag}
              </p>
              <h2 className="selloi-demo-title" data-node-id="182:377">
                {t.titleLine1}
                <br />
                {t.titleLine2}
              </h2>
              <p className="selloi-demo-desc" data-node-id="182:378">
                {t.descLine1}
                <br />
                {t.descLine2}
                <br />
                {t.descLine3}
              </p>
            </div>

            <button
              type="button"
              className="selloi-btn-glass selloi-demo-btn"
              data-node-id="173:115"
              onClick={handleCtaClick}
            >
              <span>{t.cta}</span>
            </button>
          </div>

          {/* Right Column: Authentic Modern Telegram Dark Client */}
          <div
            className="selloi-tg-window"
            data-node-id="182:380"
            onMouseEnter={() => {
              isHoveredRef.current = true;
            }}
            onMouseLeave={() => {
              isHoveredRef.current = false;
            }}
          >
            {/* Mobile Compact Chat/Channel Switcher */}
            <div className="selloi-tg-mobile-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activePane === "chat"}
                className={`selloi-tg-mobile-tab ${activePane === "chat" ? "active" : ""}`}
                onClick={() => setActivePane("chat")}
              >
                <TgBotIcon size={15} />
                <span>{tg.botTitle}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePane === "channel"}
                className={`selloi-tg-mobile-tab ${activePane === "channel" ? "active" : ""}`}
                onClick={() => setActivePane("channel")}
              >
                <TgMegaphoneIcon size={15} />
                <span>{tg.channelTitle} (100)</span>
              </button>
            </div>

            {/* Desktop Telegram Left Sidebar */}
            <aside className="selloi-tg-sidebar">
              <div className="selloi-tg-sidebar-top">
                <span className="selloi-tg-menu-btn" aria-hidden="true">
                  <TgMenuIcon size={17} />
                </span>
                <div className="selloi-tg-sidebar-search">
                  <TgSearchIcon size={14} />
                  <input
                    type="text"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder={tg.searchSidebarPlaceholder}
                    aria-label={tg.searchSidebarPlaceholder}
                  />
                </div>
              </div>

              <div className="selloi-tg-chat-list">
                {showBotRow && (
                  <button
                    type="button"
                    className={`selloi-tg-chat-item ${activePane === "chat" ? "active" : ""}`}
                    onClick={() => setActivePane("chat")}
                  >
                    <div className="selloi-tg-avatar selloi-tg-avatar-bot">
                      <TgPaperPlaneIcon size={19} />
                      <span className="selloi-tg-online-ring" />
                    </div>
                    <div className="selloi-tg-chat-meta">
                      <div className="selloi-tg-chat-row1">
                        <span className="selloi-tg-chat-name">
                          <span>{tg.botTitle}</span>
                          <TgVerifiedBadge size={13} />
                        </span>
                        <span className="selloi-tg-chat-time">14:04</span>
                      </div>
                      <div className="selloi-tg-chat-row2">
                        <span
                          className={`selloi-tg-chat-preview ${
                            botTypingNow ? "typing" : ""
                          }`}
                        >
                          {sidebarBotPreview}
                        </span>
                        {!interactiveMode && activePane !== "chat" && (
                          <span className="selloi-tg-unread">1</span>
                        )}
                      </div>
                    </div>
                  </button>
                )}

                {showChannelRow && (
                  <button
                    type="button"
                    className={`selloi-tg-chat-item ${activePane === "channel" ? "active" : ""}`}
                    onClick={() => setActivePane("channel")}
                  >
                    <div className="selloi-tg-avatar selloi-tg-avatar-channel">
                      <TgHardwareIcon category="pc" size={20} />
                    </div>
                    <div className="selloi-tg-chat-meta">
                      <div className="selloi-tg-chat-row1">
                        <span className="selloi-tg-chat-name">
                          <TgMegaphoneIcon size={13} />
                          <span>{tg.channelTitle}</span>
                          <TgVerifiedBadge size={13} />
                        </span>
                        <span className="selloi-tg-chat-time">13:58</span>
                      </div>
                      <div className="selloi-tg-chat-row2">
                        <span className="selloi-tg-chat-preview">
                          {tg.channelSidebarPreview}
                        </span>
                        <span className="selloi-tg-unread count">100</span>
                      </div>
                    </div>
                  </button>
                )}

                {sq && !showBotRow && !showChannelRow && (
                  <button
                    type="button"
                    className="selloi-tg-chat-item active"
                    onClick={() => {
                      setChannelCategory("all");
                      setChannelQuery(sidebarSearch);
                      setActivePane("channel");
                    }}
                  >
                    <div className="selloi-tg-avatar selloi-tg-avatar-channel">
                      <TgSearchIcon size={16} />
                    </div>
                    <div className="selloi-tg-chat-meta">
                      <div className="selloi-tg-chat-row1">
                        <span className="selloi-tg-chat-name">{tg.channelHandle}</span>
                      </div>
                      <div className="selloi-tg-chat-row2">
                        <span className="selloi-tg-chat-preview typing">
                          “{sidebarSearch}” →
                        </span>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              <div className="selloi-tg-sidebar-footer">
                <TgBotIcon size={15} />
                <span>{tg.sidebarHint}</span>
              </div>
            </aside>

            {/* Main Active Telegram View */}
            <div className="selloi-tg-main selloi-tg-wallpaper">
              {activePane === "chat" ? (
                <>
                  {/* Telegram Chat Top Bar */}
                  <div className="selloi-tg-header">
                    <div className="selloi-tg-header-info">
                      <div className="selloi-tg-avatar selloi-tg-avatar-bot small">
                        <TgPaperPlaneIcon size={16} />
                      </div>
                      <div>
                        <div className="selloi-tg-header-title">
                          <span>{tg.botTitle}</span>
                          <TgVerifiedBadge size={14} />
                        </div>
                        <div
                          className={`selloi-tg-header-status ${
                            botTypingNow ? "typing" : ""
                          }`}
                        >
                          {headerStatusText}
                        </div>
                      </div>
                    </div>

                    <div className="selloi-tg-header-actions">
                      <button
                        type="button"
                        className="selloi-tg-switch-pill"
                        onClick={() => setActivePane("channel")}
                      >
                        {tg.switchToChannelBtn}
                      </button>
                      <button
                        type="button"
                        className="selloi-demo-restart-btn"
                        onClick={handleRestart}
                        title="Reset"
                        aria-label="Restart simulation"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Telegram Pinned Bar */}
                  <button
                    type="button"
                    className="selloi-tg-pinned"
                    onClick={() => setActivePane("channel")}
                  >
                    <span className="selloi-tg-pinned-bar" />
                    <TgPinIcon size={13} />
                    <span className="selloi-tg-pinned-text">{tg.pinnedText}</span>
                  </button>

                  {/* Telegram Messages Stream */}
                  <div className="selloi-tg-messages" ref={messagesContainerRef}>
                    <div className="selloi-tg-date-pill">
                      <span>{tg.todayLabel}</span>
                    </div>

                    {/* Automated Demo Flow */}
                    {step >= 1 && (
                      <div className="selloi-tg-bubble-wrap out selloi-demo-msg-enter" data-node-id="182:383">
                        <div className="selloi-tg-bubble out">
                          <div className="selloi-tg-quote">
                            <span className="selloi-tg-quote-author">
                              {tg.quoteChannelLabel} • {HERO_LAPTOP.code}
                            </span>
                            <span className="selloi-tg-quote-text">
                              {HERO_LAPTOP.name}
                            </span>
                          </div>
                          <p className="selloi-tg-bubble-text" data-node-id="182:384">
                            {t.step1UserText}
                          </p>
                          <span className="selloi-tg-msg-meta">
                            <span>14:01</span>
                            <TgDoubleCheckIcon size={14} />
                          </span>
                        </div>
                      </div>
                    )}

                    {!interactiveMode && step === 2 && (
                      <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                        <div className="selloi-tg-typing-bubble">
                          <span className="selloi-tg-typing-dot" />
                          <span className="selloi-tg-typing-dot" />
                          <span className="selloi-tg-typing-dot" />
                        </div>
                      </div>
                    )}

                    {step >= 3 && (
                      <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter" data-node-id="182:385">
                        <div className="selloi-tg-bubble in">
                          <p className="selloi-tg-bubble-text" data-node-id="182:386">
                            {t.step2BotText}
                          </p>
                          <span className="selloi-tg-msg-meta">
                            <span>14:01</span>
                          </span>
                        </div>
                        <div className="selloi-tg-inline-kbd">
                          <button
                            type="button"
                            className="selloi-tg-inline-btn"
                            onClick={() => handleProductOrder(HERO_LAPTOP)}
                          >
                            {tg.orderButton} ({HERO_LAPTOP.code})
                          </button>
                          <button
                            type="button"
                            className="selloi-tg-inline-btn"
                            onClick={() => setActivePane("channel")}
                          >
                            {tg.otherOptionsButton}
                          </button>
                        </div>
                      </div>
                    )}

                    {step >= 5 && (
                      <div className="selloi-tg-bubble-wrap out selloi-demo-msg-enter">
                        <div className="selloi-tg-bubble out photo">
                          <TgPhotoAttachment
                            product={HERO_LAPTOP}
                            language={language}
                            photoLabel={t.photoLabel}
                            caption={t.step3UserCaption}
                          />
                          <span className="selloi-tg-msg-meta">
                            <span>14:02</span>
                            <TgDoubleCheckIcon size={14} />
                          </span>
                        </div>
                      </div>
                    )}

                    {!interactiveMode && step === 6 && (
                      <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                        <div className="selloi-tg-analyzing">
                          <span className="selloi-tg-spinner" />
                          <span>{t.analyzingIndicator}</span>
                        </div>
                      </div>
                    )}

                    {step >= 7 && (
                      <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                        <div className="selloi-tg-bubble in">
                          <p className="selloi-tg-bubble-text">{t.step4BotRecognition}</p>
                          <span className="selloi-tg-msg-meta">
                            <span>14:02</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {step >= 8 && (
                      <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                        <div className="selloi-tg-bubble in receipt">
                          <TgOrderCard
                            product={HERO_LAPTOP}
                            orderCode="TZ-4821"
                            language={language}
                            t={t}
                          />
                          <span className="selloi-tg-msg-meta">
                            <span>14:03</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {interactiveMode && step < 1 && customMessages.length === 0 && !isBotTyping && (
                      <>
                        <div className="selloi-tg-bubble-wrap out selloi-demo-msg-enter">
                          <div className="selloi-tg-bubble out">
                            <p className="selloi-tg-bubble-text">{t.userMsg}</p>
                            <span className="selloi-tg-msg-meta">
                              <span>14:00</span>
                              <TgDoubleCheckIcon size={14} />
                            </span>
                          </div>
                        </div>
                        <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                          <div className="selloi-tg-bubble in">
                            <p className="selloi-tg-bubble-text">
                              {t.botMsgLine1} {t.botMsgLine2}
                            </p>
                            <span className="selloi-tg-msg-meta">
                              <span>14:00</span>
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Custom Interactive Messages */}
                    {customMessages.map((msg) =>
                      msg.role === "user" ? (
                        <div key={msg.id} className="selloi-tg-bubble-wrap out selloi-demo-msg-enter">
                          <div className={`selloi-tg-bubble out ${msg.photoProduct ? "photo" : ""}`}>
                            {msg.quote && (
                              <div className="selloi-tg-quote">
                                <span className="selloi-tg-quote-author">{msg.quote.author}</span>
                                <span className="selloi-tg-quote-text">{msg.quote.text}</span>
                              </div>
                            )}
                            {msg.photoProduct ? (
                              <TgPhotoAttachment
                                product={msg.photoProduct}
                                language={language}
                                photoLabel={t.photoLabel}
                                caption={msg.text}
                              />
                            ) : (
                              <p className="selloi-tg-bubble-text">{msg.text}</p>
                            )}
                            <span className="selloi-tg-msg-meta">
                              <span>{msg.time}</span>
                              <TgDoubleCheckIcon size={14} />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div key={msg.id} className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                          <div className={`selloi-tg-bubble in ${msg.orderProduct ? "receipt" : ""}`}>
                            <p className="selloi-tg-bubble-text">{msg.text}</p>

                            {msg.matchedProducts && msg.matchedProducts.length > 0 && (
                              <div className="selloi-tg-matched-list">
                                {msg.matchedProducts.map((item) => (
                                  <div key={item.code} className="selloi-tg-matched-item">
                                    <div className="selloi-tg-matched-head">
                                      <strong>{item.name}</strong>
                                      <span className="selloi-tg-matched-price">
                                        {formatUzs(item.priceUzs, language)}
                                      </span>
                                    </div>
                                    <div className="selloi-tg-matched-specs">{item.specs}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {msg.orderProduct && (
                              <TgOrderCard
                                product={msg.orderProduct}
                                orderCode={msg.orderCode || "TZ-4890"}
                                language={language}
                                t={t}
                              />
                            )}

                            <span className="selloi-tg-msg-meta">
                              <span>{msg.time}</span>
                            </span>
                          </div>

                          {(msg.matchedProducts?.length || msg.showUtilityButtons) && (
                            <div className="selloi-tg-inline-kbd">
                              {msg.matchedProducts?.map((prod) => (
                                <button
                                  key={prod.code}
                                  type="button"
                                  className="selloi-tg-inline-btn"
                                  disabled={isBotTyping}
                                  onClick={() => handleProductOrder(prod)}
                                >
                                  {tg.orderButton} • {prod.code}
                                </button>
                              ))}
                              {msg.showUtilityButtons && (
                                <>
                                  <button
                                    type="button"
                                    className="selloi-tg-inline-btn"
                                    disabled={isBotTyping}
                                    onClick={handleAskDelivery}
                                  >
                                    {tg.deliveryInfoButton}
                                  </button>
                                  <button
                                    type="button"
                                    className="selloi-tg-inline-btn"
                                    onClick={() => setActivePane("channel")}
                                  >
                                    {tg.otherOptionsButton}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {isBotTyping &&
                      (isAnalyzingPhoto ? (
                        <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                          <div className="selloi-tg-analyzing">
                            <span className="selloi-tg-spinner" />
                            <span>{t.analyzingIndicator}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="selloi-tg-bubble-wrap in selloi-demo-msg-enter">
                          <div className="selloi-tg-typing-bubble">
                            <span className="selloi-tg-typing-dot" />
                            <span className="selloi-tg-typing-dot" />
                            <span className="selloi-tg-typing-dot" />
                          </div>
                        </div>
                      ))}

                    <div style={{ height: "4px" }} />
                  </div>

                  {/* Telegram Quick Prompts + Compose Input Bar */}
                  <div className="selloi-tg-composer-wrap">
                    <div className="selloi-tg-quick-row">
                      {t.quickPrompts.map((prompt) => (
                        <button
                          key={prompt.id}
                          type="button"
                          className="selloi-tg-quick-chip"
                          disabled={isBotTyping}
                          onClick={() => handleQuickPrompt(prompt)}
                        >
                          {prompt.label}
                        </button>
                      ))}
                    </div>

                    <form className="selloi-tg-composer" data-node-id="182:388" onSubmit={handleFormSubmit}>
                      <button
                        type="button"
                        className={`selloi-tg-compose-icon ${
                          step === 4 || isAnalyzingPhoto ? "active" : ""
                        }`}
                        onClick={handlePhotoAttachClick}
                        title={t.photoLabel}
                        aria-label={t.photoLabel}
                        disabled={isBotTyping}
                      >
                        <TgAttachIcon size={18} />
                      </button>

                      <input
                        ref={inputRef}
                        type="text"
                        className="selloi-tg-compose-input"
                        data-node-id="182:389"
                        value={activeInputValue}
                        placeholder={t.placeholder}
                        aria-label={t.placeholder}
                        onFocus={enterInteractiveMode}
                        onChange={(e) => {
                          if (!interactiveMode) enterInteractiveMode();
                          setUserInput(e.target.value);
                        }}
                      />

                      <button
                        type="button"
                        className="selloi-tg-compose-icon"
                        onClick={() => {
                          enterInteractiveMode();
                          setUserInput((prev) => `${prev}${prev ? " " : ""}🔥`);
                          inputRef.current?.focus();
                        }}
                        aria-label="Emoji"
                      >
                        <TgSmileIcon size={18} />
                      </button>

                      <button
                        type="submit"
                        className={`selloi-tg-send-btn ${
                          canSubmit || (step === 0 && typedInput.length > 4) ? "ready" : ""
                        }`}
                        data-node-id="182:390"
                        aria-label={t.sendAriaLabel}
                        disabled={interactiveMode && !canSubmit}
                      >
                        <TgPaperPlaneIcon size={17} />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                /* Telegram Channel Feed: TechZone UZ (@techzone_uz) — 100 Computer Store Products */
                <>
                  <div className="selloi-tg-header">
                    <div className="selloi-tg-header-info">
                      <div className="selloi-tg-avatar selloi-tg-avatar-channel small">
                        <TgHardwareIcon category="pc" size={16} />
                      </div>
                      <div>
                        <div className="selloi-tg-header-title">
                          <span>{tg.channelTitle}</span>
                          <TgVerifiedBadge size={14} />
                        </div>
                        <div className="selloi-tg-header-status">{tg.channelSubs}</div>
                      </div>
                    </div>

                    <div className="selloi-tg-header-actions">
                      <button
                        type="button"
                        className="selloi-tg-switch-pill chat"
                        onClick={() => setActivePane("chat")}
                      >
                        {tg.switchToChatBtn}
                      </button>
                    </div>
                  </div>

                  {/* Sticky Search + Category Filter Toolbar inside Channel */}
                  <div className="selloi-tg-channel-toolbar">
                    <div className="selloi-tg-channel-search-row">
                      <div className="selloi-tg-channel-search">
                        <TgSearchIcon size={14} />
                        <input
                          type="text"
                          value={channelQuery}
                          onChange={(e) => setChannelQuery(e.target.value)}
                          placeholder={tg.channelSearchPlaceholder}
                          aria-label={tg.channelSearchPlaceholder}
                        />
                        {channelQuery && (
                          <button
                            type="button"
                            className="selloi-tg-clear-btn"
                            onClick={() => setChannelQuery("")}
                            aria-label="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <span className="selloi-tg-count-pill">
                        {filteredCatalog.length} / {TELEGRAM_COMPUTER_CATALOG.length}
                      </span>
                    </div>

                    <div className="selloi-tg-cat-pills" role="tablist">
                      {(
                        [
                          { id: "all", label: tg.catAll },
                          { id: "laptop", label: tg.catLaptop },
                          { id: "pc", label: tg.catPc },
                          { id: "monitor", label: tg.catMonitor },
                          { id: "accessory", label: tg.catAccessory },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          role="tab"
                          aria-selected={channelCategory === cat.id}
                          className={`selloi-tg-cat-pill ${
                            channelCategory === cat.id ? "active" : ""
                          }`}
                          onClick={() => setChannelCategory(cat.id)}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 100-Product Telegram Channel Posts Feed */}
                  <div className="selloi-tg-channel-feed">
                    {filteredCatalog.length === 0 ? (
                      <div className="selloi-tg-empty-state">
                        <TgSearchIcon size={24} />
                        <p>{tg.emptySearchText}</p>
                      </div>
                    ) : (
                      filteredCatalog.map((product) => {
                        const isLiked = Boolean(likedPosts[product.id]);
                        const fireCount = product.reactions.fire + (isLiked ? 1 : 0);
                        const monthly = Math.round((product.priceUzs * 1.16) / 12);

                        return (
                          <article key={product.code} className="selloi-tg-post-wrap">
                            <div className="selloi-tg-post-bubble">
                              <div className="selloi-tg-post-head">
                                <span className="selloi-tg-post-author">
                                  {tg.channelTitle}
                                  <span className="selloi-tg-post-sku">{product.code}</span>
                                </span>
                                {product.tag && (
                                  <span className="selloi-tg-post-badge">{product.tag}</span>
                                )}
                              </div>

                              <div className="selloi-tg-post-card-row">
                                <div
                                  className={`selloi-tg-post-thumb cat-${product.category}`}
                                >
                                  <TgHardwareIcon category={product.category} size={24} />
                                </div>
                                <div className="selloi-tg-post-info">
                                  <h4 className="selloi-tg-post-title">{product.name}</h4>
                                  <p className="selloi-tg-post-specs">{product.specs}</p>
                                  <div className="selloi-tg-post-pricing">
                                    <span className="selloi-tg-post-price">
                                      {formatUzs(product.priceUzs, language)}
                                    </span>
                                    <span className="selloi-tg-post-installment">
                                      ~{formatUzs(monthly, language).replace(/ (so‘m|сум|UZS)$/i, "")}{" "}
                                      {tg.installmentSuffix}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="selloi-tg-post-footer">
                                <div className="selloi-tg-post-reactions">
                                  <button
                                    type="button"
                                    className={`selloi-tg-react-pill ${isLiked ? "liked" : ""}`}
                                    onClick={() => handleToggleLike(product.id)}
                                  >
                                    🔥 {fireCount}
                                  </button>
                                  <span className="selloi-tg-stock-tag">
                                    ✓ {tg.inStockLabel}: {product.stock}
                                  </span>
                                </div>
                                <div className="selloi-tg-post-views">
                                  <TgEyeIcon size={13} />
                                  <span>{product.views}</span>
                                  <span>14:{String(product.id % 60).padStart(2, "0")}</span>
                                </div>
                              </div>
                            </div>

                            {/* Authentic Telegram Channel Post Inline Bot Buttons */}
                            <div className="selloi-tg-inline-kbd dual">
                              <button
                                type="button"
                                className="selloi-tg-inline-btn"
                                onClick={() => handleProductConsult(product)}
                              >
                                {tg.askAiButton}
                              </button>
                              <button
                                type="button"
                                className="selloi-tg-inline-btn primary"
                                onClick={() => handleProductOrder(product)}
                              >
                                {tg.orderButton}
                              </button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="selloi-tg-disclaimer" data-node-id="182:387">
          {t.disclaimer}
        </p>
      </div>
    </section>
  );
}
