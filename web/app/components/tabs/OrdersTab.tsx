"use client";

import React, { useState } from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconShoppingCart,
  IconSearch,
  IconCheck,
  IconTrash,
  IconFilter,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../layout/PageHeader";

export interface OrderItem {
  id: string;
  customer: string;
  username: string;
  product: string;
  amount: string;
  status: "New" | "Processing" | "Confirmed" | "Completed" | "Cancelled" | string;
  date: string;
  channel: string;
}

export interface OrdersTabProps {
  orders: OrderItem[];
  orderSearch: string;
  setOrderSearch: (val: string) => void;
  onUpdateOrderStatus: (orderId: string, status: string) => void;
  onDeleteOrder: (orderId: string) => void;
  busy: boolean;
}

export function OrdersTab({
  orders,
  orderSearch,
  setOrderSearch,
  onUpdateOrderStatus,
  onDeleteOrder,
  busy,
}: OrdersTabProps) {
  const { language, t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState("all");
  const confirmLabel = language === "uz" ? "Tasdiqlash" : language === "ru" ? "Подтвердить" : "Confirm";
  const completeLabel = language === "uz" ? "Bajarildi" : language === "ru" ? "Выполнен" : "Complete";

  const filteredOrders = orders.filter((ord) => {
    if (statusFilter !== "all" && ord.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase();
    return (
      ord.id.toLowerCase().includes(q) ||
      ord.customer.toLowerCase().includes(q) ||
      ord.username.toLowerCase().includes(q) ||
      ord.product.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.orders")}
        title={t("orders.title")}
        description={t("orders.subtitle")}
        badge={{
          text: language === "uz" ? `${orders.length} ta jami buyurtma` : `${orders.length} total orders`,
          variant: "success",
        }}
      />

      <Card>
        <CardHeader
          actions={
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="d-flex align-items-center gap-1.5">
                <IconFilter size={14} className="text-secondary" />
                <select
                  aria-label="Holat bo'yicha saralash"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="linear-input py-1"
                  style={{ width: "auto", fontSize: "0.78rem" }}
                >
                  <option value="all">{t("orders.status_all")}</option>
                  <option value="New">{t("orders.status_new")}</option>
                  <option value="Processing">{t("orders.status_processing")}</option>
                  <option value="Confirmed">{t("orders.status_confirmed")}</option>
                  <option value="Completed">{t("orders.status_completed")}</option>
                </select>
              </div>

              <div className="position-relative" style={{ width: "200px", maxWidth: "100%" }}>
                <IconSearch
                  size={14}
                  className="position-absolute start-0 ms-2.5 top-50 translate-middle-y text-secondary"
                />
                <input
                  type="text"
                  placeholder={t("orders.search_placeholder")}
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="linear-input ps-5 py-1"
                  style={{ fontSize: "0.78rem" }}
                />
              </div>
            </div>
          }
        >
          <CardTitle>{t("orders.card_title")} ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={<IconShoppingCart size={32} />}
              title={t("orders.empty")}
              description={
                orderSearch.trim() || statusFilter !== "all"
                  ? language === "uz"
                    ? "Qidiruv yoki holat filtri bo'yicha buyurtma topilmadi."
                    : language === "ru"
                    ? "По фильтру или поиску заказы не найдены."
                    : "No orders matched your search or status filter."
                  : language === "uz"
                  ? "Telegram botingiz orqali mijozlar buyurtma berganda barcha buyurtmalar shu yerda aks etadi."
                  : language === "ru"
                  ? "Новые заказы из Telegram появятся в этом списке автоматически."
                  : "Customer orders placed through your Telegram bot will appear here automatically."
              }
            />
          ) : (
            <>
              <div className="d-none d-md-block table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>{t("orders.th_id")}</th>
                      <th>{t("orders.th_customer")}</th>
                      <th>{t("orders.th_product")}</th>
                      <th>{t("orders.th_amount")}</th>
                      <th>{t("orders.th_status")}</th>
                      <th>{t("orders.th_date")}</th>
                      <th>{t("orders.th_source")}</th>
                      <th style={{ textAlign: "right" }}>{t("orders.th_actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td className="font-monospace text-primary fw-semibold small">
                          {ord.id}
                        </td>
                        <td>
                          <div className="fw-medium text-primary small">{ord.customer}</div>
                          <div className="text-secondary" style={{ fontSize: "0.7rem" }}>{ord.username}</div>
                        </td>
                        <td className="text-primary small">{ord.product}</td>
                        <td className="fw-bold text-success font-monospace small">{ord.amount}</td>
                        <td>
                          {ord.status === "Confirmed" ? (
                            <Badge variant="success">{t("orders.status_confirmed")}</Badge>
                          ) : ord.status === "Processing" ? (
                            <Badge variant="info">{t("orders.status_processing")}</Badge>
                          ) : ord.status === "Completed" ? (
                            <Badge variant="accent">{t("orders.status_completed")}</Badge>
                          ) : (
                            <Badge variant="warning">{t("orders.status_new")}</Badge>
                          )}
                        </td>
                        <td className="text-secondary small">{ord.date}</td>
                        <td>
                          <Badge variant="accent">{ord.channel}</Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="d-flex align-items-center justify-content-end gap-1.5">
                            {ord.status?.toLowerCase() !== "confirmed" && ord.status?.toLowerCase() !== "completed" && (
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => onUpdateOrderStatus(ord.id, "Confirmed")}
                                title={confirmLabel}
                                icon={<IconCheck size={13} style={{ color: "var(--success)" }} />}
                              >
                                {confirmLabel}
                              </Button>
                            )}
                            {ord.status?.toLowerCase() !== "completed" && (
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => onUpdateOrderStatus(ord.id, "Completed")}
                                title={completeLabel}
                              >
                                {completeLabel}
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => onDeleteOrder(ord.id)}
                              title="Buyurtmani o'chirish"
                              aria-label={`Buyurtma #${ord.id} ni o'chirish`}
                              icon={<IconTrash size={13} />}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="d-md-none d-flex flex-column">
                {filteredOrders.map((ord) => (
                  <div key={`mob-ord-${ord.id}`} className="p-3 border-bottom border-subtle d-flex flex-column gap-2">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <span className="font-monospace text-primary fw-bold small">{ord.id}</span>
                      {ord.status === "Confirmed" ? (
                        <Badge variant="success">{t("orders.status_confirmed")}</Badge>
                      ) : ord.status === "Processing" ? (
                        <Badge variant="info">{t("orders.status_processing")}</Badge>
                      ) : ord.status === "Completed" ? (
                        <Badge variant="accent">{t("orders.status_completed")}</Badge>
                      ) : (
                        <Badge variant="warning">{t("orders.status_new")}</Badge>
                      )}
                    </div>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="min-w-0">
                        <div className="fw-semibold text-primary small text-truncate">{ord.product}</div>
                        <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                          {ord.customer} • {ord.username}
                        </div>
                      </div>
                      <span className="fw-bold text-success font-monospace small flex-shrink-0">{ord.amount}</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-1">
                      <span className="text-secondary" style={{ fontSize: "0.72rem" }}>{ord.date}</span>
                      <div className="d-flex align-items-center gap-1.5">
                        {ord.status?.toLowerCase() !== "confirmed" && ord.status?.toLowerCase() !== "completed" && (
                          <Button variant="secondary" size="xs" onClick={() => onUpdateOrderStatus(ord.id, "Confirmed")} icon={<IconCheck size={12} />}>
                            {confirmLabel}
                          </Button>
                        )}
                        {ord.status?.toLowerCase() !== "completed" && (
                          <Button variant="secondary" size="xs" onClick={() => onUpdateOrderStatus(ord.id, "Completed")}>
                            {completeLabel}
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => onDeleteOrder(ord.id)}
                          aria-label={`Buyurtma #${ord.id} ni o'chirish`}
                          icon={<IconTrash size={12} />}
                        />
                      </div>
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
