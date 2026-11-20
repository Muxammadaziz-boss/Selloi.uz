"use client";

import React, { useState, useEffect } from "react";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconBrandTelegram,
  IconBuildingSkyscraper,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconId,
  IconKey,
  IconLanguage,
  IconMessageDots,
  IconPackage,
  IconPhone,
  IconRefresh,
  IconRobot,
  IconShieldLock,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { getPublicPlans, PublicPlan } from "../../lib/api";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlanCode?: string;
  onComplete: (data: {
    name: string;
    slug: string;
    category: string;
    plan_code: string;
    telegram_bot_token?: string;
    telegram_channel?: string;
    channel?: string;
    telegram_api_id?: number;
    telegram_api_hash?: string;
    telegram_phone?: string;
    admin_chat_id?: string;
    ai_language?: string;
    ai_personality?: string;
  }) => Promise<void>;
}

export function OnboardingModal({ isOpen, onClose, onComplete, initialPlanCode }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [category, setCategory] = useState("Elektronika va Maishiy Texnika");
  const [botToken, setBotToken] = useState("");
  const [botVerification, setBotVerification] = useState<{
    checking: boolean;
    verified: boolean;
    error?: string;
    bot_name?: string;
    bot_username?: string;
  }>({ checking: false, verified: false });

  const [telegramChannel, setTelegramChannel] = useState("");
  const [channelVerification, setChannelVerification] = useState<{
    checking: boolean;
    verified: boolean;
    title?: string;
    username?: string;
    subscribers?: number;
    error?: string;
  }>({ checking: false, verified: false });

  // Telegram MTProto / API & Chat Configuration
  const [telegramApiId, setTelegramApiId] = useState("");
  const [telegramApiHash, setTelegramApiHash] = useState("");
  const [telegramPhone, setTelegramPhone] = useState("");
  const [adminChatId, setAdminChatId] = useState("");
  const [showApiHash, setShowApiHash] = useState(false);

  const [aiLanguage, setAiLanguage] = useState("uz");
  const [aiPersonality, setAiPersonality] = useState("Professional va do'stona sotuvchi assistent");
  const [planCode, setPlanCode] = useState(initialPlanCode || "start");
  const [currency, setCurrency] = useState<"USD" | "UZS">("USD");
  const [availablePlans, setAvailablePlans] = useState<PublicPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialPlanCode) {
      setPlanCode(initialPlanCode);
    }
  }, [isOpen, initialPlanCode]);

  useEffect(() => {
    if (isOpen) {
      setLoadingPlans(true);
      getPublicPlans(currency, "monthly")
        .then((res) => {
          if (res && res.plans) {
            const pub = res.plans.filter((p) => p.is_public !== false);
            setAvailablePlans(pub);
            if (pub.length > 0 && !pub.some((p) => p.code === planCode)) {
              setPlanCode(pub[0].code);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPlans(false));
    }
  }, [isOpen, currency]);

  if (!isOpen) return null;

  const totalSteps = 10;

  const handleVerifyBotToken = async () => {
    if (!botToken.trim()) return;
    setBotVerification({ checking: true, verified: false });
    try {
      const res = await fetch("/api/proxy?path=/api/organizations/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: botToken.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setBotVerification({
          checking: false,
          verified: true,
          bot_name: data.bot_name,
          bot_username: data.bot_username,
        });
      } else {
        setBotVerification({
          checking: false,
          verified: false,
          error: data.error || "Noto'g'ri Telegram bot token kiritildi",
        });
      }
    } catch (err: any) {
      setBotVerification({
        checking: false,
        verified: false,
        error: err.message || "Telegram API bilan bog'lanib bo'lmadi",
      });
    }
  };

  const handleVerifyChannel = async () => {
    if (!telegramChannel.trim()) return;
    setChannelVerification({ checking: true, verified: false });
    try {
      const res = await fetch("/api/proxy?path=/api/organizations/verify-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: telegramChannel.trim(),
          bot_token: botToken.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setChannelVerification({
          checking: false,
          verified: true,
          title: data.title,
          username: data.username,
          subscribers: data.subscribers,
        });
      } else {
        setChannelVerification({
          checking: false,
          verified: false,
          error: data.error || data.detail || "Kanal topilmadi yoki xatolik yuz berdi",
        });
      }
    } catch (err: any) {
      setChannelVerification({
        checking: false,
        verified: false,
        error: err.message || "Telegram API bilan bog'lanib bo'lmadi",
      });
    }
  };

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep((prev) => prev + 1);
      return;
    }

    // Complete onboarding on step 9
    setBusy(true);
    try {
      const defaultSlug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const finalSlug = (customSlug || defaultSlug || `store-${Date.now()}`).toLowerCase().trim();

      await onComplete({
        name: businessName || "Yangi Biznes",
        slug: finalSlug,
        category,
        plan_code: planCode,
        telegram_bot_token: botToken.trim() || undefined,
        telegram_channel: telegramChannel.trim() || undefined,
        channel: telegramChannel.trim() || undefined,
        telegram_api_id: telegramApiId.trim() ? parseInt(telegramApiId.trim(), 10) : undefined,
        telegram_api_hash: telegramApiHash.trim() || undefined,
        telegram_phone: telegramPhone.trim() || undefined,
        admin_chat_id: adminChatId.trim() || undefined,
        ai_language: aiLanguage,
        ai_personality: aiPersonality,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => prev - 1);
  };

  return (
    <div
      className="modal modal-blur fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0,0,0,0.8)", zIndex: 1060, backdropFilter: "blur(4px)" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div
          className="modal-content shadow-lg border"
          style={{
            backgroundColor: "var(--bg-surface, #0f141c)",
            borderColor: "var(--border-default, rgba(255, 255, 255, 0.12))",
            borderRadius: "16px",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.75)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            className="modal-header py-3 px-4 d-flex align-items-center justify-content-between border-bottom"
            style={{
              borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))",
              backgroundColor: "var(--bg-surface-elevated, #161b22)",
            }}
          >
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-2 d-flex align-items-center justify-content-center"
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: "var(--accent-subtle, rgba(99, 102, 241, 0.15))",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                }}
              >
                <IconSparkles size={18} style={{ color: "var(--accent, #6366f1)" }} />
              </div>
              <div>
                <h4 className="modal-title fw-bold mb-0 text-white" style={{ fontSize: "1.05rem" }}>
                  Yangi Do&apos;kon Ochish (SaaS Onboarding)
                </h4>
                <div className="text-secondary small" style={{ fontSize: "0.75rem" }}>
                  Bosqich {step} / {totalSteps} • 7 kunlik bepul sinov
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={busy}
              aria-label="Yopish"
            />
          </div>

          {/* Progress Bar */}
          <div style={{ height: "3px", backgroundColor: "rgba(255, 255, 255, 0.08)", width: "100%" }}>
            <div
              style={{
                height: "100%",
                width: `${(step / totalSteps) * 100}%`,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Body with Steps */}
          <div className="modal-body p-4">
            {/* Step 1: Business Name & Slug */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">1. Do'koningiz Nomi va URL Manzili</h3>
                  <p className="text-secondary small">
                    Mijozlar va tizim uchun do'koningiz brend nomini hamda do'kon manzilini (slug) belgilang.
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label required">Do'kon / Biznes Nomi</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Masalan: Kiber Magazin, Gadget Store, Laptop World..."
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      if (!customSlug) {
                        setCustomSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "-")
                            .replace(/-+/g, "-")
                            .replace(/^-|-$/g, "")
                        );
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Do'kon URL Identifikatori (Slug)</label>
                  <div className="input-group">
                    <span className="input-group-text font-monospace text-secondary">/t/</span>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="kiber-magazin"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                    />
                  </div>
                  <small className="form-hint">
                    Ushbu havola orqali bevosita do'kon boshqaruviga kirasiz: <code>/t/{customSlug || "slug"}</code>
                  </small>
                </div>
              </div>
            )}

            {/* Step 2: Category / Industry */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">2. Faoliyat Sohasi (Kategoriya)</h3>
                  <p className="text-secondary small">
                    AI savdo assistentining lug'ati va muloqot terminologiyasini moslashtirish uchun sohani tanlang.
                  </p>
                </div>
                <div className="row g-2">
                  {[
                    "Elektronika va Maishiy Texnika",
                    "Kiyim-Kechak va Moda",
                    "Restoran va Taom Yetkazib Berish",
                    "Go'zallik va Parfyumeriya",
                    "Mebel va Uy Jihozlari",
                    "Ta'lim va Kurslar",
                    "Avto Ehtiyot Qismlar",
                    "Boshqa Xizmatlar",
                  ].map((cat) => (
                    <div key={cat} className="col-md-6">
                      <div
                        className={`p-3 rounded-3 border cursor-pointer transition-all ${
                          category === cat
                            ? "border-primary bg-primary-lt"
                            : "border-secondary border-opacity-15 bg-body-tertiary"
                        }`}
                        onClick={() => setCategory(cat)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="d-flex align-items-center justify-content-between">
                          <span className="fw-semibold text-white small">{cat}</span>
                          {category === cat && <IconCheck size={18} className="text-primary" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Telegram Bot Token (NEW!) */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">3. Telegram Bot Tokeni</h3>
                  <p className="text-secondary small">
                    Do'koningiz mijozlari bilan muloqot qiluvchi Telegram botingiz tokenini kiriting.
                  </p>
                </div>

                <div className="mb-3">
                  <label className="form-label">Telegram Bot Token (@BotFather bergan token)</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <IconKey size={18} />
                    </span>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ..."
                      value={botToken}
                      onChange={(e) => {
                        setBotToken(e.target.value);
                        setBotVerification({ checking: false, verified: false });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary d-flex align-items-center gap-1.5"
                      onClick={handleVerifyBotToken}
                      disabled={botVerification.checking || !botToken.trim()}
                    >
                      {botVerification.checking ? (
                        <>
                          <span className="spinner-border spinner-border-sm" />
                          <span>Tekshirilmoqda...</span>
                        </>
                      ) : (
                        <>
                          <IconRefresh size={16} />
                          <span>Tekshirish</span>
                        </>
                      )}
                    </button>
                  </div>
                  <small className="form-hint">
                    Token serverimizda <strong>Fernet AES-128</strong> bilan shifrlanadi va hech qachon ochiq ko'rsatilmaydi.
                  </small>
                </div>

                {botVerification.verified && (
                  <div className="alert alert-success d-flex align-items-center gap-2 mb-0 py-2.5">
                    <IconCheck size={20} className="text-success flex-shrink-0" />
                    <div>
                      <strong className="d-block text-white">Bot muvaffaqiyatli tasdiqlandi!</strong>
                      <span className="small text-secondary">
                        Nomi: <strong>{botVerification.bot_name}</strong> • Username: <code>@{botVerification.bot_username}</code>
                      </span>
                    </div>
                  </div>
                )}

                {botVerification.error && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 py-2.5">
                    <IconAlertCircle size={20} className="text-danger flex-shrink-0" />
                    <div className="small">
                      <div>{botVerification.error}</div>
                      <div className="mt-1 opacity-75" style={{ fontSize: "0.78rem" }}>
                        💡 Token to&apos;g&apos;ri bo&apos;lsa, xavotir olmang: <strong>&quot;Davom etish &rarr;&quot;</strong> tugmasini bosib keyingi bosqichga o&apos;tishingiz mumkin.
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded bg-dark border border-secondary border-opacity-20 mt-3 small text-secondary">
                  💡 <strong>Bot tokeningiz yo'qmi?</strong> Telegram'da <code>@BotFather</code> ga <code>/newbot</code> deb yozing, nom tanlang va berilgan tokenni shu yerga nusxalang.
                  Tokenni keyinchalik do'kon sozlamalaridan ham kiritish mumkin.
                </div>
              </div>
            )}

            {/* Step 4: Telegram Business Connection Instructions */}
            {step === 4 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">4. Telegram Business Ulanishi</h3>
                  <p className="text-secondary small">
                    Assistent mijozlaringiz bilan Telegram Business xabarlari orqali avtomatik muloqot qiladi.
                  </p>
                </div>
                <div className="p-3.5 rounded bg-dark border border-secondary border-opacity-20 space-y-2">
                  <div className="d-flex align-items-center gap-2 text-primary fw-bold">
                    <IconBrandTelegram size={20} />
                    <span>Telegram Business Ulanish Bosqichlari:</span>
                  </div>
                  <ol className="text-secondary small ps-3 mb-0 space-y-1">
                    <li>Telegram ilovangizda <strong>Sozlamalar → Telegram Business → Chatbotlar</strong> bo'limiga kiring.</li>
                    <li>Botingiz nomini (masalan: <code>@{botVerification.bot_username || "botingiz_nomi"}</code>) qidiring.</li>
                    <li><strong>"Xabarlarga javob berish (can_reply)"</strong> ruxsatini yoqing va saqlang.</li>
                  </ol>
                </div>
                <p className="text-success small mb-0 mt-2">
                  ✓ Do'kon yaratilgach, Webhook avtomatik Telegram serverlariga ulanadi.
                </p>
              </div>
            )}

            {/* Step 5: Telegram Channel for Knowledge */}
            {step === 5 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">5. Mahsulotlar Kanali (Bilimlar Bazasi)</h3>
                  <p className="text-secondary small">
                    AI o'zbek tilidagi narxlar, fotosuratlar va tavsiflarni qaysi Telegram kanalidan o'rgansin?
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label">Telegram Kanal Havolasi yoki Username</label>
                  <div className="input-group">
                    <span className="input-group-text">@</span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="masalan: mening_dokonim_uz"
                      value={telegramChannel}
                      onChange={(e) => {
                        setTelegramChannel(e.target.value.replace(/^@/, ""));
                        setChannelVerification({ checking: false, verified: false });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary d-flex align-items-center gap-1.5"
                      onClick={handleVerifyChannel}
                      disabled={channelVerification.checking || !telegramChannel.trim()}
                    >
                      {channelVerification.checking ? (
                        <>
                          <span className="spinner-border spinner-border-sm" />
                          <span>Tekshirilmoqda...</span>
                        </>
                      ) : (
                        <>
                          <IconRefresh size={16} />
                          <span>Tekshirish</span>
                        </>
                      )}
                    </button>
                  </div>
                  <small className="form-hint">
                    Kanal postlari avtomatik tahlil qilinadi va mijozlar savol berganda rasm va narxlar taqdim etiladi.
                  </small>
                </div>

                {channelVerification.verified && (
                  <div className="alert alert-success d-flex align-items-center gap-2 mb-0 py-2.5">
                    <IconCheck size={20} className="text-success flex-shrink-0" />
                    <div>
                      <strong className="d-block text-white">Kanal muvaffaqiyatli tasdiqlandi!</strong>
                      <span className="small text-secondary">
                        Nomi: <strong>{channelVerification.title}</strong> • Username: <code>@{channelVerification.username}</code>
                        {channelVerification.subscribers != null && (
                          <> • <strong>{channelVerification.subscribers.toLocaleString()}</strong> ta obunachi</>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {channelVerification.error && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 py-2.5">
                    <IconAlertCircle size={20} className="text-danger flex-shrink-0" />
                    <div className="small">
                      <div>{channelVerification.error}</div>
                      <div className="mt-1 opacity-75" style={{ fontSize: "0.78rem" }}>
                        💡 Kanal username to&apos;g&apos;ri bo&apos;lsa, <strong>&quot;Davom etish &rarr;&quot;</strong> tugmasini bosib keyingi bosqichga o&apos;tishingiz mumkin.
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded bg-dark border border-secondary border-opacity-20 mt-3 small text-secondary">
                  💡 <strong>Kanal ommaviy (public) bo'lishi tavsiya etiladi.</strong> Kanal xabarlari va mahsulot kartochkalarini AI avtomatik o&apos;qib, savol bergan mijozlarga mos rasm va narxlarni tavsiya qiladi.
                </div>
              </div>
            )}

            {/* Step 6: Telegram User Client & API Credentials (my.telegram.org) */}
            {step === 6 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">6. Telegram API va Foydalanuvchi Sozlamalari</h3>
                  <p className="text-secondary small">
                    Har bir do&apos;konning mustaqil Telegram API kalitlari (API ID, Hash) va buyurtma xabarnomalari uchun Admin Chat ID.
                  </p>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">
                      Telegram API ID <span className="text-secondary small font-monospace">(App api_id)</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text"><IconId size={18} /></span>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="Masalan: 20400123"
                        value={telegramApiId}
                        onChange={(e) => setTelegramApiId(e.target.value.replace(/[^0-9]/g, ""))}
                      />
                    </div>
                    <small className="form-hint">my.telegram.org &rarr; API development tools bo&apos;limidan olinadi.</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Telegram API HASH <span className="text-secondary small font-monospace">(App api_hash)</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text"><IconShieldLock size={18} /></span>
                      <input
                        type={showApiHash ? "text" : "password"}
                        className="form-control font-monospace"
                        placeholder="Masalan: 0123456789abcdef0123456789abcdef"
                        value={telegramApiHash}
                        onChange={(e) => setTelegramApiHash(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowApiHash(!showApiHash)}
                        title={showApiHash ? "Yashirish" : "Ko'rsatish"}
                      >
                        {showApiHash ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </button>
                    </div>
                    <small className="form-hint">Serverda AES-128 bilan shifrlanadi.</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Bog&apos;langan Telefon Raqam <span className="text-secondary small">(User session uchun)</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text"><IconPhone size={18} /></span>
                      <input
                        type="tel"
                        className="form-control font-monospace"
                        placeholder="+998901234567"
                        value={telegramPhone}
                        onChange={(e) => setTelegramPhone(e.target.value)}
                      />
                    </div>
                    <small className="form-hint">Telegram profilingizga ulangan xalqaro formatdagi raqam.</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Admin / Foydalanuvchi Chat ID <span className="text-secondary small">(Bildirishnomalar uchun)</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text"><IconMessageDots size={18} /></span>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="Masalan: 5544332211"
                        value={adminChatId}
                        onChange={(e) => setAdminChatId(e.target.value.replace(/[^0-9-]/g, ""))}
                      />
                    </div>
                    <small className="form-hint">Yangi buyurtmalar va ogohlantirishlar shu chatga yuboriladi.</small>
                  </div>
                </div>

                <div className="p-3 rounded bg-dark border border-secondary border-opacity-20 mt-3 small text-secondary">
                  <div className="fw-bold text-white mb-1">💡 Ushbu ma&apos;lumotlarni qayerdan olish mumkin?</div>
                  <ul className="ps-3 mb-1 space-y-1">
                    <li><strong>API ID va API HASH:</strong> <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-primary text-decoration-underline">my.telegram.org</a> saytiga kiring &rarr; <em>API development tools</em> bo&apos;limida yangi dastur oching.</li>
                    <li><strong>Chat ID:</strong> Telegram&apos;da <code>@userinfobot</code> ga <code>/start</code> deb yozing, u sizning shaxsiy raqamli ID&apos;ingizni ko&apos;rsatadi.</li>
                  </ul>
                  <div className="mt-1 text-muted opacity-75">
                    Agar hozir bu kalitlar mavjud bo&apos;lmasa, xavotir olmang: ularni keyinchalik <strong>Do&apos;kon Sozlamalari</strong> bo&apos;limidan istalgan payt kiritishingiz mumkin.
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: AI Language */}
            {step === 7 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">7. AI Muloqot Tili</h3>
                  <p className="text-secondary small">
                    Assistent asosan qaysi tilda mijozlar bilan muloqot qilsin?
                  </p>
                </div>
                <div className="row g-3">
                  {[
                    { code: "uz", label: "O'zbek tili (Lotin / Kirill)", desc: "O'zbekiston ichki bozori uchun to'liq optimallashgan" },
                    { code: "ru", label: "Rus tili (Русский язык)", desc: "MDH va rusiyzabon mijozlar uchun" },
                    { code: "en", label: "Ingliz tili (English)", desc: "Xalqaro savdo va eksport do'konlari uchun" },
                  ].map((lang) => (
                    <div key={lang.code} className="col-12">
                      <div
                        className={`p-3 rounded-3 border transition-all ${
                          aiLanguage === lang.code
                            ? "border-primary bg-primary-lt"
                            : "border-secondary border-opacity-15 bg-body-tertiary"
                        }`}
                        onClick={() => setAiLanguage(lang.code)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <div className="fw-bold text-white">{lang.label}</div>
                            <div className="text-secondary small">{lang.desc}</div>
                          </div>
                          {aiLanguage === lang.code && <IconCheck size={20} className="text-primary" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 8: AI Personality & Tone */}
            {step === 8 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-3">
                  <h3 className="fw-bold text-white mb-1">8. AI Shaxsi va Muloqot Uslubi</h3>
                  <p className="text-secondary small">
                    Assistent qanday ohangda javob bersin?
                  </p>
                </div>
                <div className="row g-2">
                  {[
                    "Professional va do'stona sotuvchi assistent (Tavsiya etiladi)",
                    "Rasmiy, aniq va lutfli konsultant",
                    "Zamonaviy, yorqin va pozitiv maslahatchi (smayliklar bilan)",
                    "Qat'iy biznes va premium konsyerj uslubi",
                  ].map((p) => (
                    <div key={p} className="col-12">
                      <div
                        className={`p-3 rounded-3 border transition-all ${
                          aiPersonality === p
                            ? "border-primary bg-primary-lt"
                            : "border-secondary border-opacity-15 bg-body-tertiary"
                        }`}
                        onClick={() => setAiPersonality(p)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="d-flex align-items-center justify-content-between">
                          <span className="fw-semibold text-white small">{p}</span>
                          {aiPersonality === p && <IconCheck size={18} className="text-primary" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 9: Select Initial Plan */}
            {step === 9 && (
              <div className="space-y-3">
                <div className="text-center py-2 mb-2">
                  <h3 className="fw-bold text-white mb-1">9. Boshlang&apos;ich Tarifni Tanlang</h3>
                  <p className="text-secondary small mb-2">
                    Har bir yangi biznes uchun <strong className="text-white">7 kunlik bepul sinov muddati</strong> taqdim etiladi!
                  </p>
                  {/* Currency Switcher */}
                  <div
                    className="d-inline-flex align-items-center p-1 rounded-pill"
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 border-0 fw-semibold transition-all ${
                        currency === "USD" ? "text-white" : "text-secondary"
                      }`}
                      style={{
                        background: currency === "USD" ? "var(--accent, #6366f1)" : "transparent",
                        fontSize: "0.78rem",
                      }}
                      onClick={() => setCurrency("USD")}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 border-0 fw-semibold transition-all ${
                        currency === "UZS" ? "text-white" : "text-secondary"
                      }`}
                      style={{
                        background: currency === "UZS" ? "var(--accent, #6366f1)" : "transparent",
                        fontSize: "0.78rem",
                      }}
                      onClick={() => setCurrency("UZS")}
                    >
                      UZS (so&apos;m)
                    </button>
                  </div>
                </div>

                <div className="row g-3">
                  {(availablePlans.length > 0 ? availablePlans : [
                    { code: "start", name: "START", price_monthly_formatted: "$19", price_monthly_uzs_formatted: "244 000 so'm", description: "1,000 AI xabar, 1 kanal, 2 operator" },
                    { code: "standard", name: "STANDART", price_monthly_formatted: "$39", price_monthly_uzs_formatted: "499 000 so'm", description: "3,500 AI xabar, Vision, 5 operator" },
                    { code: "pro", name: "PRO", price_monthly_formatted: "$59", price_monthly_uzs_formatted: "758 000 so'm", description: "7,500 AI xabar, Vision, RAG, 10 operator" },
                    { code: "ultra", name: "ULTRA", price_monthly_formatted: "$149", price_monthly_uzs_formatted: "1 914 000 so'm", description: "30,000 AI xabar, Premium AI, 50 operator" },
                  ]).map((pl: any) => {
                    const isSelected = planCode === pl.code;
                    const priceFormatted = currency === "USD"
                      ? `${pl.price_monthly_formatted || "$" + (pl.price_monthly || 19)}/oy`
                      : `${pl.price_monthly_uzs_formatted || (pl.price_monthly_uzs ? (pl.price_monthly_uzs / 100).toLocaleString("uz-UZ") + " so'm" : "244 000 so'm")}/oy`;
                    return (
                      <div key={pl.code} className="col-md-3 col-sm-6">
                        <div
                          className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between transition-all"
                          onClick={() => setPlanCode(pl.code)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: isSelected ? "rgba(99, 102, 241, 0.12)" : "var(--bg-surface-elevated, #161b22)",
                            borderColor: isSelected ? "var(--accent, #6366f1)" : "var(--border-default, rgba(255, 255, 255, 0.1))",
                            boxShadow: isSelected ? "0 0 0 1px var(--accent, #6366f1), 0 8px 24px rgba(99, 102, 241, 0.25)" : "none",
                            borderRadius: "12px",
                          }}
                        >
                          <div>
                            <div className="d-flex align-items-center justify-content-between mb-1.5">
                              <span className="fw-bold text-white font-monospace">{pl.name}</span>
                              {isSelected && <IconCheck size={18} style={{ color: "var(--accent, #6366f1)" }} />}
                            </div>
                            <div className="fs-3 fw-bold text-success font-monospace mb-2">{priceFormatted}</div>
                            <p className="text-secondary small mb-0">{pl.description || pl.desc}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 10: Confirmation & Launch Trial */}
            {step === 10 && (
              <div className="text-center py-2">
                {/* Checkmark Circle (Fixed dimensions to prevent stretching) */}
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{
                    width: "64px",
                    height: "64px",
                    minWidth: "64px",
                    minHeight: "64px",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    border: "2px solid rgba(16, 185, 129, 0.4)",
                    color: "#10b981",
                    boxShadow: "0 0 24px rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <IconCheck size={32} stroke={2.5} />
                </div>

                <h2 className="fw-bold text-white mb-2" style={{ fontSize: "1.45rem", letterSpacing: "-0.02em" }}>
                  Barchasi Tayyor!
                </h2>
                <p className="text-secondary small mx-auto mb-4" style={{ maxWidth: "440px", lineHeight: 1.55 }}>
                  <strong className="text-white">{businessName || "Yangi Biznes"}</strong> do&apos;koni uchun 7 kunlik to&apos;liq bepul sinov muddati faollashtirilmoqda. Bank kartasi talab etilmaydi.
                </p>

                {/* Structured Summary Card */}
                <div
                  className="mx-auto text-start p-3.5 mb-3"
                  style={{
                    maxWidth: "460px",
                    backgroundColor: "var(--bg-surface-elevated, #161b22)",
                    border: "1px solid var(--border-default, rgba(255, 255, 255, 0.1))",
                    borderRadius: "14px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  <div
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    <span className="text-secondary small">Do&apos;kon nomi:</span>
                    <strong className="text-white small">{businessName || "Yangi Biznes"}</strong>
                  </div>

                  <div
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    <span className="text-secondary small">Havola (Slug):</span>
                    <span
                      className="font-monospace small px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: "var(--accent-subtle, rgba(99, 102, 241, 0.15))",
                        color: "var(--accent, #818cf8)",
                        fontSize: "0.78rem",
                      }}
                    >
                      /t/{customSlug || "biznes"}
                    </span>
                  </div>

                  <div
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    <span className="text-secondary small">Faoliyat sohasi:</span>
                    <strong className="text-white small">{category}</strong>
                  </div>

                  <div
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    <span className="text-secondary small">Telegram Bot:</span>
                    {botVerification.bot_username ? (
                      <span
                        className="small px-2 py-0.5 rounded fw-medium"
                        style={{
                          backgroundColor: "rgba(34, 158, 217, 0.15)",
                          color: "#229ed9",
                          fontSize: "0.78rem",
                        }}
                      >
                        @{botVerification.bot_username}
                      </span>
                    ) : botToken ? (
                      <span
                        className="small px-2 py-0.5 rounded fw-medium"
                        style={{
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          fontSize: "0.78rem",
                        }}
                      >
                        ✓ Kiritilgan
                      </span>
                    ) : (
                      <span
                        className="small px-2 py-0.5 rounded text-secondary"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          fontSize: "0.78rem",
                        }}
                      >
                        Keyinroq ulanadi
                      </span>
                    )}
                  </div>

                  <div
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    <span className="text-secondary small">Telegram Kanal:</span>
                    {channelVerification.username || telegramChannel ? (
                      <span
                        className="small px-2 py-0.5 rounded fw-medium"
                        style={{
                          backgroundColor: "rgba(34, 158, 217, 0.15)",
                          color: "#229ed9",
                          fontSize: "0.78rem",
                        }}
                      >
                        @{channelVerification.username || telegramChannel.replace(/^@/, "")}
                        {channelVerification.title ? ` (${channelVerification.title})` : ""}
                      </span>
                    ) : (
                      <span
                        className="small px-2 py-0.5 rounded text-secondary"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          fontSize: "0.78rem",
                        }}
                      >
                        Kiritilmagan
                      </span>
                    )}
                  </div>

                  <div
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    <span className="text-secondary small">Telegram API ID / Hash:</span>
                    {telegramApiId ? (
                      <span
                        className="small px-2 py-0.5 rounded fw-medium"
                        style={{
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          fontSize: "0.78rem",
                        }}
                      >
                        ID: {telegramApiId} {telegramApiHash ? "• Hash: ✓" : ""}
                      </span>
                    ) : (
                      <span
                        className="small px-2 py-0.5 rounded text-secondary"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          fontSize: "0.78rem",
                        }}
                      >
                        Sozlamalardan kiritiladi
                      </span>
                    )}
                  </div>

                  {adminChatId && (
                    <div
                      className="d-flex align-items-center justify-content-between py-2 border-bottom"
                      style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                    >
                      <span className="text-secondary small">Admin Chat ID:</span>
                      <span className="font-monospace small text-white">{adminChatId}</span>
                    </div>
                  )}

                  <div
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ borderColor: "rgba(255, 255, 255, 0.06)" }}
                  >
                    <span className="text-secondary small">Tanlangan tarif:</span>
                    <span
                      className="small px-2 py-0.5 rounded fw-bold text-uppercase"
                      style={{
                        backgroundColor: "rgba(139, 92, 246, 0.15)",
                        color: "#a78bfa",
                        fontSize: "0.78rem",
                      }}
                    >
                      {planCode} PLAN
                    </span>
                  </div>

                  <div className="d-flex align-items-center justify-content-between py-2">
                    <span className="text-secondary small">Sinov muddati:</span>
                    <span
                      className="small px-2 py-0.5 rounded fw-bold"
                      style={{
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        color: "#10b981",
                        fontSize: "0.78rem",
                      }}
                    >
                      7 kun bepul
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div
            className="modal-footer py-3 px-4 d-flex align-items-center justify-content-between border-top"
            style={{
              borderColor: "var(--border-subtle, rgba(255, 255, 255, 0.08))",
              backgroundColor: "var(--bg-surface-elevated, #161b22)",
            }}
          >
            {step > 1 ? (
              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-2"
                onClick={handleBack}
                disabled={busy}
                style={{
                  borderRadius: "8px",
                  borderColor: "var(--border-default, rgba(255, 255, 255, 0.15))",
                  color: "var(--text-secondary, #94a3b8)",
                }}
              >
                <IconArrowLeft size={16} />
                <span>Orqaga</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 fw-semibold"
              onClick={handleNext}
              disabled={busy || (step === 1 && !businessName.trim())}
              style={{
                borderRadius: "8px",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                border: "none",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
              }}
            >
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  <span>Do&apos;kon ochilmoqda...</span>
                </>
              ) : step === totalSteps ? (
                <>
                  <IconSparkles size={16} />
                  <span>Do&apos;konni Ochish & Sinovni Boshlash</span>
                </>
              ) : (
                <>
                  <span>Davom etish</span>
                  <IconArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
