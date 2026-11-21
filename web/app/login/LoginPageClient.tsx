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

interface LoginPageClientProps {
  initialRedirect: string;
  initialTab?: string;
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
}: LoginPageClientProps) {
  const [lang, setLang] = useState<Language>("uz");
  const [mode, setMode] = useState<AuthMode>(
    initialTab === "register" ? "register" : initialTab === "master" ? "master" : "login"
  );

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
  const [error, setError] = useState<string | null>(null);
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
    setInfoNotice(
      lang === "uz"
        ? "Google OAuth ulanishi tayyorlanmoqda. Hozircha email va parol orqali kirishingiz mumkin."
        : lang === "ru"
        ? "Подключение Google OAuth настраивается. Пожалуйста, используйте email и пароль."
        : "Google OAuth integration in progress. Please sign in with email and password."
    );
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

      {/* Embedded Pixel-Perfect Styles matching Selloi Theme */}
      <style jsx>{`
        .selloi-auth-wrapper {
          min-height: 100vh;
          width: 100%;
          background-color: #0D0D0D;
          color: #F6F6F7;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .selloi-glow-top {
          position: absolute;
          top: -150px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 450px;
          background: radial-gradient(ellipse at center, rgba(255, 76, 99, 0.16) 0%, rgba(255, 76, 99, 0.04) 50%, transparent 75%);
          pointer-events: none;
          z-index: 1;
        }

        .selloi-glow-bottom {
          position: absolute;
          bottom: -100px;
          left: 30%;
          width: 500px;
          height: 350px;
          background: radial-gradient(ellipse at center, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
          pointer-events: none;
          z-index: 1;
        }

        .selloi-auth-topbar {
          width: 100%;
          max-width: 460px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          z-index: 2;
        }

        .selloi-auth-back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #A6A6AF;
          font-size: 0.85rem;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .selloi-auth-back-link:hover {
          color: #FFFFFF;
        }

        .selloi-lang-picker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
          padding: 4px 10px;
          font-size: 0.75rem;
        }

        .selloi-lang-btn {
          background: transparent;
          border: none;
          color: #8E8E93;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          padding: 2px 4px;
          transition: color 0.15s ease;
        }

        .selloi-lang-btn.active {
          color: #FF4C63;
        }

        .selloi-lang-divider {
          color: rgba(255, 255, 255, 0.2);
        }

        .selloi-auth-card {
          width: 100%;
          max-width: 460px;
          background: rgba(21, 21, 22, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          padding: 34px 30px;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 1px rgba(255, 255, 255, 0.15) inset;
          z-index: 2;
          position: relative;
        }

        .selloi-auth-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .selloi-auth-logo-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .selloi-auth-logo-img {
          width: 38px;
          height: 38px;
          object-fit: contain;
        }

        .selloi-auth-brand-name {
          font-size: 1.6rem;
          font-weight: 700;
          color: #F6F6F7;
          letter-spacing: -0.02em;
        }

        .selloi-auth-subtitle {
          color: #A6A6AF;
          font-size: 0.85rem;
          margin-top: 6px;
          margin-bottom: 0;
        }

        .selloi-auth-tabs {
          display: flex;
          background: #19191C;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 20px;
          gap: 4px;
        }

        .selloi-tab-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #A6A6AF;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .selloi-tab-btn.active {
          background: rgba(255, 255, 255, 0.1);
          color: #FFFFFF;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .selloi-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 0.82rem;
          margin-bottom: 18px;
        }

        .selloi-alert-danger {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #FCA5A5;
        }

        .selloi-alert-info {
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #93C5FD;
        }

        .selloi-social-auth-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 18px;
        }

        .selloi-social-btn {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: #F6F6F7;
        }

        .selloi-social-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.22);
          transform: translateY(-1px);
        }

        .selloi-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 10px 0;
          color: #6E6E77;
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .selloi-divider::before,
        .selloi-divider::after {
          content: "";
          flex: 1;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .selloi-divider span {
          padding: 0 12px;
        }

        .selloi-auth-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .selloi-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .selloi-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .selloi-form-label {
          color: #A6A6AF;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .selloi-forgot-link {
          background: transparent;
          border: none;
          color: #FF4C63;
          font-size: 0.78rem;
          cursor: pointer;
          padding: 0;
          transition: opacity 0.2s ease;
        }

        .selloi-forgot-link:hover {
          opacity: 0.85;
          text-decoration: underline;
        }

        .selloi-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .selloi-input-icon {
          position: absolute;
          left: 14px;
          color: #6E6E77;
          pointer-events: none;
        }

        .selloi-input {
          width: 100%;
          background: #1A1A1D;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #FFFFFF;
          border-radius: 12px;
          padding: 11px 40px 11px 40px;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          outline: none;
        }

        .selloi-input:focus {
          border-color: #FF4C63;
          box-shadow: 0 0 0 3px rgba(255, 76, 99, 0.2);
          background: #202024;
        }

        .selloi-input::placeholder {
          color: #55555C;
        }

        .selloi-eye-btn {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #71717A;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .selloi-eye-btn:hover {
          color: #A1A1AA;
        }

        .selloi-checkbox-row {
          display: flex;
          align-items: center;
          margin-top: -2px;
        }

        .selloi-checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #A6A6AF;
          font-size: 0.82rem;
          cursor: pointer;
          user-select: none;
        }

        .selloi-checkbox {
          accent-color: #FF4C63;
          width: 15px;
          height: 15px;
          cursor: pointer;
        }

        .selloi-terms-text {
          font-size: 0.75rem;
          color: #71717A;
          line-height: 1.4;
          margin: 0;
        }

        .selloi-terms-text a {
          color: #A1A1AA;
          text-decoration: underline;
        }

        .selloi-btn-primary {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #FF4C63;
          color: #FFFFFF;
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(255, 76, 99, 0.35);
          margin-top: 4px;
        }

        .selloi-btn-primary:hover:not(:disabled) {
          background: #FF334D;
          box-shadow: 0 6px 22px rgba(255, 76, 99, 0.5);
          transform: translateY(-1px);
        }

        .selloi-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .selloi-auth-footer-prompt {
          text-align: center;
          font-size: 0.82rem;
          color: #8E8E93;
          margin-top: 8px;
        }

        .selloi-switch-mode-btn {
          background: transparent;
          border: none;
          color: #FF4C63;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: opacity 0.2s ease;
        }

        .selloi-switch-mode-btn:hover {
          text-decoration: underline;
        }

        .selloi-master-info-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          margin-bottom: 4px;
          color: #F87171;
        }

        .selloi-auth-security-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 24px;
          color: #6E6E77;
          font-size: 0.72rem;
          letter-spacing: 0.01em;
        }

        /* Modal Styles */
        .selloi-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }

        .selloi-modal-content {
          width: 100%;
          max-width: 400px;
          background: #161618;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
        }

        .selloi-modal-title {
          font-size: 1.15rem;
          font-weight: 700;
          margin-bottom: 8px;
          color: #FFFFFF;
        }

        .selloi-modal-desc {
          font-size: 0.85rem;
          color: #A6A6AF;
          margin-bottom: 16px;
          line-height: 1.4;
        }

        .selloi-modal-btn-row {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .selloi-modal-btn-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #A6A6AF;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 0.84rem;
          cursor: pointer;
        }

        .selloi-modal-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #FFFFFF;
        }

        .selloi-modal-btn-confirm {
          background: #0088CC;
          border: none;
          color: #FFFFFF;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
        }

        .selloi-modal-btn-confirm:hover {
          background: #0077B5;
        }
      `}</style>
    </div>
  );
}
