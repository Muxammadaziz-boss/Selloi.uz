"use client";

import React, { useState, useEffect, useRef } from "react";
import { SelloiTranslations } from "./selloiI18n";

interface ConversationDemoSectionProps {
  onOpenOnboarding: () => void;
  isAuthenticated?: boolean;
  t: SelloiTranslations["suhbatNamunasi"];
}

interface CustomDemoMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  hasPhoto?: boolean;
  hasOrder?: boolean;
}

function DemoOrderCard({ t }: { t: SelloiTranslations["suhbatNamunasi"] }) {
  return (
    <div className="selloi-demo-order-card selloi-demo-msg-enter">
      <div className="selloi-demo-order-header">
        <div className="selloi-demo-order-badge">
          <span className="selloi-demo-order-check">✓</span>
          <span>{t.orderBadge}</span>
        </div>
        <span className="selloi-demo-order-chip">{t.orderChipLabel}</span>
      </div>
      <div className="selloi-demo-order-body">
        <div className="selloi-demo-order-row">
          <span className="selloi-demo-order-label">{t.orderProductLabel}</span>
          <span className="selloi-demo-order-val">{t.orderProduct}</span>
        </div>
        <div className="selloi-demo-order-row">
          <span className="selloi-demo-order-label">{t.orderPriceLabel}</span>
          <span className="selloi-demo-order-val selloi-demo-order-price">
            {t.orderPrice}
          </span>
        </div>
        <div className="selloi-demo-order-status-row">
          <span className="selloi-demo-order-status-dot" />
          <span>{t.orderStatus}</span>
        </div>
      </div>
    </div>
  );
}

export default function ConversationDemoSection({
  onOpenOnboarding,
  isAuthenticated = false,
  t,
}: ConversationDemoSectionProps) {
  // Step sequence (auto showcase until user interacts):
  // 0: Typing initial question in input box
  // 1: User message 1 sent
  // 2: Bot typing indicator
  // 3: Bot message 1 delivered
  // 4: Simulated input uploading photo
  // 5: User photo message sent
  // 6: Bot AI vision analyzing photo
  // 7: Bot recognition message delivered
  // 8: Order confirmation card delivered
  const [step, setStep] = useState<number>(0);
  const [typedInput, setTypedInput] = useState<string>("");
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // Interactive Live Demo state
  const [interactiveMode, setInteractiveMode] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>("");
  const [customMessages, setCustomMessages] = useState<CustomDemoMessage[]>([]);
  const [isBotResponding, setIsBotResponding] = useState<boolean>(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isHoveredRef = useRef<boolean>(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start automated live demo only once section enters viewport
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
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted]);

  // Smoothly auto-scroll chat container when automated steps or custom replies update
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [step, customMessages.length, isBotResponding]);

  // Cleanup pending interactive reply timer on unmount
  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, []);

  // Main automated simulation loop (paused cleanly when user enters interactive mode)
  useEffect(() => {
    if (!hasStarted || interactiveMode) return;
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
          }, 350);
        }
      }, 22);

      return () => {
        clearInterval(typeInterval);
        clearTimeout(timer);
      };
    }

    if (step === 1) {
      timer = setTimeout(() => setStep(2), 850);
    } else if (step === 2) {
      timer = setTimeout(() => setStep(3), 1600);
    } else if (step === 3) {
      timer = setTimeout(() => {
        setTypedInput(t.uploadingPhotoText);
        setStep(4);
      }, 1500);
    } else if (step === 4) {
      timer = setTimeout(() => {
        setTypedInput("");
        setStep(5);
      }, 1000);
    } else if (step === 5) {
      timer = setTimeout(() => setStep(6), 800);
    } else if (step === 6) {
      timer = setTimeout(() => setStep(7), 1600);
    } else if (step === 7) {
      timer = setTimeout(() => setStep(8), 1200);
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
      }, 10000);
    }

    return () => {
      clearTimeout(timer);
      if (checkHover) clearInterval(checkHover);
    };
  }, [hasStarted, interactiveMode, step, t]);

  const enterInteractiveMode = () => {
    if (!interactiveMode) {
      setHasStarted(true);
      setInteractiveMode(true);
      setTypedInput("");
    }
  };

  const resolveBotReply = (
    messageText: string,
    explicitPrompt?: SelloiTranslations["suhbatNamunasi"]["quickPrompts"][number]
  ): { text: string; hasOrder?: boolean } => {
    if (explicitPrompt) {
      return {
        text: explicitPrompt.botReply,
        hasOrder: explicitPrompt.id === "order",
      };
    }

    const q = messageText.toLowerCase();
    const byId = (id: SelloiTranslations["suhbatNamunasi"]["quickPrompts"][number]["id"]) =>
      t.quickPrompts.find((p) => p.id === id);

    if (/(yetkaz|dostav|достав|manzil|adres|deliver|shipping)/i.test(q)) {
      return { text: byId("delivery")?.botReply || t.botMsgLine1 + " " + t.botMsgLine2 };
    }
    if (/(buyurtma|zakaz|заказ|olaman|rasmiy|order|checkout|buy)/i.test(q)) {
      return { text: byId("order")?.botReply || t.orderBadge, hasOrder: true };
    }
    if (/(rasm|foto|фото|photo|image|ko'rsat|покаж)/i.test(q)) {
      return { text: t.step4BotRecognition };
    }
    if (/(razmer|o'lcham|narx|qancha|necha|bormi|rang|размер|цена|цвет|сколько|наличи|size|price|color|stock)/i.test(q)) {
      return { text: byId("stock")?.botReply || t.step2BotText };
    }
    return { text: t.fallbackReply };
  };

  const sendMessage = (
    rawText: string,
    options?: {
      hasPhoto?: boolean;
      prompt?: SelloiTranslations["suhbatNamunasi"]["quickPrompts"][number];
    }
  ) => {
    const clean = rawText.trim();
    if (!clean || isBotResponding) return;

    enterInteractiveMode();
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

    const userMsgId = `u-${Date.now()}`;
    setCustomMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        text: clean,
        hasPhoto: options?.hasPhoto,
      },
    ]);
    setUserInput("");

    const isPhoto = Boolean(options?.hasPhoto);
    setIsBotResponding(true);
    setIsAnalyzingPhoto(isPhoto);

    replyTimerRef.current = setTimeout(() => {
      const reply = resolveBotReply(clean, options?.prompt);
      setIsBotResponding(false);
      setIsAnalyzingPhoto(false);
      setCustomMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: reply.text,
          hasOrder: reply.hasOrder,
        },
      ]);
    }, isPhoto ? 1250 : 850);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(userInput);
  };

  const handleQuickPrompt = (
    prompt: SelloiTranslations["suhbatNamunasi"]["quickPrompts"][number]
  ) => {
    sendMessage(prompt.userText, {
      hasPhoto: prompt.id === "photo",
      prompt,
    });
  };

  const handlePhotoAttachClick = () => {
    const photoPrompt = t.quickPrompts.find((p) => p.id === "photo");
    if (photoPrompt) {
      handleQuickPrompt(photoPrompt);
    } else {
      sendMessage(t.step3UserCaption, { hasPhoto: true });
    }
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    setInteractiveMode(false);
    setUserInput("");
    setCustomMessages([]);
    setIsBotResponding(false);
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

  const activeInputValue = interactiveMode ? userInput : typedInput;
  const canSubmit = interactiveMode && userInput.trim().length > 0 && !isBotResponding;

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

          {/* Right Column Demo Card — Suhbatdan namuna (Jonli Demo) */}
          <div
            className="selloi-demo-card"
            data-node-id="182:380"
            onMouseEnter={() => {
              isHoveredRef.current = true;
            }}
            onMouseLeave={() => {
              isHoveredRef.current = false;
            }}
          >
            {/* Header with Title and Live Indicator */}
            <div className="selloi-demo-header">
              <div>
                <h3 className="selloi-demo-card-title" data-node-id="182:381">
                  {t.cardTitle}
                </h3>
                <p className="selloi-demo-card-sub" data-node-id="182:382">
                  {t.cardSub}
                </p>
              </div>

              <div className="selloi-demo-header-actions">
                <div className="selloi-demo-live-badge" title={t.liveBadge}>
                  <span className="selloi-demo-live-dot" />
                  <span>{t.liveBadge}</span>
                </div>
                <button
                  type="button"
                  className="selloi-demo-restart-btn"
                  onClick={handleRestart}
                  title="Qaytadan boshlash"
                  aria-label="Restart simulation"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Live Animated + Interactive Messages Container */}
            <div className="selloi-demo-messages" ref={messagesContainerRef}>
              {/* Automated Steps */}
              {step >= 1 && (
                <div className="selloi-demo-user-msg selloi-demo-msg-enter" data-node-id="182:383">
                  <span data-node-id="182:384">{t.step1UserText}</span>
                </div>
              )}

              {!interactiveMode && step === 2 && (
                <div className="selloi-demo-typing-bubble selloi-demo-msg-enter">
                  <span className="selloi-demo-typing-dot" />
                  <span className="selloi-demo-typing-dot" />
                  <span className="selloi-demo-typing-dot" />
                  <span className="selloi-demo-typing-label">{t.typingIndicator}</span>
                </div>
              )}

              {step >= 3 && (
                <div className="selloi-demo-bot-msg selloi-demo-msg-enter" data-node-id="182:385">
                  <span data-node-id="182:386">{t.step2BotText}</span>
                </div>
              )}

              {step >= 5 && (
                <div className="selloi-demo-user-photo-card selloi-demo-msg-enter">
                  <div className="selloi-demo-user-photo-wrapper">
                    <img
                      src="/figma/sample-sneaker.jpg"
                      alt="Nike Air Force (tovar rasmini AI orqali tanish namunasi)"
                      width={600}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="selloi-demo-user-photo-img"
                    />
                    <div className="selloi-demo-user-photo-pill">
                      <span>{t.photoLabel}</span>
                    </div>
                  </div>
                  <p className="selloi-demo-user-photo-caption">{t.step3UserCaption}</p>
                </div>
              )}

              {!interactiveMode && step === 6 && (
                <div className="selloi-demo-analyzing selloi-demo-msg-enter">
                  <span className="selloi-demo-analyzing-spinner" />
                  <span>{t.analyzingIndicator}</span>
                </div>
              )}

              {step >= 7 && (
                <div className="selloi-demo-bot-msg selloi-demo-msg-enter">
                  <span>{t.step4BotRecognition}</span>
                </div>
              )}

              {step >= 8 && <DemoOrderCard t={t} />}

              {/* Initial friendly seed prompt when user focuses before step 1 fires */}
              {interactiveMode && step < 1 && customMessages.length === 0 && !isBotResponding && (
                <>
                  <div className="selloi-demo-user-msg selloi-demo-msg-enter">
                    <span>{t.userMsg}</span>
                  </div>
                  <div className="selloi-demo-bot-msg selloi-demo-msg-enter">
                    <span>
                      {t.botMsgLine1} {t.botMsgLine2}
                    </span>
                  </div>
                </>
              )}

              {/* User-submitted Interactive Live Demo Messages */}
              {customMessages.map((msg) =>
                msg.role === "user" ? (
                  msg.hasPhoto ? (
                    <div
                      key={msg.id}
                      className="selloi-demo-user-photo-card selloi-demo-msg-enter"
                    >
                      <div className="selloi-demo-user-photo-wrapper">
                        <img
                          src="/figma/sample-sneaker.jpg"
                          alt="Nike Air Force"
                          width={600}
                          height={400}
                          loading="lazy"
                          decoding="async"
                          className="selloi-demo-user-photo-img"
                        />
                        <div className="selloi-demo-user-photo-pill">
                          <span>{t.photoLabel}</span>
                        </div>
                      </div>
                      <p className="selloi-demo-user-photo-caption">{msg.text}</p>
                    </div>
                  ) : (
                    <div key={msg.id} className="selloi-demo-user-msg selloi-demo-msg-enter">
                      <span>{msg.text}</span>
                    </div>
                  )
                ) : (
                  <React.Fragment key={msg.id}>
                    <div className="selloi-demo-bot-msg selloi-demo-msg-enter">
                      <span>{msg.text}</span>
                    </div>
                    {msg.hasOrder && <DemoOrderCard t={t} />}
                  </React.Fragment>
                )
              )}

              {/* Live Typing / Photo Vision Indicator for interactive replies */}
              {isBotResponding &&
                (isAnalyzingPhoto ? (
                  <div className="selloi-demo-analyzing selloi-demo-msg-enter">
                    <span className="selloi-demo-analyzing-spinner" />
                    <span>{t.analyzingIndicator}</span>
                  </div>
                ) : (
                  <div className="selloi-demo-typing-bubble selloi-demo-msg-enter">
                    <span className="selloi-demo-typing-dot" />
                    <span className="selloi-demo-typing-dot" />
                    <span className="selloi-demo-typing-dot" />
                    <span className="selloi-demo-typing-label">{t.typingIndicator}</span>
                  </div>
                ))}

              <div style={{ height: "4px" }} />
            </div>

            {/* Quick Interactive Test Chips */}
            <div className="selloi-demo-chips" role="group" aria-label={t.cardSub}>
              {t.quickPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  className="selloi-demo-chip"
                  disabled={isBotResponding}
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            {/* Interactive Input Form */}
            <form className="selloi-demo-input" data-node-id="182:388" onSubmit={handleFormSubmit}>
              <input
                ref={inputRef}
                type="text"
                className={`selloi-demo-input-field ${activeInputValue ? "selloi-demo-input-typing" : ""}`}
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
              <div className="selloi-demo-input-actions">
                <button
                  type="button"
                  className={`selloi-demo-input-icon-btn ${
                    step === 4 || isAnalyzingPhoto ? "selloi-demo-input-icon-active" : ""
                  }`}
                  onClick={handlePhotoAttachClick}
                  title={t.photoLabel}
                  aria-label={t.photoLabel}
                  disabled={isBotResponding}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                <button
                  type="submit"
                  className={`selloi-demo-input-send-btn ${
                    canSubmit || (step === 0 && typedInput.length > 5)
                      ? "selloi-demo-input-arrow-active"
                      : ""
                  }`}
                  data-node-id="182:390"
                  aria-label={t.sendAriaLabel}
                  disabled={interactiveMode && !canSubmit}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </form>
            <p className="selloi-demo-disclaimer" data-node-id="182:387">
              {t.disclaimer}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
