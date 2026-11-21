"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import "./login.css";

interface LoginPageClientProps {
  initialRedirect: string;
  initialTab?: string;
  initialError?: string;
}

type AuthMode = "login" | "register" | "master";
type Language = "uz" | "ru" | "en";

interface TranslationText {
  brandSubtitle: string;
  tabLogin: string;
  tabRegister: string;
  tabMaster: string;
  orContinueWith: string;
  orWithEmail: string;
  telegramBtn: string;
  googleBtn: string;
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  masterPasswordLabel: string;
  masterPasswordPlaceholder: string;
  masterPasswordHint: string;
  rememberMe: string;
  forgotPassword: string;
  submitLogin: string;
  submitRegister: string;
  submitMaster: string;
  loading: string;
  noAccountPrompt: string;
  registerLink: string;
  haveAccountPrompt: string;
  loginLink: string;
  termsAgreement: string;
  termsLink: string;
  backToHome: string;
  sslSecure: string;
  telegramModalTitle: string;
  telegramModalDesc: string;
  telegramInputPlaceholder: string;
  telegramSubmit: string;
  telegramCancel: string;
  passwordsDoNotMatch: string;
  forgotPasswordNotice: string;
}

const TRANSLATIONS: Record<Language, TranslationText> = {
  uz: {
    brandSubtitle: "Sun'iy intellekt asosidagi savdo ekotizimi",
    tabLogin: "Kirish",
    tabRegister: "Ro'yxatdan o'tish",
    tabMaster: "Boshqaruv paroli",
    orContinueWith: "yoki quyidagi tizimlar orqali",
    orWithEmail: "yoki email manzil orqali",
    telegramBtn: "Telegram orqali kirish",
    googleBtn: "Google orqali davom etish",
    fullNameLabel: "To'liq ismingiz",
    fullNamePlaceholder: "Masalan: Aziz Rahimov",
    emailLabel: "Email manzil",
    emailPlaceholder: "sizning@email.uz",
    passwordLabel: "Parol",
    passwordPlaceholder: "Kamida 6 ta belgi",
    confirmPasswordLabel: "Parolni tasdiqlang",
    confirmPasswordPlaceholder: "Parolni qayta kiriting",
    masterPasswordLabel: "Administrator boshqaruv paroli",
    masterPasswordPlaceholder: "DASHBOARD_PASSWORD",
    masterPasswordHint: "Do'kon egasi yoki platforma moderatori uchun maxsus kirish",
    rememberMe: "Eslab qolish",
    forgotPassword: "Parolni unutdingizmi?",
    submitLogin: "Tizimga kirish",
    submitRegister: "Hisob yaratish",
    submitMaster: "Boshqaruv paneliga o'tish",
    loading: "Tekshirilmoqda...",
    noAccountPrompt: "Hali akkauntingiz yo'qmi?",
    registerLink: "Ro'yxatdan o'tish",
    haveAccountPrompt: "Hisobingiz bormi?",
    loginLink: "Kirish",
    termsAgreement: "Ro'yxatdan o'tish orqali siz Selloi",
    termsLink: "Foydalanish shartlariga rozilik bildirasiz.",
    backToHome: "Bosh sahifa",
    sslSecure: "256-bit SSL xavfsiz shifrlash orqali himoyalangan",
    telegramModalTitle: "Telegram orqali kirish",
    telegramModalDesc: "Telegram foydalanuvchi nomingiz yoki ID raqamingizni kiriting:",
    telegramInputPlaceholder: "@username yoki ID raqami",
    telegramSubmit: "Telegram orqali tasdiqlash",
    telegramCancel: "Bekor qilish",
    passwordsDoNotMatch: "Kiritilgan parollar bir-biriga mos kelmadi",
    forgotPasswordNotice: "Parolni tiklash bo'yicha yo'riqnoma Tez orada Telegram botingizga yuboriladi.",
  },
  ru: {
    brandSubtitle: "Экосистема продаж на базе искусственного интеллекта",
    tabLogin: "Войти",
    tabRegister: "Регистрация",
    tabMaster: "Мастер-пароль",
    orContinueWith: "или через сервисы",
    orWithEmail: "или с помощью email",
    telegramBtn: "Войти через Telegram",
    googleBtn: "Продолжить с Google",
    fullNameLabel: "Ваше полное имя",
    fullNamePlaceholder: "Например: Азиз Рахимов",
    emailLabel: "Email адрес",
    emailPlaceholder: "your@email.com",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Не менее 6 символов",
    confirmPasswordLabel: "Подтвердите пароль",
    confirmPasswordPlaceholder: "Повторите пароль",
    masterPasswordLabel: "Пароль администратора",
    masterPasswordPlaceholder: "DASHBOARD_PASSWORD",
    masterPasswordHint: "Вход для владельца магазина или администратора платформы",
    rememberMe: "Запомнить меня",
    forgotPassword: "Забыли пароль?",
    submitLogin: "Войти в систему",
    submitRegister: "Создать аккаунт",
    submitMaster: "Перейти в панель",
    loading: "Проверка...",
    noAccountPrompt: "Еще нет аккаунта?",
    registerLink: "Зарегистрироваться",
    haveAccountPrompt: "Уже есть аккаунт?",
    loginLink: "Войти",
    termsAgreement: "Регистрируясь, вы принимаете",
    termsLink: "Условия использования Selloi.",
    backToHome: "На главную",
    sslSecure: "Защищено 256-битным SSL шифрованием",
    telegramModalTitle: "Вход через Telegram",
    telegramModalDesc: "Введите ваш Telegram username или ID пользователя:",
    telegramInputPlaceholder: "@username или ID",
    telegramSubmit: "Подтвердить через Telegram",
    telegramCancel: "Отмена",
    passwordsDoNotMatch: "Пароли не совпадают",
    forgotPasswordNotice: "Инструкция по восстановлению пароля будет отправлена в Telegram.",
  },
  en: {
    brandSubtitle: "AI-Powered Sales Automation Ecosystem",
    tabLogin: "Sign In",
    tabRegister: "Create Account",
    tabMaster: "Master Password",
    orContinueWith: "or continue with",
    orWithEmail: "or with email address",
    telegramBtn: "Sign in with Telegram",
    googleBtn: "Continue with Google",
    fullNameLabel: "Full Name",
    fullNamePlaceholder: "e.g. Aziz Rahimov",
    emailLabel: "Email address",
    emailPlaceholder: "your@email.com",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 6 characters",
    confirmPasswordLabel: "Confirm Password",
    confirmPasswordPlaceholder: "Repeat password",
    masterPasswordLabel: "Administrator Master Password",
    masterPasswordPlaceholder: "DASHBOARD_PASSWORD",
    masterPasswordHint: "Direct access for store owners and platform managers",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    submitLogin: "Sign In",
    submitRegister: "Get Started",
    submitMaster: "Access Dashboard",
    loading: "Verifying...",
    noAccountPrompt: "Don't have an account?",
    registerLink: "Sign up",
    haveAccountPrompt: "Already have an account?",
    loginLink: "Sign In",
    termsAgreement: "By signing up you agree to Selloi's",
    termsLink: "Terms of Service and Privacy Policy.",
    backToHome: "Back to Home",
    sslSecure: "Protected by 256-bit SSL encryption",
    telegramModalTitle: "Telegram Authentication",
    telegramModalDesc: "Enter your Telegram username or user ID:",
    telegramInputPlaceholder: "@username or ID number",
    telegramSubmit: "Confirm via Telegram",
    telegramCancel: "Cancel",
    passwordsDoNotMatch: "Passwords do not match",
    forgotPasswordNotice: "Password reset instructions will be sent to your connected Telegram bot.",
  },
};

export default function LoginPageClient({
  initialRedirect,
  initialTab,
  initialError,
}: LoginPageClientProps) {
  const [lang, setLang] = useState<Language>("uz");
  const [mode, setMode] = useState<AuthMode>(
    initialTab === "register" ? "register" : initialTab === "master" ? "master" : "login"
  );

  const getInitialErrorText = (code?: string): string | null => {
    if (!code) return null;
    if (code === "google_not_configured") {
      return "Google OAuth ulanishi: GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET kalitlari sozlanishi lozim.";
    }
    if (code === "google_cancelled") {
      return "Google orqali kirish bekor qilindi.";
    }
    if (code === "google_token_failed" || code === "google_error") {
      return "Google orqali tasdiqlashda xatolik yuz berdi. Qayta urinib ko'ring.";
    }
    return null;
  };

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // UI status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(getInitialErrorText(initialError));
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // Telegram modal state
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramHandle, setTelegramHandle] = useState("");

  const t = TRANSLATIONS[lang];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoNotice(null);
    setLoading(true);

    try {
      const payload: Record<string, any> = {
        email: email.trim().toLowerCase(),
        password,
      };

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Email yoki parol noto'g'ri");
        setLoading(false);
        return;
      }

      window.location.href = initialRedirect || "/dashboard";
    } catch (err: any) {
      setError("Tarmoq xatosi: " + err.message);
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoNotice(null);

    if (password !== confirmPassword) {
      setError(t.passwordsDoNotMatch);
      return;
    }

    if (password.length < 6) {
      setError(t.passwordPlaceholder);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Ro'yxatdan o'tishda xatolik yuz berdi");
        setLoading(false);
        return;
      }

      window.location.href = initialRedirect || "/dashboard";
    } catch (err: any) {
      setError("Tarmoq xatosi: " + err.message);
      setLoading(false);
    }
  };

  const handleMasterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoNotice(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: masterPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Boshqaruv paroli noto'g'ri");
        setLoading(false);
        return;
      }

      window.location.href = initialRedirect || "/dashboard";
    } catch (err: any) {
      setError("Tarmoq xatosi: " + err.message);
      setLoading(false);
    }
  };

  const handleTelegramAuth = async () => {
    if (!telegramHandle.trim()) {
      setError("Telegram username yoki ID raqamini kiriting");
      return;
    }

    setLoading(true);
    setTelegramModalOpen(false);
    setError(null);

    try {
      const cleanHandle = telegramHandle.replace(/^@/, "").trim();
      const num = Number(cleanHandle);

      const payload: Record<string, any> = {
        password: password || masterPassword || "selloi_tg_auth",
      };
      if (Number.isFinite(num) && num > 0) {
        payload.telegram_id = num;
      } else {
        payload.email = `${cleanHandle.toLowerCase()}@telegram.selloi.uz`;
      }

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Telegram orqali kirishda xatolik yuz berdi. Parol bilan urinib ko'ring.");
        setLoading(false);
        return;
      }

      window.location.href = initialRedirect || "/dashboard";
    } catch (err: any) {
      setError("Tarmoq xatosi: " + err.message);
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    setError(null);
    setInfoNotice(null);
    setLoading(true);
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="selloi-auth-wrapper">
      {/* Ambient background glows */}
      <div className="selloi-glow-top" aria-hidden="true" />
      <div className="selloi-glow-bottom" aria-hidden="true" />

      {/* Top Bar: Home link + Language Switcher */}
      <div className="selloi-auth-topbar">
        <Link href="/" className="selloi-auth-back-link">
          <ArrowLeft size={16} />
          <span>{t.backToHome}</span>
        </Link>

        <div className="selloi-lang-picker">
          <Globe size={15} className="text-secondary" />
          <button
            type="button"
            className={`selloi-lang-btn ${lang === "uz" ? "active" : ""}`}
            onClick={() => setLang("uz")}
          >
            UZ
          </button>
          <span className="selloi-lang-divider">/</span>
          <button
            type="button"
            className={`selloi-lang-btn ${lang === "ru" ? "active" : ""}`}
            onClick={() => setLang("ru")}
          >
            RU
          </button>
          <span className="selloi-lang-divider">/</span>
          <button
            type="button"
            className={`selloi-lang-btn ${lang === "en" ? "active" : ""}`}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </div>
      </div>

      {/* Main Glass Card Container */}
      <div className="selloi-auth-card">
        {/* Brand Header */}
        <div className="selloi-auth-header">
          <Link href="/" className="selloi-auth-logo-row">
            <img
              src="/figma/selloi-logo.png"
              alt="Selloi"
              className="selloi-auth-logo-img"
            />
            <span className="selloi-auth-brand-name">Selloi</span>
          </Link>
          <p className="selloi-auth-subtitle">{t.brandSubtitle}</p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="selloi-auth-tabs">
          <button
            type="button"
            className={`selloi-tab-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            {t.tabLogin}
          </button>
          <button
            type="button"
            className={`selloi-tab-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            {t.tabRegister}
          </button>
          <button
            type="button"
            className={`selloi-tab-btn ${mode === "master" ? "active" : ""}`}
            onClick={() => {
              setMode("master");
              setError(null);
            }}
            title={t.masterPasswordHint}
          >
            <KeyRound size={13} style={{ marginRight: "4px" }} />
            {t.tabMaster}
          </button>
        </div>

        {/* Error and Info Notices */}
        {error && (
          <div className="selloi-alert selloi-alert-danger">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoNotice && (
          <div className="selloi-alert selloi-alert-info">
            <Sparkles size={16} className="flex-shrink-0" />
            <span>{infoNotice}</span>
          </div>
        )}

        {/* Third-Party Fast Auth Options (Shown on Login & Register) */}
        {mode !== "master" && (
          <div className="selloi-social-auth-section">
            <button
              type="button"
              className="selloi-social-btn selloi-tg-btn"
              onClick={() => setTelegramModalOpen(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="selloi-tg-icon"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"
                  fill="#0088CC"
                />
              </svg>
              <span>{t.telegramBtn}</span>
            </button>

            <button
              type="button"
              className="selloi-social-btn selloi-google-btn"
              onClick={handleGoogleAuth}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                className="selloi-google-icon"
              >
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{t.googleBtn}</span>
            </button>

            <div className="selloi-divider">
              <span>{t.orWithEmail}</span>
            </div>
          </div>
        )}

        {/* Form Mode 1: Login */}
        {mode === "login" && (
          <form onSubmit={handleLoginSubmit} className="selloi-auth-form">
            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.emailLabel}</label>
              <div className="selloi-input-wrapper">
                <Mail size={16} className="selloi-input-icon" />
                <input
                  type="email"
                  className="selloi-input"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="selloi-form-group">
              <div className="selloi-label-row">
                <label className="selloi-form-label">{t.passwordLabel}</label>
                <button
                  type="button"
                  className="selloi-forgot-link"
                  onClick={() => setInfoNotice(t.forgotPasswordNotice)}
                >
                  {t.forgotPassword}
                </button>
              </div>
              <div className="selloi-input-wrapper">
                <Lock size={16} className="selloi-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="selloi-input"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="selloi-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="selloi-checkbox-row">
              <label className="selloi-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="selloi-checkbox"
                />
                <span>{t.rememberMe}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="selloi-btn-primary"
            >
              <span>{loading ? t.loading : t.submitLogin}</span>
              <ArrowRight size={16} />
            </button>

            <div className="selloi-auth-footer-prompt">
              <span>{t.noAccountPrompt} </span>
              <button
                type="button"
                className="selloi-switch-mode-btn"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                {t.registerLink}
              </button>
            </div>
          </form>
        )}

        {/* Form Mode 2: Register */}
        {mode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="selloi-auth-form">
            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.fullNameLabel}</label>
              <div className="selloi-input-wrapper">
                <UserIcon size={16} className="selloi-input-icon" />
                <input
                  type="text"
                  className="selloi-input"
                  placeholder={t.fullNamePlaceholder}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.emailLabel}</label>
              <div className="selloi-input-wrapper">
                <Mail size={16} className="selloi-input-icon" />
                <input
                  type="email"
                  className="selloi-input"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.passwordLabel}</label>
              <div className="selloi-input-wrapper">
                <Lock size={16} className="selloi-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="selloi-input"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="selloi-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.confirmPasswordLabel}</label>
              <div className="selloi-input-wrapper">
                <Lock size={16} className="selloi-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="selloi-input"
                  placeholder={t.confirmPasswordPlaceholder}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <p className="selloi-terms-text">
              {t.termsAgreement} <a href="#terms">{t.termsLink}</a>
            </p>

            <button
              type="submit"
              disabled={loading}
              className="selloi-btn-primary"
            >
              <span>{loading ? t.loading : t.submitRegister}</span>
              <Check size={16} />
            </button>

            <div className="selloi-auth-footer-prompt">
              <span>{t.haveAccountPrompt} </span>
              <button
                type="button"
                className="selloi-switch-mode-btn"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                {t.loginLink}
              </button>
            </div>
          </form>
        )}

        {/* Form Mode 3: Master Password */}
        {mode === "master" && (
          <form onSubmit={handleMasterSubmit} className="selloi-auth-form">
            <div className="selloi-master-info-box">
              <ShieldCheck size={20} className="text-danger flex-shrink-0" />
              <div>
                <strong>{t.masterPasswordLabel}</strong>
                <p className="small mb-0 text-secondary">{t.masterPasswordHint}</p>
              </div>
            </div>

            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.masterPasswordLabel}</label>
              <div className="selloi-input-wrapper">
                <KeyRound size={16} className="selloi-input-icon" />
                <input
                  type="password"
                  className="selloi-input"
                  placeholder={t.masterPasswordPlaceholder}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="selloi-btn-primary"
              style={{ background: "#E02424" }}
            >
              <span>{loading ? t.loading : t.submitMaster}</span>
              <ArrowRight size={16} />
            </button>

            <div className="selloi-auth-footer-prompt">
              <button
                type="button"
                className="selloi-switch-mode-btn"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                {t.backToHome}
              </button>
            </div>
          </form>
        )}

        {/* Security badge at bottom */}
        <div className="selloi-auth-security-badge">
          <ShieldCheck size={13} />
          <span>{t.sslSecure}</span>
        </div>
      </div>

      {/* Telegram Username / ID Modal */}
      {telegramModalOpen && (
        <div className="selloi-modal-backdrop" onClick={() => setTelegramModalOpen(false)}>
          <div className="selloi-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="selloi-modal-title">{t.telegramModalTitle}</h3>
            <p className="selloi-modal-desc">{t.telegramModalDesc}</p>

            <div className="selloi-input-wrapper mb-4">
              <input
                type="text"
                className="selloi-input"
                placeholder={t.telegramInputPlaceholder}
                value={telegramHandle}
                onChange={(e) => setTelegramHandle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="selloi-modal-btn-row">
              <button
                type="button"
                className="selloi-modal-btn-cancel"
                onClick={() => setTelegramModalOpen(false)}
              >
                {t.telegramCancel}
              </button>
              <button
                type="button"
                className="selloi-modal-btn-confirm"
                onClick={handleTelegramAuth}
              >
                {t.telegramSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
