"use client";

import React, { useState } from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconShoppingCart,
  IconSearch,
  IconCheck,
  IconTrash,
  IconFilter,
  IconCreditCard,
  IconCopy,
  IconRefresh,
  IconX,
  IconDownload,
} from "@tabler/icons-react";
import { downloadCsvExport } from "../../lib/csvExport";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../layout/PageHeader";

export interface OrderPaymentSummary {
  bill_id: string;
  provider: string;
  amount_uzs: number;
  payment_url?: string | null;
  status: string;
  paid_at?: string | null;
}

export interface OrderItem {
  id: string;
  db_id?: number;
  conversation_id?: number | null;
  customer: string;
  username: string;
  product: string;
  amount: string;
  status: "New" | "Processing" | "Confirmed" | "Completed" | "Paid" | "Cancelled" | string;
  date: string;
  channel: string;
  latest_payment?: OrderPaymentSummary | null;
}

export interface OrdersTabProps {
  orders: OrderItem[];
  orderSearch: string;
  setOrderSearch: (val: string) => void;
  onUpdateOrderStatus: (orderId: string, status: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onSendOrderPayment?: (orderId: string, amountUzs: number, description?: string) => Promise<any>;
  onMarkOrderPaid?: (orderId: string) => Promise<void>;
  onCheckOrderPayment?: (orderId: string) => Promise<void>;
  busy: boolean;
}

export function OrdersTab({
  orders,
  orderSearch,
  setOrderSearch,
  onUpdateOrderStatus,
  onDeleteOrder,
  onSendOrderPayment,
  onMarkOrderPaid,
  onCheckOrderPayment,
  busy,
}: OrdersTabProps) {
  const { language, t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState("all");
  const [payModalOrder, setPayModalOrder] = useState<OrderItem | null>(null);
  const [payAmountInput, setPayAmountInput] = useState("");
  const [payDescInput, setPayDescInput] = useState("");
  const [paySending, setPaySending] = useState(false);
  const [generatedPayUrl, setGeneratedPayUrl] = useState<string | null>(null);
  const [copiedPayUrl, setCopiedPayUrl] = useState(false);

  const confirmLabel = language === "uz" ? "Tasdiqlash" : language === "ru" ? "Подтвердить" : "Confirm";
  const completeLabel = language === "uz" ? "Bajarildi" : language === "ru" ? "Выполнен" : "Complete";

  const openPaymentModal = (ord: OrderItem) => {
    const digits = (ord.amount || "").includes("$") ? "" : (ord.amount || "").replace(/[^\d]/g, "");
    setPayModalOrder(ord);
    setPayAmountInput(digits || "100000");
    setPayDescInput(ord.product || ord.id);
    setGeneratedPayUrl(ord.latest_payment?.payment_url || null);
    setCopiedPayUrl(false);
  };

  const handleSubmitOrderPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalOrder || !onSendOrderPayment) return;
    const amt = parseInt(payAmountInput.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(amt) || amt < 1000) return;
    setPaySending(true);
    try {
      const res = await onSendOrderPayment(payModalOrder.id, amt, payDescInput.trim());
      if (res?.payment?.payment_url) {
        setGeneratedPayUrl(res.payment.payment_url);
      } else {
        setPayModalOrder(null);
      }
    } finally {
      setPaySending(false);
    }
  };

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
                  <option value="Paid">{t("orders.status_paid")}</option>
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

              <Button
                variant="secondary"
                size="sm"
                icon={<IconDownload size={14} />}
                disabled={filteredOrders.length === 0}
                onClick={() =>
                  downloadCsvExport(
                    `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`,
                    ["ID", "Mijoz", "Username", "Mahsulot", "Summa", "Holat", "To'lov", "Kanal", "Sana"],
                    filteredOrders.map((o) => [
                      o.id,
                      o.customer,
                      o.username,
                      o.product,
                      o.amount,
                      o.status,
                      o.latest_payment?.status || "-",
                      o.channel,
                      o.date,
                    ])
                  )
                }
              >
                CSV Eksport
              </Button>
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
                          {ord.status?.toLowerCase() === "paid" ? (
                            <Badge variant="success" dot>{t("orders.status_paid")}</Badge>
                          ) : ord.status === "Confirmed" ? (
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
                          <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                            {onSendOrderPayment && ord.status?.toLowerCase() !== "paid" && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => openPaymentModal(ord)}
                                icon={<IconCreditCard size={13} style={{ color: "var(--accent)" }} />}
                              >
                                {t("orders.btn_send_payment")}
                              </Button>
                            )}
                            {onCheckOrderPayment && ord.latest_payment?.status === "pending" && ord.latest_payment.provider === "tezcheck" && (
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => void onCheckOrderPayment(ord.id)}
                                title={t("orders.btn_check_payment")}
                                icon={<IconRefresh size={13} />}
                              />
                            )}
                            {onMarkOrderPaid && ord.status?.toLowerCase() !== "paid" && (
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => void onMarkOrderPaid(ord.id)}
                                title={t("orders.btn_mark_paid")}
                                icon={<IconCheck size={13} style={{ color: "var(--success)" }} />}
                              >
                                {t("orders.status_paid")}
                              </Button>
                            )}
                            {ord.status?.toLowerCase() !== "confirmed" && ord.status?.toLowerCase() !== "completed" && ord.status?.toLowerCase() !== "paid" && (
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
                      <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        {onSendOrderPayment && ord.status?.toLowerCase() !== "paid" && (
                          <Button variant="outline" size="xs" onClick={() => openPaymentModal(ord)} icon={<IconCreditCard size={12} />}>
                            {t("orders.btn_send_payment")}
                          </Button>
                        )}
                        {onMarkOrderPaid && ord.status?.toLowerCase() !== "paid" && (
                          <Button variant="secondary" size="xs" onClick={() => void onMarkOrderPaid(ord.id)}>
                            {t("orders.status_paid")}
                          </Button>
                        )}
                        {ord.status?.toLowerCase() !== "confirmed" && ord.status?.toLowerCase() !== "completed" && ord.status?.toLowerCase() !== "paid" && (
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

      {/* Send Payment Link Modal */}
      {payModalOrder && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ backgroundColor: "rgba(0,0,0,0.65)", zIndex: 1080 }}
        >
          <div className="linear-card-elevated p-4 w-100" style={{ maxWidth: 440 }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="fw-semibold text-primary d-flex align-items-center gap-2">
                <IconCreditCard size={18} style={{ color: "var(--accent)" }} />
                <span>{t("orders.pay_modal_title")} ({payModalOrder.id})</span>
              </div>
              <button
                type="button"
                className="btn-linear p-1"
                onClick={() => setPayModalOrder(null)}
                aria-label="Yopish"
              >
                <IconX size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitOrderPayment} className="d-flex flex-column gap-3">
              <div>
                <label className="small text-secondary d-block mb-1">{t("orders.pay_amount_label")}</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  required
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  className="linear-input font-monospace"
                />
              </div>
              <div>
                <label className="small text-secondary d-block mb-1">{t("orders.pay_desc_label")}</label>
                <input
                  type="text"
                  value={payDescInput}
                  onChange={(e) => setPayDescInput(e.target.value)}
                  className="linear-input"
                />
              </div>
              {generatedPayUrl && (
                <div className="p-2.5 rounded-2" style={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                  <div className="small text-success fw-medium mb-1">{t("orders.pay_link_ready")}</div>
                  <div className="d-flex gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={generatedPayUrl}
                      className="linear-input font-monospace flex-grow-1"
                      style={{ fontSize: "0.74rem" }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={copiedPayUrl ? <IconCheck size={13} /> : <IconCopy size={13} />}
                      onClick={() => {
                        navigator.clipboard?.writeText(generatedPayUrl);
                        setCopiedPayUrl(true);
                        setTimeout(() => setCopiedPayUrl(false), 2000);
                      }}
                    >
                      {copiedPayUrl ? t("payments.copied") : t("payments.copy")}
                    </Button>
                  </div>
                </div>
              )}
              <div className="d-flex justify-content-end gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => setPayModalOrder(null)}>
                  {t("payments.close")}
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={paySending} icon={<IconCreditCard size={14} />}>
                  {t("orders.pay_submit")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
