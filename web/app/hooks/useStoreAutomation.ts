"use client";

import { useCallback, useState } from "react";
import { api, type DashboardTabId, type OrderItem } from "../lib/dashboardApi";
import type { StorePaymentConfigData } from "../components/settings/StorePaymentSettingsCard";
import type { FollowupBundle, FollowupConfigData } from "../components/settings/SmartFollowupSettingsCard";
import type { StoreReportBundle, StoreReportConfigData } from "../components/settings/DailyReportSettingsCard";

interface UseStoreAutomationParams {
  activeOrgId: number;
  selectedConversationId: number | null;
  setTab: (tab: DashboardTabId) => void;
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  loadMessages: (id: number) => Promise<void>;
  setSuccess: (msg: string) => void;
  setError: (msg: string) => void;
  setInfoToast: (msg: string) => void;
}

/**
 * Encapsulates store-level automation features: customer payment links,
 * Smart Follow-up, Daily Telegram Reports, Telegram Bot/Webhook configuration, and AI Playground.
 */
export function useStoreAutomation({
  activeOrgId,
  selectedConversationId,
  setTab,
  setOrders,
  loadMessages,
  setSuccess,
  setError,
  setInfoToast,
}: UseStoreAutomationParams) {
  const [storePaymentConfig, setStorePaymentConfig] = useState<StorePaymentConfigData | null>(null);
  const [followupBundle, setFollowupBundle] = useState<FollowupBundle | null>(null);
  const [reportBundle, setReportBundle] = useState<StoreReportBundle | null>(null);

  const [currentOrgDetails, setCurrentOrgDetails] = useState<any>(null);
  const [botTokenInput, setBotTokenInput] = useState("");
  const [showBotToken, setShowBotToken] = useState(false);
  const [botTokenVerifying, setBotTokenVerifying] = useState(false);
  const [botTokenResult, setBotTokenResult] = useState<any>(null);
  const [customPromptInput, setCustomPromptInput] = useState("");
  const [telegramApiIdInput, setTelegramApiIdInput] = useState("");
  const [telegramApiHashInput, setTelegramApiHashInput] = useState("");
  const [telegramPhoneInput, setTelegramPhoneInput] = useState("");
  const [adminChatIdInput, setAdminChatIdInput] = useState("");
  const [showApiHash, setShowApiHash] = useState(false);
  const [webhookSetting, setWebhookSetting] = useState(false);
  const [webhookStatusChecking, setWebhookStatusChecking] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [savingOrgSettings, setSavingOrgSettings] = useState(false);

  const handleCheckWebhookStatus = async () => {
    setWebhookStatusChecking(true);
    try {
      const res = await api<any>(`/api/organizations/${activeOrgId}/webhook-status`);
      setWebhookInfo(res);
      if (res.configured && res.webhook_info) {
        setSuccess(
          `Webhook holati: ${res.webhook_info.url || "O'rnatilmagan"} (Kutilayotgan: ${
            res.webhook_info.pending_update_count || 0
          })`
        );
      } else if (!res.configured) {
        setError(res.reason || "Bot token sozlanmagan");
      }
    } catch (err: any) {
      setError(err.message || "Webhook holatini tekshirishda xatolik");
    } finally {
      setWebhookStatusChecking(false);
    }
  };

  const handleVerifyBotToken = async () => {
    if (!botTokenInput.trim()) {
      setError("Iltimos, tekshirish uchun Bot Token kiriting");
      return;
    }
    setBotTokenVerifying(true);
    setBotTokenResult(null);
    try {
      const res = await api<any>("/api/organizations/verify-token", {
        method: "POST",
        body: JSON.stringify({ token: botTokenInput.trim() }),
      });
      setBotTokenResult(res);
      if (res.valid) {
        setSuccess(`Bot tasdiqlandi: @${res.bot_username} (${res.bot_name})`);
      } else {
        setError(`Bot token xato: ${res.error || "Noto'g'ri token"}`);
      }
    } catch (err: any) {
      setError(err.message || "Bot tokenni tekshirishda xatolik yuz berdi");
    } finally {
      setBotTokenVerifying(false);
    }
  };

  const handleSaveBotSettings = async () => {
    setSavingOrgSettings(true);
    try {
      const payload: any = {
        custom_system_prompt: customPromptInput,
      };
      if (botTokenInput.trim()) payload.telegram_bot_token = botTokenInput.trim();
      if (telegramApiIdInput.trim()) payload.telegram_api_id = parseInt(telegramApiIdInput.trim(), 10);
      if (telegramApiHashInput.trim()) payload.telegram_api_hash = telegramApiHashInput.trim();
      if (telegramPhoneInput.trim()) payload.telegram_phone = telegramPhoneInput.trim();
      if (adminChatIdInput.trim()) payload.admin_chat_id = adminChatIdInput.trim();

      const res = await api<any>(`/api/organizations/current?organization_id=${activeOrgId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (res.organization) {
        setCurrentOrgDetails(res.organization);
        setSuccess("Bot, Telegram API va AI sozlamalari muvaffaqiyatli saqlandi!");
        setBotTokenInput("");
        setTelegramApiHashInput("");
        setBotTokenResult(null);
      }
    } catch (err: any) {
      setError(err.message || "Sozlamalarni saqlashda xatolik");
    } finally {
      setSavingOrgSettings(false);
    }
  };

  const handleSetWebhook = async () => {
    setWebhookSetting(true);
    try {
      const res = await api<any>(`/api/organizations/${activeOrgId}/set-webhook`, {
        method: "POST",
      });
      setSuccess(`Telegram Webhook muvaffaqiyatli o'rnatildi: ${res.webhook_url}`);
      await handleCheckWebhookStatus();
    } catch (err: any) {
      setError(err.message || "Telegram Webhook o'rnatishda xatolik yuz berdi");
    } finally {
      setWebhookSetting(false);
    }
  };

  const handleRunAiPlayground = useCallback(
    async (payload: {
      message: string;
      history: Array<{ direction: "customer" | "assistant"; text: string }>;
      custom_system_prompt?: string;
      ai_temperature?: number;
      ai_model?: string;
    }) => {
      return api<any>("/admin/ai/playground", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    []
  );

  const handleOpenPlayground = useCallback(() => {
    setTab("settings");
    if (typeof window !== "undefined") {
      setTimeout(() => {
        document.getElementById("ai-playground")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [setTab]);

  const handleSaveStorePaymentConfig = async (payload: {
    provider: string;
    is_enabled: boolean;
    tezcheck_cash_desk_code?: string;
    tezcheck_api_key?: string;
    tezcheck_secret_key?: string;
    click_service_id?: string;
    click_merchant_id?: string;
    payme_merchant_id?: string;
    card_number?: string;
    card_holder?: string;
  }) => {
    try {
      const res = await api<{ ok: boolean; config: StorePaymentConfigData }>("/admin/payments/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (res?.config) setStorePaymentConfig(res.config);
      setSuccess("Mijozlardan to'lov qabul qilish sozlamalari saqlandi!");
    } catch (e: any) {
      setError(e.message || "To'lov sozlamalarini saqlashda xatolik");
      throw e;
    }
  };

  const handleSendOrderPayment = async (orderIdStr: string, amountUzs: number, description?: string) => {
    const rawId = parseInt(orderIdStr.replace("ORD-", ""), 10);
    try {
      const res = await api<any>(`/admin/orders/${rawId}/send-payment`, {
        method: "POST",
        body: JSON.stringify({
          amount_uzs: amountUzs,
          description: description || undefined,
          send_to_telegram: true,
        }),
      });
      const updatedOrders = await api<OrderItem[]>("/admin/orders").catch(() => null);
      if (updatedOrders) setOrders(updatedOrders);
      if (res?.telegram_sent) {
        setSuccess(`Buyurtma ${orderIdStr} uchun to'lov havolasi Telegramga yuborildi!`);
      } else {
        setSuccess(`Buyurtma ${orderIdStr} uchun to'lov havolasi yaratildi (nusxalab yuborishingiz mumkin).`);
      }
      if (selectedConversationId !== null) {
        void loadMessages(selectedConversationId);
      }
      return res;
    } catch (e: any) {
      setError(e.message || "To'lov havolasi yaratishda xatolik");
      throw e;
    }
  };

  const handleSendConversationPayment = async (conversationId: number, amountUzs: number, productSummary: string) => {
    try {
      const res = await api<any>(`/admin/conversations/${conversationId}/send-payment`, {
        method: "POST",
        body: JSON.stringify({
          amount_uzs: amountUzs,
          product_summary: productSummary,
        }),
      });
      if (res?.telegram_sent) {
        setSuccess("To'lov havolasi mijozga Telegram chatida yuborildi!");
      } else {
        setSuccess("Buyurtma va to'lov havolasi yaratildi.");
      }
      await Promise.all([
        api<OrderItem[]>("/admin/orders").then(setOrders).catch(() => {}),
        loadMessages(conversationId),
      ]);
    } catch (e: any) {
      setError(e.message || "To'lov havolasini yuborishda xatolik");
      throw e;
    }
  };

  const handleMarkOrderPaid = async (orderIdStr: string) => {
    const rawId = parseInt(orderIdStr.replace("ORD-", ""), 10);
    try {
      await api(`/admin/orders/${rawId}/mark-paid`, { method: "POST" });
      const updatedOrders = await api<OrderItem[]>("/admin/orders").catch(() => null);
      if (updatedOrders) setOrders(updatedOrders);
      setSuccess(`Buyurtma ${orderIdStr} to'langan (Paid) deb belgilandi!`);
    } catch (e: any) {
      setError(e.message || "To'lovni tasdiqlashda xatolik");
    }
  };

  const handleCheckOrderPayment = async (orderIdStr: string) => {
    const rawId = parseInt(orderIdStr.replace("ORD-", ""), 10);
    try {
      const res = await api<any>(`/admin/orders/${rawId}/payment-check`, { method: "POST" });
      if (res?.paid) {
        const updatedOrders = await api<OrderItem[]>("/admin/orders").catch(() => null);
        if (updatedOrders) setOrders(updatedOrders);
        setSuccess(`Buyurtma ${orderIdStr} bo'yicha to'lov tasdiqlandi!`);
      } else {
        setInfoToast(`Buyurtma ${orderIdStr} to'lovi hali kutilmoqda (${res?.status || "pending"}).`);
      }
    } catch (e: any) {
      setError(e.message || "To'lov holatini tekshirishda xatolik");
    }
  };

  const handleSaveFollowupConfig = async (payload: Partial<FollowupConfigData>) => {
    try {
      await api("/admin/followup/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const updated = await api<FollowupBundle>("/admin/followup/config").catch(() => null);
      if (updated) setFollowupBundle(updated);
      setSuccess("Smart Follow-up qoidalari saqlandi!");
    } catch (e: any) {
      setError(e.message || "Follow-up sozlamalarini saqlashda xatolik");
      throw e;
    }
  };

  const handlePreviewFollowup = async () => {
    return api<any>("/admin/followup/preview", { method: "POST" });
  };

  const handleRunFollowupNow = async () => {
    try {
      const res = await api<any>("/admin/followup/run-now", { method: "POST" });
      const updated = await api<FollowupBundle>("/admin/followup/config").catch(() => null);
      if (updated) setFollowupBundle(updated);
      setSuccess(`${res?.sent_count || 0} ta mijozga Smart Follow-up xabari yuborildi.`);
      return res;
    } catch (e: any) {
      setError(e.message || "Follow-up yuborishda xatolik");
      throw e;
    }
  };

  const handleSaveReportConfig = async (payload: Partial<StoreReportConfigData>) => {
    try {
      await api("/admin/reports/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const updated = await api<StoreReportBundle>("/admin/reports/config").catch(() => null);
      if (updated) setReportBundle(updated);
      setSuccess("Kunlik Telegram hisoboti sozlamalari saqlandi!");
    } catch (e: any) {
      setError(e.message || "Hisobot sozlamalarini saqlashda xatolik");
      throw e;
    }
  };

  const handlePreviewDailyReport = async () => {
    return api<any>("/admin/reports/send-now?dry_run=true", {
      method: "POST",
      body: JSON.stringify({ dry_run: true }),
    });
  };

  const handleSendDailyReportNow = async () => {
    try {
      const res = await api<any>("/admin/reports/send-now", {
        method: "POST",
        body: JSON.stringify({ dry_run: false }),
      });
      const updated = await api<StoreReportBundle>("/admin/reports/config").catch(() => null);
      if (updated) setReportBundle(updated);
      setSuccess(
        res?.sent_count > 0
          ? `Kunlik hisobot ${res.sent_count} ta admin Telegramiga yuborildi.`
          : "Kunlik hisobot tayyorlandi."
      );
      return res;
    } catch (e: any) {
      setError(e.message || "Hisobot yuborishda xatolik");
      throw e;
    }
  };

  return {
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
  };
}
