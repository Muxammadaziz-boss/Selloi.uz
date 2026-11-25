"use client";

import React from "react";
import { useLanguage } from "../../lib/i18n";
import { IconHistory, IconClock } from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { PageHeader } from "../layout/PageHeader";

export interface LogItem {
  id?: string | number;
  time?: string;
  source?: string;
  action?: string;
  details?: string;
  status?: string;
}

export interface LogsTabProps {
  logs?: LogItem[];
  loading?: boolean;
}

export function LogsTab({ logs = [], loading = false }: LogsTabProps) {
  const { language, t } = useLanguage();

  const formatLogTime = (ts?: string) => {
    if (!ts) return "-";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
    return d.toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const thTime = language === "uz" ? "Vaqt" : language === "ru" ? "Время" : "Time";
  const thSource = language === "uz" ? "Manba / Servis" : language === "ru" ? "Источник / Сервис" : "Source / Service";
  const thAction = language === "uz" ? "Amal Nomi" : language === "ru" ? "Действие" : "Action";
  const thDetails = language === "uz" ? "Batafsil Ma'lumot" : language === "ru" ? "Детали" : "Details";
  const thStatus = language === "uz" ? "Holat" : language === "ru" ? "Статус" : "Status";

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.logs")}
        title={t("logs.title")}
        description={t("logs.subtitle")}
        badge={{
          text: language === "uz" ? "Haqiqiy audit" : language === "ru" ? "Живой аудит" : "Live audit",
          variant: "success",
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {language === "uz" ? "Amallar Jurnali" : language === "ru" ? "Журнал действий" : "Activity Log"} ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && logs.length === 0 ? (
            <div className="p-3 space-y-2.5">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="d-flex align-items-center justify-content-between gap-3 py-2 border-bottom border-subtle">
                  <Skeleton width="18%" height={14} />
                  <Skeleton width="16%" height={20} borderRadius={9999} />
                  <Skeleton width="42%" height={14} />
                  <Skeleton width="12%" height={20} borderRadius={9999} />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<IconHistory size={32} />}
              title={
                language === "uz"
                  ? "Hozircha harakatlar qayd etilmagan"
                  : language === "ru"
                  ? "Действия пока не зафиксированы"
                  : "No activity logs yet"
              }
              description={
                language === "uz"
                  ? "AI javoblari, operator amallari, buyurtmalar va kanal sinxronizatsiyalari bu yerda avtomatik ko'rsatiladi."
                  : language === "ru"
                  ? "Ответы ИИ, действия операторов, заказы и синхронизации каналов появятся здесь автоматически."
                  : "AI responses, operator replies, orders, and channel syncs will appear here automatically."
              }
            />
          ) : (
            <>
              <div className="d-none d-md-block table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th style={{ width: "145px" }}>{thTime}</th>
                      <th style={{ width: "150px" }}>{thSource}</th>
                      <th>{thAction}</th>
                      <th>{thDetails}</th>
                      <th style={{ textAlign: "right", width: "130px" }}>{thStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, idx) => (
                      <tr key={l.id ?? idx}>
                        <td className="text-secondary small font-monospace">
                          <span className="d-flex align-items-center gap-1">
                            <IconClock size={12} />
                            {formatLogTime(l.time)}
                          </span>
                        </td>
                        <td>
                          <Badge variant="accent">{l.source || "System"}</Badge>
                        </td>
                        <td className="fw-medium text-primary small">{l.action}</td>
                        <td className="text-secondary small">{l.details}</td>
                        <td style={{ textAlign: "right" }}>
                          <Badge variant="success" dot>
                            {l.status || "OK"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="d-md-none d-flex flex-column">
                {logs.map((l, idx) => (
                  <div key={`mob-log-${l.id ?? idx}`} className="p-3 border-bottom border-subtle d-flex flex-column gap-1.5">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <Badge variant="accent">{l.source || "System"}</Badge>
                      <span className="text-secondary font-monospace" style={{ fontSize: "0.7rem" }}>
                        {formatLogTime(l.time)}
                      </span>
                    </div>
                    <div className="fw-semibold text-primary small">{l.action}</div>
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <span className="text-secondary small text-truncate">{l.details}</span>
                      <Badge variant="success" dot>{l.status || "OK"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
