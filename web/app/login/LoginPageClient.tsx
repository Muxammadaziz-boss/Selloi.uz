"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconWorld,
  IconLoader2,
  IconLock,
  IconMail,
  IconSend,
  IconShieldCheck,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import "./login.css";

interface LoginPageClientProps {
  initialRedirect: string;
  initialTab?: string;
  initialError?: string;
}

type AuthMode = "login" | "register";
type Language = "uz" | "ru" | "en";

interface TranslationText {
  brandSubtitle: string;
  tabLogin: string;
  tabRegister: string;
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
  rememberMe: string;
  forgotPassword: string;
  submitLogin: string;
  submitRegister: string;
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
  telegramOpenBot: string;
  telegramWaiting: string;
  telegramSuccess: string;
  telegramCancel: string;
  passwordsDoNotMatch: string;
  forgotPasswordNotice: string;
  resetModalTitle: string;
  resetStep1Desc: string;
  resetStep2Desc: string;
  resetSendCodeBtn: string;
  resetSending: string;
  resetCodeLabel: string;
  resetCodePlaceholder: string;
  resetNewPasswordLabel: string;
  resetSubmitBtn: string;
  resetSubmitting: string;
  resetBackStep: string;
  resetSentNotice: string;
  resetSuccessNotice: string;
  verifyModalTitle: string;
  verifyModalDesc: string;
  verifyCodeLabel: string;
  verifySubmitBtn: string;
  verifySubmitting: string;
  verifyResendBtn: string;
  verifyResentNotice: string;
  verifySuccessNotice: string;
}

const TRANSLATIONS: Record<Language, TranslationText> = {
  uz: {
    brandSubtitle: "Sun'iy intellekt asosidagi savdo ekotizimi",
    tabLogin: "Kirish",
    tabRegister: "Ro'yxatdan o'tish",
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
    rememberMe: "Eslab qolish",
    forgotPassword: "Parolni unutdingizmi?",
    submitLogin: "Tizimga kirish",
    submitRegister: "Hisob yaratish",
    loading: "Tekshirilmoqda...",
    noAccountPrompt: "Hali akkauntingiz yo'qmi?",
    registerLink: "Ro'yxatdan o'tish",
    haveAccountPrompt: "Hisobingiz bormi?",
    loginLink: "Kirish",
    termsAgreement: "Ro'yxatdan o'tish orqali siz Selloi",
    termsLink: "Foydalanish shartlariga rozilik bildirasiz.",
    backToHome: "Bosh sahifa",
    sslSecure: "256-bit SSL xavfsiz shifrlash orqali himoyalangan",
    telegramModalTitle: "Telegram orqali xavfsiz kirish",
    telegramModalDesc: "Telegram hisobingiz orqali tizimga kirish uchun @Selloi_ai_bot botimizni oching va pastdagi 'Boshlash' (/start) tugmasini bosing:",
    telegramOpenBot: "@Selloi_ai_bot da tasdiqlash",
    telegramWaiting: "Telegram botingizdan tasdiqlash kutilmoqda...",
    telegramSuccess: "Tasdiqlandi! Boshqaruv paneliga o'tilmoqda...",
    telegramCancel: "Bekor qilish",
    passwordsDoNotMatch: "Kiritilgan parollar bir-biriga mos kelmadi",
    forgotPasswordNotice: "Parolni tiklash uchun email manzilingizni kiriting.",
    resetModalTitle: "Parolni tiklash",
    resetStep1Desc: "Hisobingiz email manzilini kiriting. 6 xonali tasdiqlash kodi Telegram botingizga yoki email pochtangizga yuboriladi.",
    resetStep2Desc: "Telegram yoki email pochtangizga kelgan 6 xonali kodni va yangi parolingizni kiriting.",
    resetSendCodeBtn: "Tasdiqlash kodini yuborish",
    resetSending: "Yuborilmoqda...",
    resetCodeLabel: "6 xonali tasdiqlash kodi",
    resetCodePlaceholder: "123456",
    resetNewPasswordLabel: "Yangi parol",
    resetSubmitBtn: "Parolni yangilash",
    resetSubmitting: "Yangilanmoqda...",
    resetBackStep: "Emailni o'zgartirish",
    resetSentNotice: "Agar hisobingiz mavjud bo'lsa, 6 xonali tasdiqlash kodi Telegram yoki email pochtangizga yuborildi.",
    resetSuccessNotice: "Parol muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin.",
    verifyModalTitle: "Email manzilni tasdiqlash",
    verifyModalDesc: "Pochtangizga yuborilgan 6 xonali tasdiqlash kodini kiriting:",
    verifyCodeLabel: "6 xonali email kodi",
    verifySubmitBtn: "Tasdiqlash va kirish",
    verifySubmitting: "Tekshirilmoqda...",
    verifyResendBtn: "Kodni qayta yuborish",
    verifyResentNotice: "Yangi tasdiqlash kodi emailingizga yuborildi.",
    verifySuccessNotice: "Emailingiz tasdiqlandi! Tizimga yo'naltirilmoqda...",
  },
  ru: {
    brandSubtitle: "Экосистема продаж на базе искусственного интеллекта",
    tabLogin: "Войти",
    tabRegister: "Регистрация",
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
    rememberMe: "Запомнить меня",
    forgotPassword: "Забыли пароль?",
    submitLogin: "Войти в систему",
    submitRegister: "Создать аккаунт",
    loading: "Проверка...",
    noAccountPrompt: "Еще нет аккаунта?",
    registerLink: "Зарегистрироваться",
    haveAccountPrompt: "Уже есть аккаунт?",
    loginLink: "Войти",
    termsAgreement: "Регистрируясь, вы принимаете",
    termsLink: "Условия использования Selloi.",
    backToHome: "На главную",
    sslSecure: "Защищено 256-битным SSL шифрованием",
    telegramModalTitle: "Безопасный вход через Telegram",
    telegramModalDesc: "Чтобы войти через свой аккаунт Telegram, откройте нашего бота @Selloi_ai_bot и нажмите кнопку «Запустить» (/start):",
    telegramOpenBot: "Подтвердить в @Selloi_ai_bot",
    telegramWaiting: "Ожидание подтверждения из бота...",
    telegramSuccess: "Подтверждено! Переход в панель управления...",
    telegramCancel: "Отмена",
    passwordsDoNotMatch: "Пароли не совпадают",
    forgotPasswordNotice: "Введите ваш email для восстановления пароля.",
    resetModalTitle: "Восстановление пароля",
    resetStep1Desc: "Введите email аккаунта. 6-значный код подтверждения будет отправлен в Telegram-бот или на email.",
    resetStep2Desc: "Введите 6-значный код из Telegram или email и новый пароль.",
    resetSendCodeBtn: "Отправить код",
    resetSending: "Отправка...",
    resetCodeLabel: "6-значный код подтверждения",
    resetCodePlaceholder: "123456",
    resetNewPasswordLabel: "Новый пароль",
    resetSubmitBtn: "Обновить пароль",
    resetSubmitting: "Обновление...",
    resetBackStep: "Изменить email",
    resetSentNotice: "Если аккаунт существует, 6-значный код отправлен в Telegram или на вашу почту.",
    resetSuccessNotice: "Пароль успешно обновлен! Теперь войдите с новым паролем.",
    verifyModalTitle: "Подтверждение Email",
    verifyModalDesc: "Введите 6-значный код подтверждения, отправленный на вашу почту:",
    verifyCodeLabel: "6-значный код из email",
    verifySubmitBtn: "Подтвердить и войти",
    verifySubmitting: "Проверка...",
    verifyResendBtn: "Отправить код повторно",
    verifyResentNotice: "Новый код подтверждения отправлен на ваш email.",
    verifySuccessNotice: "Email подтвержден! Переход в панель управления...",
  },
  en: {
    brandSubtitle: "AI-Powered Sales Automation Ecosystem",
    tabLogin: "Sign In",
    tabRegister: "Create Account",
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
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    submitLogin: "Sign In",
    submitRegister: "Get Started",
    loading: "Verifying...",
    noAccountPrompt: "Don't have an account?",
    registerLink: "Sign up",
    haveAccountPrompt: "Already have an account?",
    loginLink: "Sign In",
    termsAgreement: "By signing up you agree to Selloi's",
    termsLink: "Terms of Service and Privacy Policy.",
    backToHome: "Back to Home",
    sslSecure: "Protected by 256-bit SSL encryption",
    telegramModalTitle: "Secure Telegram Login",
    telegramModalDesc: "To sign in with your Telegram account, open our bot @Selloi_ai_bot and tap 'Start':",
    telegramOpenBot: "Confirm in @Selloi_ai_bot",
    telegramWaiting: "Waiting for confirmation from bot...",
    telegramSuccess: "Confirmed! Redirecting to dashboard...",
    telegramCancel: "Cancel",
    passwordsDoNotMatch: "Passwords do not match",
    forgotPasswordNotice: "Enter your email address to reset your password.",
    resetModalTitle: "Reset Password",
    resetStep1Desc: "Enter your account email. A 6-digit verification code will be sent via Telegram or email.",
    resetStep2Desc: "Enter the 6-digit code received via Telegram or email along with your new password.",
    resetSendCodeBtn: "Send Verification Code",
    resetSending: "Sending...",
    resetCodeLabel: "6-digit verification code",
    resetCodePlaceholder: "123456",
    resetNewPasswordLabel: "New password",
    resetSubmitBtn: "Update Password",
    resetSubmitting: "Updating...",
    resetBackStep: "Change email",
    resetSentNotice: "If your account exists, a 6-digit verification code has been sent via Telegram or email.",
    resetSuccessNotice: "Password updated successfully! You can now sign in with your new password.",
    verifyModalTitle: "Verify Email Address",
    verifyModalDesc: "Enter the 6-digit verification code sent to your inbox:",
    verifyCodeLabel: "6-digit email code",
    verifySubmitBtn: "Verify & Sign In",
    verifySubmitting: "Verifying...",
    verifyResendBtn: "Resend code",
    verifyResentNotice: "A fresh verification code has been sent to your email.",
    verifySuccessNotice: "Email verified! Redirecting to dashboard...",
  },
};

export default function LoginPageClient({
  initialRedirect,
  initialTab,
  initialError,
}: LoginPageClientProps) {
  const [lang, setLang] = useState<Language>("uz");
  const [mode, setMode] = useState<AuthMode>(
    initialTab === "register" ? "register" : "login"
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // UI status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(getInitialErrorText(initialError));
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Telegram verification modal state
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramSessionCode, setTelegramSessionCode] = useState<string>("");
  const [telegramBotUrl, setTelegramBotUrl] = useState<string>("");
  const [telegramInitLoading, setTelegramInitLoading] = useState(false);
  const [telegramAuthSuccess, setTelegramAuthSuccess] = useState(false);

  // Forgot password modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  // Email verification modal state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null);

  const t = TRANSLATIONS[lang];

  const resolvePostLoginDestination = (data: any): string => {
    const isPlatformStaff = Boolean(data?.user?.isPlatformOwner || data?.user?.isPlatformAdmin);
    const safeRedirect =
      initialRedirect &&
      initialRedirect.trim().startsWith("/") &&
      !initialRedirect.trim().startsWith("//")
        ? initialRedirect.trim()
        : "";
    if (isPlatformStaff) {
      if (
        safeRedirect.startsWith("/admin") ||
        safeRedirect.startsWith("/platform") ||
        safeRedirect.startsWith("/t/")
      ) {
        return safeRedirect;
      }
      return "/admin";
    }
    if (safeRedirect && !safeRedirect.startsWith("/admin") && !safeRedirect.startsWith("/platform")) {
      return safeRedirect;
    }
    return data?.redirect || "/dashboard";
  };

  useEffect(() => {
    if (!telegramModalOpen || !telegramSessionCode || telegramAuthSuccess) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll", code: telegramSessionCode }),
        });
        const data = await res.json();
        if (isSubscribed && data.verified) {
          setTelegramAuthSuccess(true);
          clearInterval(interval);
          setTimeout(() => {
            window.location.href = resolvePostLoginDestination(data);
          }, 800);
        } else if (isSubscribed && res.status === 404) {
          setError(data.detail || "Sessiya muddati tugadi. Iltimos, qaytadan urinib ko'ring.");
          setTelegramModalOpen(false);
          clearInterval(interval);
        }
      } catch {
        // Continue polling
      }
    }, 1800);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [telegramModalOpen, telegramSessionCode, telegramAuthSuccess, initialRedirect]);

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
        const errPayload = data?.detail && typeof data.detail === "object" ? data.detail : data;
        if (res.status === 403 && errPayload?.error === "EMAIL_NOT_VERIFIED") {
          setVerifyEmail((errPayload.email || email).trim().toLowerCase());
          setVerifyCode("");
          setVerifyError(null);
          setVerifyInfo(null);
          setVerifyModalOpen(true);
          setLoading(false);
          return;
        }
        setError(
          typeof data?.detail === "string"
            ? data.detail
            : errPayload?.message || "Email yoki parol noto'g'ri"
        );
        setLoading(false);
        return;
      }

      window.location.href = resolvePostLoginDestination(data);
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

      if (data.verification_required) {
        setVerifyEmail((data.email || email).trim().toLowerCase());
        setVerifyCode("");
        setVerifyError(null);
        setVerifyInfo(null);
        setVerifyModalOpen(true);
        setLoading(false);
        return;
      }

      window.location.href = resolvePostLoginDestination(data);
    } catch (err: any) {
      setError("Tarmoq xatosi: " + err.message);
      setLoading(false);
    }
  };

  const openTelegramModal = async () => {
    setError(null);
    setInfoNotice(null);
    setTelegramAuthSuccess(false);
    setTelegramModalOpen(true);
    setTelegramInitLoading(true);

    try {
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Telegram avtorizatsiya sessiyasini yaratishda xatolik");
        setTelegramModalOpen(false);
        return;
      }

      setTelegramSessionCode(data.code);
      setTelegramBotUrl(data.bot_url);
    } catch (err: any) {
      setError("Tarmoq xatosi: " + err.message);
      setTelegramModalOpen(false);
    } finally {
      setTelegramInitLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    setError(null);
    setInfoNotice(null);
    setSuccessNotice(null);
    setLoading(true);
    window.location.href = "/api/auth/google";
  };

  const openResetModal = () => {
    setError(null);
    setInfoNotice(null);
    setSuccessNotice(null);
    setResetError(null);
    setResetInfo(null);
    setResetEmail(email.trim().toLowerCase());
    setResetCode("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetStep(1);
    setResetModalOpen(true);
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetInfo(null);
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setResetError(t.emailPlaceholder);
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetError(data.detail || "Kod yuborishda xatolik yuz berdi");
        setResetLoading(false);
        return;
      }
      setResetEmail(cleanEmail);
      setResetInfo(t.resetSentNotice);
      setResetStep(2);
    } catch (err: any) {
      setResetError("Tarmoq xatosi: " + err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError(t.passwordsDoNotMatch);
      return;
    }
    if (resetNewPassword.length < 6) {
      setResetError(t.passwordPlaceholder);
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          code: resetCode.trim(),
          new_password: resetNewPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetError(data.detail || "Parolni yangilashda xatolik yuz berdi");
        setResetLoading(false);
        return;
      }
      setEmail(resetEmail.trim().toLowerCase());
      setPassword("");
      setResetModalOpen(false);
      setSuccessNotice(t.resetSuccessNotice);
    } catch (err: any) {
      setResetError("Tarmoq xatosi: " + err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verifyEmail.trim().toLowerCase(),
          code: verifyCode.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerifyError(typeof data.detail === "string" ? data.detail : "Tasdiqlash kodi noto'g'ri");
        setVerifyLoading(false);
        return;
      }
      setVerifyInfo(t.verifySuccessNotice);
      setTimeout(() => {
        window.location.href = resolvePostLoginDestination(data);
      }, 600);
    } catch (err: any) {
      setVerifyError("Tarmoq xatosi: " + err.message);
      setVerifyLoading(false);
    }
  };

  const handleResendVerificationCode = async () => {
    if (!verifyEmail.trim()) return;
    setVerifyResending(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerifyError(data.detail || "Kod yuborishda xatolik yuz berdi");
        return;
      }
      setVerifyInfo(t.verifyResentNotice);
    } catch (err: any) {
      setVerifyError("Tarmoq xatosi: " + err.message);
    } finally {
      setVerifyResending(false);
    }
  };

  return (
    <div className="selloi-auth-wrapper">
      {/* Ambient background glows */}
      <div className="selloi-glow-top" aria-hidden="true" />
      <div className="selloi-glow-bottom" aria-hidden="true" />

      {/* Top Bar: Home link + Language Switcher */}
      <div className="selloi-auth-topbar">
        <Link href="/" className="selloi-auth-back-link">
          <IconArrowLeft size={16} />
          <span>{t.backToHome}</span>
        </Link>

        <div className="selloi-lang-picker">
          <IconWorld size={15} className="text-secondary" />
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
        </div>

        {/* Error and Info Notices */}
        {error && (
          <div className="selloi-alert selloi-alert-danger">
            <IconAlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoNotice && (
          <div className="selloi-alert selloi-alert-info">
            <IconSparkles size={16} className="flex-shrink-0" />
            <span>{infoNotice}</span>
          </div>
        )}

        {successNotice && (
          <div className="selloi-alert selloi-alert-success">
            <IconCheck size={16} className="flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Third-Party Fast Auth Options (Shown on Login & Register) */}
        <div className="selloi-social-auth-section">
            <button
              type="button"
              className="selloi-social-btn selloi-tg-btn"
              onClick={openTelegramModal}
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

        {/* Form Mode 1: Login */}
        {mode === "login" && (
          <form onSubmit={handleLoginSubmit} className="selloi-auth-form">
            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.emailLabel}</label>
              <div className="selloi-input-wrapper">
                <IconMail size={16} className="selloi-input-icon" />
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
                  onClick={openResetModal}
                >
                  {t.forgotPassword}
                </button>
              </div>
              <div className="selloi-input-wrapper">
                <IconLock size={16} className="selloi-input-icon" />
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
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
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
              <IconArrowRight size={16} />
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
                <IconUser size={16} className="selloi-input-icon" />
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
                <IconMail size={16} className="selloi-input-icon" />
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
                <IconLock size={16} className="selloi-input-icon" />
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
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            <div className="selloi-form-group">
              <label className="selloi-form-label">{t.confirmPasswordLabel}</label>
              <div className="selloi-input-wrapper">
                <IconLock size={16} className="selloi-input-icon" />
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
              <IconCheck size={16} />
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

        {/* Security badge at bottom */}
        <div className="selloi-auth-security-badge">
          <IconShieldCheck size={13} />
          <span>{t.sslSecure}</span>
        </div>

        {/* Legal links for compliance */}
        <div style={{ marginTop: "14px", fontSize: "0.78rem", color: "#8E8E93", textAlign: "center", lineHeight: "1.5" }}>
          <span>Davom etish orqali siz Selloi'ning </span>
          <Link href="/terms" style={{ color: "#FF4C63", textDecoration: "none", fontWeight: 600 }}>Foydalanish shartlari</Link>
          <span> va </span>
          <Link href="/privacy" style={{ color: "#FF4C63", textDecoration: "none", fontWeight: 600 }}>Maxfiylik siyosati</Link>
          <span>ga rozilik bildirasiz.</span>
        </div>
      </div>

      {/* Telegram Verified Authentication Modal */}
      {telegramModalOpen && (
        <div className="selloi-modal-backdrop" onClick={() => setTelegramModalOpen(false)}>
          <div className="selloi-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <div className="d-flex align-items-center justify-content-center mb-3">
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(0, 136, 204, 0.15)",
                  border: "1px solid rgba(0, 136, 204, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0088CC",
                }}
              >
                <IconSend size={26} />
              </div>
            </div>

            <h3 className="selloi-modal-title text-center mb-2">{t.telegramModalTitle}</h3>
            <p className="selloi-modal-desc text-center mb-4">{t.telegramModalDesc}</p>

            <div className="d-flex flex-column gap-3 mb-4">
              {telegramInitLoading ? (
                <div className="d-flex align-items-center justify-content-center gap-2 py-3 text-secondary small">
                  <IconLoader2 size={18} className="spin text-primary" />
                  <span>Xavfsiz sessiya yaratilmoqda...</span>
                </div>
              ) : telegramBotUrl ? (
                <>
                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="selloi-modal-btn-confirm d-inline-flex align-items-center justify-content-center gap-2 w-100 text-decoration-none py-2.5 px-4"
                    style={{ fontSize: "0.95rem" }}
                  >
                    <IconSend size={18} />
                    <span>{t.telegramOpenBot}</span>
                  </a>

                  <div className="d-flex align-items-center justify-content-center gap-2 text-secondary small py-1">
                    {telegramAuthSuccess ? (
                      <span className="text-success fw-bold d-flex align-items-center gap-1.5">
                        <IconCheck size={16} />
                        <span>{t.telegramSuccess}</span>
                      </span>
                    ) : (
                      <>
                        <IconLoader2 size={15} className="spin text-primary" />
                        <span>{t.telegramWaiting}</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-danger small text-center">
                  Xatolik: Bot bilan bog'lanishda muammo yuz berdi.
                </div>
              )}
            </div>

            <div className="selloi-modal-btn-row">
              <button
                type="button"
                className="selloi-modal-btn-cancel w-100"
                onClick={() => setTelegramModalOpen(false)}
              >
                <span>{t.telegramCancel}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal via Telegram OTP */}
      {resetModalOpen && (
        <div className="selloi-modal-backdrop" onClick={() => setResetModalOpen(false)}>
          <div className="selloi-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "430px" }}>
            <div className="selloi-modal-emblem">
              <IconLock size={22} />
            </div>
            <h3 className="selloi-modal-title">{t.resetModalTitle}</h3>
            <p className="selloi-modal-desc">
              {resetStep === 1 ? t.resetStep1Desc : t.resetStep2Desc}
            </p>

            {resetError && (
              <div className="selloi-alert selloi-alert-danger">
                <IconAlertCircle size={16} className="flex-shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {resetInfo && (
              <div className="selloi-alert selloi-alert-info">
                <IconSparkles size={16} className="flex-shrink-0" />
                <span>{resetInfo}</span>
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleForgotPasswordRequest} className="selloi-auth-form">
                <div className="selloi-form-group">
                  <label className="selloi-form-label">{t.emailLabel}</label>
                  <div className="selloi-input-wrapper">
                    <IconMail size={16} className="selloi-input-icon" />
                    <input
                      type="email"
                      className="selloi-input"
                      placeholder={t.emailPlaceholder}
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="selloi-modal-btn-row" style={{ marginTop: "6px" }}>
                  <button
                    type="button"
                    className="selloi-modal-btn-cancel"
                    onClick={() => setResetModalOpen(false)}
                  >
                    <span>{t.telegramCancel}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="selloi-modal-btn-confirm"
                  >
                    <span>{resetLoading ? t.resetSending : t.resetSendCodeBtn}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="selloi-auth-form">
                <div className="selloi-form-group">
                  <label className="selloi-form-label">{t.resetCodeLabel}</label>
                  <div className="selloi-input-wrapper">
                    <IconShieldCheck size={16} className="selloi-input-icon" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="selloi-input"
                      placeholder={t.resetCodePlaceholder}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="selloi-form-group">
                  <label className="selloi-form-label">{t.resetNewPasswordLabel}</label>
                  <div className="selloi-input-wrapper">
                    <IconLock size={16} className="selloi-input-icon" />
                    <input
                      type="password"
                      className="selloi-input"
                      placeholder={t.passwordPlaceholder}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="selloi-form-group">
                  <label className="selloi-form-label">{t.confirmPasswordLabel}</label>
                  <div className="selloi-input-wrapper">
                    <IconLock size={16} className="selloi-input-icon" />
                    <input
                      type="password"
                      className="selloi-input"
                      placeholder={t.confirmPasswordPlaceholder}
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end">
                  <button
                    type="button"
                    className="selloi-forgot-link"
                    onClick={() => {
                      setResetStep(1);
                      setResetError(null);
                      setResetInfo(null);
                    }}
                  >
                    {t.resetBackStep}
                  </button>
                </div>

                <div className="selloi-modal-btn-row">
                  <button
                    type="button"
                    className="selloi-modal-btn-cancel"
                    onClick={() => setResetModalOpen(false)}
                  >
                    <span>{t.telegramCancel}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="selloi-modal-btn-confirm"
                  >
                    <span>{resetLoading ? t.resetSubmitting : t.resetSubmitBtn}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Email Verification OTP Modal */}
      {verifyModalOpen && (
        <div className="selloi-modal-backdrop" onClick={() => setVerifyModalOpen(false)}>
          <div className="selloi-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "430px" }}>
            <div className="selloi-modal-emblem">
              <IconMail size={22} />
            </div>
            <h3 className="selloi-modal-title">{t.verifyModalTitle}</h3>
            <p className="selloi-modal-desc">
              {t.verifyModalDesc}
              {verifyEmail && (
                <>
                  <br />
                  <span className="selloi-email-pill">{verifyEmail}</span>
                </>
              )}
            </p>

            {verifyError && (
              <div className="selloi-alert selloi-alert-danger" role="alert" style={{ marginBottom: "14px" }}>
                <IconAlertCircle size={16} className="flex-shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}
            {verifyInfo && (
              <div className="selloi-alert selloi-alert-info" role="status" style={{ marginBottom: "14px" }}>
                <IconCheck size={16} className="flex-shrink-0" />
                <span>{verifyInfo}</span>
              </div>
            )}

            <form onSubmit={handleVerifyEmailSubmit} className="selloi-auth-form">
              <div className="selloi-form-group">
                <div className="selloi-label-row">
                  <label className="selloi-form-label">{t.verifyCodeLabel}</label>
                  <button
                    type="button"
                    disabled={verifyResending}
                    className="selloi-forgot-link"
                    onClick={handleResendVerificationCode}
                  >
                    {verifyResending ? t.resetSending : t.verifyResendBtn}
                  </button>
                </div>
                <div className="selloi-input-wrapper">
                  <IconShieldCheck size={16} className="selloi-input-icon" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="selloi-input selloi-otp-input"
                    placeholder={t.resetCodePlaceholder}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="selloi-modal-btn-row">
                <button
                  type="button"
                  className="selloi-modal-btn-cancel"
                  onClick={() => setVerifyModalOpen(false)}
                >
                  <span>{t.telegramCancel}</span>
                </button>
                <button
                  type="submit"
                  disabled={verifyLoading || verifyCode.trim().length !== 6}
                  className="selloi-modal-btn-confirm"
                >
                  <span>{verifyLoading ? t.verifySubmitting : t.verifySubmitBtn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
