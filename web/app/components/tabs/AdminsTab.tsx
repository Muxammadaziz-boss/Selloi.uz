"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n";
import { api } from "../../lib/dashboardApi";
import {
  IconShieldLock,
  IconPlus,
  IconCrown,
  IconExternalLink,
  IconShieldCheck,
  IconAdjustments,
  IconLock,
  IconTrash,
  IconMail,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { PageHeader } from "../layout/PageHeader";

export interface AdminUserItem {
  id: number;
  telegram_user_id: number;
  name: string;
  username?: string | null;
  role: "owner" | "admin" | "moderator";
  permissions: Record<string, boolean>;
  is_active: boolean;
}

export interface AdminsTabProps {
  admins: AdminUserItem[];
  newAdminId: string;
  setNewAdminId: (v: string) => void;
  newAdminName: string;
  setNewAdminName: (v: string) => void;
  newAdminUsername: string;
  setNewAdminUsername: (v: string) => void;
  newAdminRole: "admin" | "moderator";
  setNewAdminRole: (v: "admin" | "moderator") => void;
  onAddAdmin: (e: React.FormEvent) => void;
  onRoleChange: (telegramUserId: number, role: string) => void;
  onDeleteAdmin: (telegramUserId: number, name: string) => void;
  managingPermissionsAdmin: AdminUserItem | null;
  setManagingPermissionsAdmin: (adm: AdminUserItem | null) => void;
  onTogglePermission: (telegramUserId: number, key: string, val: boolean) => void;
  busy: boolean;
  permissionLabels: Record<string, string>;
  permissionCategories: any[];
}

export function AdminsTab({
  admins,
  newAdminId,
  setNewAdminId,
  newAdminName,
  setNewAdminName,
  newAdminUsername,
  setNewAdminUsername,
  newAdminRole,
  setNewAdminRole,
  onAddAdmin,
  onRoleChange,
  onDeleteAdmin,
  managingPermissionsAdmin,
  setManagingPermissionsAdmin,
  onTogglePermission,
  busy,
  permissionLabels,
  permissionCategories,
}: AdminsTabProps) {
  const { language, t } = useLanguage();
  const totalPermissionsCount = Object.keys(permissionLabels).length;
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operator");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteErr, setInviteErr] = useState("");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [webMembers, setWebMembers] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  const loadTeamInvites = useCallback(async () => {
    try {
      const res = await api<{
        smtp_configured: boolean;
        members: any[];
        invites: any[];
      }>("/admin/team/invites");
      setSmtpConfigured(Boolean(res?.smtp_configured));
      setWebMembers(res?.members || []);
      setPendingInvites(res?.invites || []);
    } catch {
      // Permission-restricted operators/moderators skip silently
    }
  }, []);

  useEffect(() => {
    void loadTeamInvites();
  }, [loadTeamInvites]);

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setInviteErr("");
    setInviteMsg("");
    setLatestInviteUrl("");
    try {
      const res = await api<{ ok: boolean; email_sent: boolean; invite_url: string }>("/admin/team/invites", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setLatestInviteUrl(res.invite_url || "");
      setInviteMsg(
        res.email_sent
          ? `Taklifnoma ${inviteEmail.trim()} manziliga yuborildi!`
          : `Taklif havolasi yaratildi! Havolani nusxalab xodimga yuboring.`
      );
      setInviteEmail("");
      await loadTeamInvites();
    } catch (err: any) {
      setInviteErr(err?.message || "Taklifnoma yaratishda xatolik");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvite = async (id: number) => {
    try {
      await api(`/admin/team/invites/${id}`, { method: "DELETE" });
      await loadTeamInvites();
    } catch (err: any) {
      setInviteErr(err?.message || "Bekor qilishda xatolik");
    }
  };

  const handleRemoveWebMember = async (id: number) => {
    try {
      await api(`/admin/team/members/${id}`, { method: "DELETE" });
      await loadTeamInvites();
    } catch (err: any) {
      setInviteErr(err?.message || "A'zoni o'chirishda xatolik");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.admins")}
        title={t("admins.title")}
        description={t("admins.subtitle")}
        badge={{
          text: language === "uz" ? `${admins.length} ta faol admin` : `${admins.length} active admins`,
          variant: "accent",
        }}
      />

      <div className="row g-4">
        {/* Left: Admin List Table */}
        <div className="col-12 col-lg-8">
          <Card>
            <CardHeader>
              <CardTitle>Administratorlar Ro'yxati ({admins.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th>Admin</th>
                      <th>Telegram ID</th>
                      <th>Roli</th>
                      <th>Ruxsatlar</th>
                      <th style={{ textAlign: "right" }}>Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-secondary py-5 small">
                          Administratorlar topilmadi
                        </td>
                      </tr>
                    ) : (
                      admins.map((adm) => {
                        const isOwner = adm.role === "owner";
                        const activePermsCount = Object.entries(adm.permissions || {}).filter(
                          ([k, v]) => Boolean(v) && k !== "can_switch_admins"
                        ).length;

                        return (
                          <tr key={adm.id}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold"
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    backgroundColor: "var(--accent-subtle)",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  {adm.name ? adm.name.charAt(0).toUpperCase() : "A"}
                                </div>
                                <div>
                                  <div className="fw-semibold text-primary small d-flex align-items-center gap-1">
                                    <span>{adm.name || "Noma'lum"}</span>
                                    {isOwner && (
                                      <Badge variant="warning">
                                        <IconCrown size={11} /> Owner
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-secondary small font-monospace" style={{ fontSize: "0.7rem" }}>
                                    {adm.username ? `@${adm.username}` : "Username yo'q"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="font-monospace text-secondary small">
                                {adm.telegram_user_id}
                              </span>
                            </td>
                            <td>
                              {isOwner ? (
                                <Badge variant="warning">Bosh Admin</Badge>
                              ) : (
                                <select
                                  aria-label={`Admin ${adm.name} roli`}
                                  value={adm.role}
                                  onChange={(e) => onRoleChange(adm.telegram_user_id, e.target.value)}
                                  disabled={busy}
                                  className="linear-input py-0.5"
                                  style={{ width: "auto", fontSize: "0.78rem" }}
                                >
                                  <option value="admin">Admin</option>
                                  <option value="moderator">Moderator</option>
                                </select>
                              )}
                            </td>
                            <td>
                              {isOwner ? (
                                <Badge variant="success">{t("admins.all_permissions")} ({totalPermissionsCount}/{totalPermissionsCount})</Badge>
                              ) : (
                                <div className="d-flex align-items-center gap-2">
                                  <Badge
                                    variant={activePermsCount > 0 ? "accent" : "secondary" as any}
                                  >
                                    {activePermsCount} / {totalPermissionsCount} {t("admins.permissions_suffix")}
                                  </Badge>
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    onClick={() => setManagingPermissionsAdmin(adm)}
                                    icon={<IconAdjustments size={12} />}
                                  >
                                    {language === "uz" ? "Sozlash" : "Configure"}
                                  </Button>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {isOwner ? (
                                <IconLock size={15} className="text-secondary opacity-50" />
                              ) : (
                                <Button
                                  variant="danger"
                                  size="xs"
                                  aria-label={`Admin ${adm.name} ni o'chirish`}
                                  onClick={() => onDeleteAdmin(adm.telegram_user_id, adm.name)}
                                  disabled={busy}
                                  icon={<IconTrash size={13} />}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Add Admin Card */}
        <div className="col-12 col-lg-4">
          <Card>
            <CardHeader>
              <CardTitle>Yangi Admin Qo'shish</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onAddAdmin} className="d-flex flex-column gap-3">
                <Input
                  label="Telegram User ID"
                  placeholder="Masalan: 12345678"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  hint="Adminning Telegramdagi raqamli ID si (@userinfobot orqali topish mumkin)"
                  required
                />
                <Input
                  label="Admin Ismi"
                  placeholder="Alisher Zokirov"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                />
                <Input
                  label="Telegram Username"
                  placeholder="alisher_admin"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value.replace(/^@+/, ""))}
                />
                <Select
                  label="Tizimdagi Roli"
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as any)}
                  options={[
                    { value: "moderator", label: "Moderator (Mijozlar bilan yozishish)" },
                    { value: "admin", label: "Admin (To'liq boshqaruv huquqi)" },
                  ]}
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="w-100 mt-2"
                  disabled={busy || !newAdminId.trim()}
                  icon={<IconPlus size={15} />}
                >
                  Admin Qo'shish
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Team Invites & Web Panel Access */}
      <div className="row g-3 mt-1">
        <div className="col-12 col-lg-7">
          <Card>
            <CardHeader>
              <CardTitle className="d-flex align-items-center gap-2">
                <IconMail size={16} style={{ color: "var(--accent)" }} />
                <span>{t("admins.web_members_title")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th>Foydalanuvchi / Email</th>
                      <th>Rol / Holat</th>
                      <th style={{ textAlign: "right" }}>Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webMembers.map((m) => (
                      <tr key={`mem-${m.id}`}>
                        <td>
                          <div className="fw-medium text-primary small">{m.full_name || m.email}</div>
                          <div className="text-secondary" style={{ fontSize: "0.72rem" }}>{m.email}</div>
                        </td>
                        <td>
                          <Badge variant={m.role === "owner" ? "accent" : "success"}>{m.role}</Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {m.role !== "owner" ? (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => void handleRemoveWebMember(m.id)}
                              icon={<IconTrash size={12} />}
                            />
                          ) : (
                            <span className="small text-secondary"><IconLock size={12} /></span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {pendingInvites
                      .filter((inv) => inv.status === "pending")
                      .map((inv) => (
                        <tr key={`inv-${inv.id}`}>
                          <td>
                            <div className="fw-medium text-primary small">{inv.email}</div>
                            <div className="text-secondary" style={{ fontSize: "0.7rem" }}>Kutilayotgan taklifnoma</div>
                          </td>
                          <td>
                            <Badge variant="warning">{inv.role} (kutilmoqda)</Badge>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => void handleRevokeInvite(inv.id)}
                              icon={<IconTrash size={12} />}
                            />
                          </td>
                        </tr>
                      ))}
                    {webMembers.length === 0 && pendingInvites.filter((i) => i.status === "pending").length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-4 text-secondary small">
                          Hali email orqali taklif qilingan web jamoa a&apos;zolari yo&apos;q.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-12 col-lg-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("admins.invite_card_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendEmailInvite} className="d-flex flex-column gap-3">
                <Input
                  label="Xodim email manzili"
                  type="email"
                  placeholder="operator@store.uz"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <Select
                  label="Jamoa Roli"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  options={[
                    { value: "operator", label: "Operator (Suhbat & Buyurtmalar)" },
                    { value: "manager", label: "Manager (Katalog & Tahlil)" },
                    { value: "admin", label: "Admin (To'liq boshqaruv)" },
                    { value: "viewer", label: "Viewer (Faqat ko'rish)" },
                  ]}
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={inviteBusy}
                  disabled={inviteBusy || !inviteEmail.trim()}
                  icon={<IconMail size={15} />}
                >
                  {t("admins.invite_btn")}
                </Button>
                {!smtpConfigured && (
                  <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
                    SMTP sozlanmagan bo&apos;lsa ham bir martalik xavfsiz taklif havolasi yaratiladi.
                  </div>
                )}
                {inviteMsg && <div className="small text-success">{inviteMsg}</div>}
                {inviteErr && <div className="small text-danger">{inviteErr}</div>}
                {latestInviteUrl && (
                  <div className="d-flex gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={latestInviteUrl}
                      className="linear-input font-monospace flex-grow-1"
                      style={{ fontSize: "0.74rem" }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={copiedInvite ? <IconCheck size={13} /> : <IconCopy size={13} />}
                      onClick={() => {
                        navigator.clipboard?.writeText(latestInviteUrl);
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2000);
                      }}
                    >
                      {copiedInvite ? t("payments.copied") : t("payments.copy")}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Permissions Management Modal */}
      {managingPermissionsAdmin && (
        <Modal
          isOpen={true}
          onClose={() => setManagingPermissionsAdmin(null)}
          title={`${managingPermissionsAdmin.name || "Admin"}: ${t("admins.modal_title")}`}
          size="lg"
          footer={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setManagingPermissionsAdmin(null)}
            >
              {t("admins.btn_done")}
            </Button>
          }
        >
          <div className="d-flex flex-column gap-3">
            {permissionCategories.map((cat: any) => (
              <div key={cat.category} className="p-3 rounded-2 border border-subtle" style={{ backgroundColor: "var(--bg-surface-elevated)" }}>
                <div className="fw-semibold text-primary small mb-1">
                  {cat.icon} {cat.category}
                </div>
                <div className="text-secondary small mb-2.5" style={{ fontSize: "0.72rem" }}>
                  {cat.description}
                </div>
                <div className="d-flex flex-column gap-2">
                  {cat.permissions.map((p: any) => {
                    const isChecked = Boolean(managingPermissionsAdmin.permissions?.[p.key]);
                    return (
                      <label key={p.key} className="d-flex align-items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => onTogglePermission(managingPermissionsAdmin.telegram_user_id, p.key, e.target.checked)}
                          style={{ accentColor: "var(--accent)", marginTop: "3px" }}
                        />
                        <div>
                          <div className="text-primary small fw-medium">{p.label}</div>
                          <div className="text-secondary" style={{ fontSize: "0.7rem" }}>{p.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
