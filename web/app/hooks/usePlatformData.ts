"use client";

import { useCallback, useState } from "react";
import {
  api,
  type DashboardTabId,
  type PendingConfirmState,
  type PlatformSubTabId,
} from "../lib/dashboardApi";

interface UsePlatformDataParams {
  zone: "platform" | "tenant";
  activeOrgId: number;
  setActiveOrgId: (id: number) => void;
  setZone: (zone: "platform" | "tenant") => void;
  setTab: (tab: DashboardTabId) => void;
  setLoading: (v: boolean) => void;
  setBusy: (v: boolean) => void;
  setSuccess: (msg: string) => void;
  setError: (msg: string) => void;
  setActiveStoreMeta: (meta: { id: number; name: string; slug: string } | null) => void;
  setIsOwnerImpersonating: (v: boolean) => void;
  setPendingConfirm: (state: PendingConfirmState | null) => void;
  loadStoreData: () => Promise<void>;
  loadSaaSData: (orgId?: number) => Promise<void>;
}

/**
 * Encapsulates Platform Owner / Site Admin state, tenant portfolio CRUD,
 * user/admin appointments, broadcasts, and daily platform reports.
 */
export function usePlatformData({
  zone,
  activeOrgId,
  setActiveOrgId,
  setZone,
  setTab,
  setLoading,
  setBusy,
  setSuccess,
  setError,
  setActiveStoreMeta,
  setIsOwnerImpersonating,
  setPendingConfirm,
  loadStoreData,
  loadSaaSData,
}: UsePlatformDataParams) {
  const [platformMetrics, setPlatformMetrics] = useState<any>(null);
  const [platformOrgs, setPlatformOrgs] = useState<any[]>([]);
  const [platformUsers, setPlatformUsers] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [platformSubTab, setPlatformSubTab] = useState<PlatformSubTabId>("overview");

  const loadPlatformData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, o, u, h, a] = await Promise.all([
        api<any>("/api/platform/metrics").catch(() => null),
        api<any>("/api/platform/organizations").catch(() => ({ organizations: [] })),
        api<any>("/api/platform/users").catch(() => ({ users: [] })),
        api<any>("/api/platform/system-health").catch(() => null),
        api<any>("/api/platform/audit-logs").catch(() => ({ logs: [] })),
      ]);
      if (m) setPlatformMetrics(m);
      if (o?.organizations) setPlatformOrgs(o.organizations);
      if (u?.users) setPlatformUsers(u.users);
      if (h) setSystemHealth(h);
      if (a?.logs) setAuditLogs(a.logs);
    } catch (e) {
      console.error("loadPlatformData error:", e);
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  const handleUpdatePlanConfig = async (planCode: string, payload: any) => {
    setBusy(true);
    try {
      await api(`/api/platform/plans/${planCode}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSuccess(`${planCode.toUpperCase()} tarifi parametrlari yangilandi!`);
      if (zone === "platform") {
        await loadPlatformData();
      } else {
        await loadSaaSData(activeOrgId);
      }
    } catch (err: any) {
      setError(err.message || "Tarifni tahrirlashda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const handleEnterStore = async (store: any) => {
    setBusy(true);
    try {
      await api(`/api/platform/organizations/${store.slug}/impersonate`, { method: "POST" });
      const meta = { id: store.id, name: store.name, slug: store.slug };
      if (typeof window !== "undefined") {
        sessionStorage.setItem("active_org_id", String(store.id));
        localStorage.setItem("active_org_id", String(store.id));
        localStorage.setItem("owner_impersonating_store", JSON.stringify(meta));
        window.history.pushState(null, "", `/t/${store.slug}`);
      }
      setActiveOrgId(store.id);
      setActiveStoreMeta(meta);
      setIsOwnerImpersonating(true);
      setZone("tenant");
      setTab("overview");
      setSuccess(`"${store.name}" do'koniga muvaffaqiyatli kirildi!`);
      await loadStoreData();
      await loadSaaSData(store.id);
    } catch (err: any) {
      setError(err.message || "Do'konga kirishda xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const handleExitStore = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("owner_impersonating_store");
      window.history.pushState(null, "", "/admin");
    }
    setIsOwnerImpersonating(false);
    setActiveStoreMeta(null);
    setZone("platform");
    setPlatformSubTab("stores");
    setSuccess("Admin panelga qaytildi.");
    void loadPlatformData();
  };

  const handleAppointSiteAdmin = async (email: string, fullName?: string) => {
    setBusy(true);
    try {
      await api("/api/platform/site-admins", {
        method: "POST",
        body: JSON.stringify({ email, full_name: fullName || "" }),
      });
      setSuccess(`${email} Sayt Admini sifatida tayinlandi!`);
      await loadPlatformData();
    } catch (err: any) {
      setError(err.message || "Sayt adminini tayinlashda xatolik");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSiteAdmin = async (userId: number, makeAdmin: boolean) => {
    setBusy(true);
    try {
      await api(`/api/platform/users/${userId}/platform-admin`, {
        method: "PATCH",
        body: JSON.stringify({ is_platform_admin: makeAdmin }),
      });
      setSuccess(makeAdmin ? "Sayt Admini huquqi berildi!" : "Sayt Admini huquqi olib tashlandi.");
      await loadPlatformData();
    } catch (err: any) {
      setError(err.message || "Foydalanuvchi rolini yangilashda xatolik");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleToggleUserStatus = async (userId: number, isActive: boolean) => {
    setBusy(true);
    try {
      await api(`/api/platform/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      setSuccess(isActive ? "Foydalanuvchi faollashtirildi!" : "Foydalanuvchi bloklandi.");
      await loadPlatformData();
    } catch (err: any) {
      setError(err.message || "Foydalanuvchi holatini yangilashda xatolik");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleCreateStore = async (payload: any) => {
    setBusy(true);
    try {
      const res = await api<any>("/api/platform/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(`"${payload.name}" do'koni muvaffaqiyatli ochildi!`);
      await loadPlatformData();
      return res;
    } catch (err: any) {
      setError(err.message || "Do'kon ochishda xatolik yuz berdi");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateStoreStatus = async (storeId: number, newStatus: string) => {
    setBusy(true);
    try {
      await api<any>(`/api/platform/organizations/${storeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setSuccess(`Do'kon holati "${newStatus}" ga o'zgartirildi`);
      await loadPlatformData();
    } catch (err: any) {
      setError(err.message || "Holatni o'zgartirishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteStore = async (storeId: number) => {
    setPendingConfirm({
      title: "Do'konni o'chirish",
      message: "Haqiqatan ham ushbu do'konni o'chirmoqchimisiz? Barcha bog'liq sozlamalar nofaol holatga o'tadi.",
      confirmText: "Ha, o'chirish",
      onConfirm: async () => {
        await api<any>(`/api/platform/organizations/${storeId}`, {
          method: "DELETE",
        });
        setSuccess("Do'kon muvaffaqiyatli o'chirildi");
        await loadPlatformData();
      },
    });
  };

  const handleInspectStore = async (storeId: number) => {
    return api<any>(`/api/platform/organizations/${storeId}/details`);
  };

  const handleUpdateStoreSubscription = async (
    storeId: number,
    payload: { plan_code: string; status: string; billing_cycle: string; extend_days: number }
  ) => {
    setBusy(true);
    try {
      const res = await api<any>(`/api/platform/organizations/${storeId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSuccess(res.message || "Do'kon obunasi yangilandi");
      await loadPlatformData();
      return res;
    } catch (err: any) {
      setError(err.message || "Do'kon obunasini yangilashda xatolik");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleSendPlatformDailyReport = async () => {
    setBusy(true);
    try {
      const res = await api<any>("/api/platform/daily-report", {
        method: "POST",
      });
      setSuccess(
        res.sent_count > 0
          ? `Platforma hisoboti Telegramga (${res.sent_count} ta admin) yuborildi!`
          : "Platforma hisoboti tayyorlandi."
      );
      await loadPlatformData();
      return res;
    } catch (err: any) {
      setError(err.message || "Hisobot yuborishda xatolik");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleSendPlatformBroadcast = async (payload: {
    audience: string;
    message: string;
    dry_run?: boolean;
  }) => {
    if (!payload.dry_run) setBusy(true);
    try {
      const res = await api<any>("/api/platform/broadcast", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!payload.dry_run) {
        setSuccess(`Xabarnoma ${res.sent_count} ta foydalanuvchiga yuborildi!`);
        await loadPlatformData();
      }
      return res;
    } catch (err: any) {
      if (!payload.dry_run) {
        setError(err.message || "E'lon yuborishda xatolik");
      }
      throw err;
    } finally {
      if (!payload.dry_run) setBusy(false);
    }
  };

  return {
    platformMetrics,
    setPlatformMetrics,
    platformOrgs,
    setPlatformOrgs,
    platformUsers,
    systemHealth,
    auditLogs,
    platformSubTab,
    setPlatformSubTab,
    loadPlatformData,
    handleUpdatePlanConfig,
    handleEnterStore,
    handleExitStore,
    handleAppointSiteAdmin,
    handleToggleSiteAdmin,
    handleToggleUserStatus,
    handleCreateStore,
    handleUpdateStoreStatus,
    handleDeleteStore,
    handleInspectStore,
    handleUpdateStoreSubscription,
    handleSendPlatformDailyReport,
    handleSendPlatformBroadcast,
  };
}
