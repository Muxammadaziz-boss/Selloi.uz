"use client";

import React from "react";
import { useLanguage } from "../../lib/i18n";
import { IconKey, IconUserCheck, IconShield, IconHeadset } from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { PageHeader } from "../layout/PageHeader";

export interface TeamTabProps {
  permissionLabels: Record<string, string>;
}

export function TeamTab({ permissionLabels }: TeamTabProps) {
  const { language, t } = useLanguage();
  const roles = [
    {
      name: "Owner",
      title: t("team.role_owner_title"),
      badge: t("team.role_owner_badge"),
      badgeVariant: "accent" as const,
      icon: IconShield,
      desc: t("team.role_owner_desc"),
    },
    {
      name: "Admin",
      title: t("team.role_admin_title"),
      badge: t("team.role_admin_badge"),
      badgeVariant: "info" as const,
      icon: IconUserCheck,
      desc: t("team.role_admin_desc"),
    },
    {
      name: "Moderator",
      title: t("team.role_moderator_title"),
      badge: t("team.role_moderator_badge"),
      badgeVariant: "success" as const,
      icon: IconHeadset,
      desc: t("team.role_moderator_desc"),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.team")}
        title={t("team.title")}
        description={t("team.subtitle")}
        badge={{ text: t("team.badge"), variant: "accent" }}
      />

      {/* Role Cards */}
      <div className="row g-3 mb-4">
        {roles.map((r) => {
          const IconC = r.icon;
          return (
            <div key={r.name} className="col-12 col-md-4">
              <div
                className="linear-card p-3 p-md-3.5 h-100 d-flex flex-column"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "10px",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2.5">
                  <Badge variant={r.badgeVariant}>{r.badge}</Badge>
                  <div
                    className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: "32px",
                      height: "32px",
                      backgroundColor: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "6px",
                    }}
                  >
                    <IconC size={16} style={{ color: "var(--accent)" }} />
                  </div>
                </div>
                <div className="fw-bold text-primary mb-1.5" style={{ fontSize: "1.05rem", letterSpacing: "-0.01em" }}>
                  {r.title}
                </div>
                <div className="text-secondary small flex-grow-1" style={{ fontSize: "0.8rem", lineHeight: 1.55 }}>
                  {r.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Matrix Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("team.matrix_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-responsive">
            <table className="linear-table">
              <thead>
                <tr>
                  <th style={{ width: "240px" }}>{language === "uz" ? "Ruxsat Kaliti" : "Permission Key"}</th>
                  <th>{language === "uz" ? "Tavsifi" : "Description"}</th>
                  <th style={{ textAlign: "center", width: "110px" }}>Owner</th>
                  <th style={{ textAlign: "center", width: "110px" }}>Admin</th>
                  <th style={{ textAlign: "center", width: "110px" }}>Moderator</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(permissionLabels).map(([k, label]) => {
                  const adminHas = !["can_manage_admins"].includes(k);
                  const modHas = [
                    "can_view_conversations",
                    "can_reply_customers",
                    "can_takeover",
                    "can_resume_ai",
                    "can_view_knowledge",
                    "can_view_orders",
                  ].includes(k);

                  return (
                    <tr key={k}>
                      <td className="font-monospace text-secondary small">
                        {k}
                      </td>
                      <td className="text-primary small fw-medium">
                        {label}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Badge variant="success">Ha</Badge>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {adminHas ? (
                          <Badge variant="success">Ha</Badge>
                        ) : (
                          <Badge variant="danger">Yo'q</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {modHas ? (
                          <Badge variant="success">Ha</Badge>
                        ) : (
                          <Badge variant="danger">Yo'q</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
