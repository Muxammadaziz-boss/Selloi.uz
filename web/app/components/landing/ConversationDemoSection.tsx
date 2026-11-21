"use client";

import React, { useState, useEffect, useRef } from "react";
import { SelloiTranslations } from "./selloiI18n";

interface ConversationDemoSectionProps {
  onOpenOnboarding: () => void;
  isAuthenticated?: boolean;
  t: SelloiTranslations["suhbatNamunasi"];
}

export default function ConversationDemoSection({
  onOpenOnboarding,
  isAuthenticated = false,
  t,
}: ConversationDemoSectionProps) {
  // Step sequence:
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
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isHoveredRef = useRef<boolean>(false);

  // Auto-scroll ONLY the chat messages container smoothly whenever step advances
  // (Never scroll window/viewport, preventing page jumping bugs)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [step]);

  // Main automated simulation sequence
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (step === 0) {
      // Simulate user typing question in input box
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
            setStep(1); // User message sent!
          }, 450);
        }
      }, 35);

      return () => {
        clearInterval(typeInterval);
        clearTimeout(timer);
      };
    }

    if (step === 1) {
      // User message is shown. Selloi starts typing after 850ms
      timer = setTimeout(() => setStep(2), 850);
    } else if (step === 2) {
      // Selloi typing indicator active for 1.6s
      timer = setTimeout(() => setStep(3), 1600);
    } else if (step === 3) {
      // Selloi response 1 delivered. User prepares to send photo after 1.5s
      timer = setTimeout(() => {
        setTypedInput("📷 Rasm yuklanmoqda...");
        setStep(4);
      }, 1500);
    } else if (step === 4) {
      // Preparing photo message in input for 1s
      timer = setTimeout(() => {
        setTypedInput("");
        setStep(5); // Photo message sent!
      }, 1000);
    } else if (step === 5) {
      // Photo is shown. Selloi starts analyzing image after 800ms
      timer = setTimeout(() => setStep(6), 800);
    } else if (step === 6) {
      // AI Vision analyzing for 1.6s
      timer = setTimeout(() => setStep(7), 1600);
    } else if (step === 7) {
      // Recognition message delivered. Final order card generated after 1.2s
      timer = setTimeout(() => setStep(8), 1200);
    } else if (step === 8) {
      // Order confirmed! Hold for 10s to let visitor comfortably read everything, then loop
      timer = setTimeout(() => {
        if (!isHoveredRef.current) {
          setStep(0);
        } else {
          const checkHover = setInterval(() => {
            if (!isHoveredRef.current) {
              clearInterval(checkHover);
              setStep(0);
            }
          }, 1000);
        }
      }, 10000);
    }

    return () => clearTimeout(timer);
  }, [step, t]);

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <section className="selloi-demo-section selloi-reveal-item" id="suhbat-namunasi" data-node-id="182:375">
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

          {/* Right Column Demo Card */}
          <div
            className="selloi-demo-card"
            data-node-id="182:380"
            onMouseEnter={() => { isHoveredRef.current = true; }}
            onMouseLeave={() => { isHoveredRef.current = false; }}
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
                <div className="selloi-demo-live-badge" title="Jonli simulyatsiya">
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Live Animated Messages Container */}
            <div className="selloi-demo-messages" ref={messagesContainerRef}>
              {/* Step 1: User Text Message */}
              {step >= 1 && (
                <div className="selloi-demo-user-msg selloi-demo-msg-enter" data-node-id="182:383">
                  <span data-node-id="182:384">{t.step1UserText}</span>
                </div>
              )}

              {/* Step 2: Selloi Typing Indicator */}
              {step === 2 && (
                <div className="selloi-demo-typing-bubble selloi-demo-msg-enter">
                  <span className="selloi-demo-typing-dot" />
                  <span className="selloi-demo-typing-dot" />
                  <span className="selloi-demo-typing-dot" />
                  <span className="selloi-demo-typing-label">{t.typingIndicator}</span>
                </div>
              )}

              {/* Step 3: Selloi Text Response 1 */}
              {step >= 3 && (
                <div className="selloi-demo-bot-msg selloi-demo-msg-enter" data-node-id="182:385">
                  <span data-node-id="182:386">{t.step2BotText}</span>
                </div>
              )}

              {/* Step 5: User Photo Message */}
              {step >= 5 && (
                <div className="selloi-demo-user-photo-card selloi-demo-msg-enter">
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
                      <span>📷 Fotosurat</span>
                    </div>
                  </div>
                  <p className="selloi-demo-user-photo-caption">
                    {t.step3UserCaption}
                  </p>
                </div>
              )}

              {/* Step 6: Selloi Analyzing Vision Indicator */}
              {step === 6 && (
                <div className="selloi-demo-analyzing selloi-demo-msg-enter">
                  <span className="selloi-demo-analyzing-spinner" />
                  <span>{t.analyzingIndicator}</span>
                </div>
              )}

              {/* Step 7: Selloi Recognition Text */}
              {step >= 7 && (
                <div className="selloi-demo-bot-msg selloi-demo-msg-enter">
                  <span>{t.step4BotRecognition}</span>
                </div>
              )}

              {/* Step 8: Finalized Order Card */}
              {step >= 8 && (
                <div className="selloi-demo-order-card selloi-demo-msg-enter">
                  <div className="selloi-demo-order-header">
                    <div className="selloi-demo-order-badge">
                      <span className="selloi-demo-order-check">✓</span>
                      <span>{t.orderBadge}</span>
                    </div>
                    <span className="selloi-demo-order-chip">Avtomatik</span>
                  </div>
                  <div className="selloi-demo-order-body">
                    <div className="selloi-demo-order-row">
                      <span className="selloi-demo-order-label">Tovarlar:</span>
                      <span className="selloi-demo-order-val">{t.orderProduct}</span>
                    </div>
                    <div className="selloi-demo-order-row">
                      <span className="selloi-demo-order-label">Narxi:</span>
                      <span className="selloi-demo-order-val selloi-demo-order-price">{t.orderPrice}</span>
                    </div>
                    <div className="selloi-demo-order-status-row">
                      <span className="selloi-demo-order-status-dot" />
                      <span>{t.orderStatus}</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ height: "4px" }} />
            </div>

            {/* Disclaimer */}
            <p className="selloi-demo-disclaimer" data-node-id="182:387">
              {t.disclaimer}
            </p>

            {/* Input Field Mock with Live Typing Feedback */}
            <div className="selloi-demo-input" data-node-id="182:388">
              <span
                className={`selloi-demo-input-text ${typedInput ? "selloi-demo-input-typing" : ""}`}
                data-node-id="182:389"
              >
                {typedInput ? (
                  <>
                    {typedInput}
                    <span className="selloi-demo-cursor">|</span>
                  </>
                ) : (
                  t.placeholder
                )}
              </span>
              <div className="selloi-demo-input-actions">
                <span
                  className={`selloi-demo-input-icon ${step === 4 ? "selloi-demo-input-icon-active" : ""}`}
                  title="Fotosurat biriktirish"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </span>
                <span
                  className={`selloi-demo-input-arrow ${step === 0 && typedInput.length > 5 ? "selloi-demo-input-arrow-active" : ""}`}
                  data-node-id="182:390"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
