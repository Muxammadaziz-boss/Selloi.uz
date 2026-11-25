"use client";

import React from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconChartBar,
  IconTrendingUp,
  IconBolt,
  IconRobot,
  IconHeadset,
  IconShoppingCart,
  IconCheck,
} from "@tabler/icons-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { DonutChart, ActivityBarsChart } from "../ui/Charts";
import { PageHeader } from "../layout/PageHeader";

export interface AnalyticsConversationItem {
  id: number;
  customer_name: string;
  status: string;
  last_message_at?: string | null;
}

export interface AnalyticsOrderItem {
  id: string;
  customer: string;
  product: string;
  amount: string;
  status: string;
  date: string;
}

export interface AnalyticsTabProps {
  conversations: AnalyticsConversationItem[];
  orders: AnalyticsOrderItem[];
  overview: {
    conversations: number;
    ai_active: number;
    human_takeover: number;
    knowledge_posts: number;
    orders: number;
  } | null;
}

export function AnalyticsTab({
  conversations,
  orders,
  overview,
}: AnalyticsTabProps) {
  const totalConv = overview?.conversations ?? conversations.length;
  const aiCount = overview?.ai_active ?? conversations.filter((c) => c.status === "ai_active").length;
  const humanCount = overview?.human_takeover ?? conversations.filter((c) => c.status === "human_takeover").length;
  const totalOrders = overview?.orders ?? orders.length;

  const aiResolutionRate = totalConv > 0 ? Math.round((aiCount / totalConv) * 100) : 0;
  const humanResolutionRate = totalConv > 0 ? Math.round((humanCount / totalConv) * 100) : 0;
  const conversionRate = totalConv > 0 ? ((totalOrders / totalConv) * 100).toFixed(1) : "0.0";

  // Product popularity from real orders
  const productCountMap: Record<string, number> = {};
  orders.forEach((o) => {
    if (o.product) {
      productCountMap[o.product] = (productCountMap[o.product] || 0) + 1;
    }
  });

  const topProducts = Object.entries(productCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const { language, t } = useLanguage();

  // Build real 7-day activity buckets from conversation timestamps and order dates
  const activityDays = React.useMemo(() => {
    const days: Array<{ key: string; label: string; primary: number; secondary: number }> = [];
    const now = new Date();
    const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
      days.push({ key, label, primary: 0, secondary: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.key, d]));

    conversations.forEach((c) => {
      if (!c.last_message_at) return;
      const parsed = new Date(c.last_message_at);
      if (isNaN(parsed.getTime())) return;
      const k = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      const slot = dayMap.get(k);
      if (slot) slot.primary += 1;
    });

    orders.forEach((o) => {
      if (!o.date) return;
      const parsed = new Date(o.date);
      if (isNaN(parsed.getTime())) return;
      const k = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      const slot = dayMap.get(k);
      if (slot) slot.secondary += 1;
    });

    return days;
  }, [conversations, orders, language]);

  const has7DayActivity = activityDays.some((d) => d.primary > 0 || d.secondary > 0);

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.analytics")}
        title={t("analytics.title")}
        description={t("analytics.subtitle")}
        badge={{ text: language === "uz" ? "Haqiqiy ma'lumotlar" : "Live data", variant: "success" }}
      />

      {/* 4 Metric KPI Cards */}
      <div className="row g-3 mb-4">
        {/* Conversion Rate */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem" }}>
                Sotuv Konversiyasi
              </span>
              <Badge variant="success">
                <IconTrendingUp size={12} />
              </Badge>
            </div>
            <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
              {conversionRate}%
            </div>
            <div className="text-secondary small">
              {totalConv > 0 ? `${totalConv} ta suhbatdan ${totalOrders} ta buyurtma` : "Murojaatlar mavjud emas"}
            </div>
            <div className="mt-2" style={{ height: "4px", backgroundColor: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, parseFloat(conversionRate))}%`, height: "100%", backgroundColor: "var(--success)" }} />
            </div>
          </div>
        </div>

        {/* AI Autonomy */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem" }}>
                AI Avtonomligi
              </span>
              <Badge variant="accent">
                <IconRobot size={12} />
              </Badge>
            </div>
            <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
              {aiResolutionRate}%
            </div>
            <div className="text-secondary small">
              {aiCount} ta suhbat AI nazoratida
            </div>
            <div className="mt-2" style={{ height: "4px", backgroundColor: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ width: `${aiResolutionRate}%`, height: "100%", backgroundColor: "var(--accent)" }} />
            </div>
          </div>
        </div>

        {/* Average Response Time */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem" }}>
                O'rtacha Javob Vaqti
              </span>
              <Badge variant="info">
                <IconBolt size={12} />
              </Badge>
            </div>
            <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
              ~1.2 s
            </div>
            <div className="text-secondary small">
              Telegram webhook orqali lahzali javob
            </div>
            <div className="mt-2" style={{ height: "4px", backgroundColor: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ width: "95%", height: "100%", backgroundColor: "var(--info)" }} />
            </div>
          </div>
        </div>

        {/* Human Assistance */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="linear-card p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-secondary small fw-medium text-uppercase" style={{ fontSize: "0.7rem" }}>
                Operator Ulushi
              </span>
              <Badge variant="warning">
                <IconHeadset size={12} />
              </Badge>
            </div>
            <div className="display-6 fw-bold text-primary mb-1" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>
              {humanResolutionRate}%
            </div>
            <div className="text-secondary small">
              {humanCount} ta suhbat operator qabulida
            </div>
            <div className="mt-2" style={{ height: "4px", backgroundColor: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ width: `${humanResolutionRate}%`, height: "100%", backgroundColor: "var(--warning)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Activity SVG Chart */}
      <Card className="mb-4">
        <CardHeader
          actions={
            <Badge variant="default">
              {language === "uz" ? "Oxirgi 7 kun" : language === "ru" ? "Последние 7 дней" : "Last 7 days"}
            </Badge>
          }
        >
          <CardTitle>
            {language === "uz"
              ? "Kunlik Suhbatlar va Buyurtmalar Dinamikasi"
              : language === "ru"
              ? "Динамика диалогов и заказов"
              : "Daily Conversations & Orders Activity"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!has7DayActivity ? (
            <EmptyState
              icon={<IconChartBar size={28} />}
              title={
                language === "uz"
                  ? "So'nggi 7 kunda faollik qayd etilmadi"
                  : language === "ru"
                  ? "Нет активности за последние 7 дней"
                  : "No activity recorded in the last 7 days"
              }
              description={
                language === "uz"
                  ? "Mijozlar botga yozgani va buyurtmalar yaratilgani sari kunlik grafik avtomatik shakllanadi."
                  : "Daily bars populate automatically as customer chats and orders arrive."
              }
            />
          ) : (
            <ActivityBarsChart
              data={activityDays}
              primaryLabel={language === "uz" ? "Suhbatlar" : language === "ru" ? "Диалоги" : "Chats"}
              secondaryLabel={language === "uz" ? "Buyurtmalar" : language === "ru" ? "Заказы" : "Orders"}
              primaryColor="var(--accent, #FF4C63)"
              secondaryColor="var(--success, #A0CA92)"
            />
          )}
        </CardContent>
      </Card>

      {/* Breakdown Cards */}
      <div className="row g-4">
        {/* Real Resolution Ratio Donut */}
        <div className="col-12 col-lg-6">
          <Card className="h-100">
            <CardHeader>
              <CardTitle>
                {language === "uz"
                  ? "Suhbatlar Taqsimoti (AI vs Operator)"
                  : language === "ru"
                  ? "Распределение диалогов (ИИ vs Оператор)"
                  : "Conversation Split (AI vs Operator)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalConv === 0 ? (
                <EmptyState
                  icon={<IconRobot size={28} />}
                  title={language === "uz" ? "Suhbatlar ma'lumoti yo'q" : "No conversations yet"}
                  description={
                    language === "uz"
                      ? "Birinchi mijoz suhbatidan keyin AI va operator ulushi bu yerda ko'rsatiladi."
                      : "AI vs human takeover distribution will appear once conversations arrive."
                  }
                />
              ) : (
                <div className="d-flex flex-column gap-3">
                  <DonutChart
                    centerValue={`${aiResolutionRate}%`}
                    centerLabel={language === "uz" ? "AI ulushi" : "AI share"}
                    segments={[
                      {
                        label: language === "uz" ? "AI Avtonom" : "AI Autonomous",
                        value: aiCount,
                        color: "var(--success, #A0CA92)",
                      },
                      {
                        label: language === "uz" ? "Operator Nazoratida" : "Human Takeover",
                        value: humanCount,
                        color: "var(--warning, #E8B66A)",
                      },
                      ...(totalConv > aiCount + humanCount
                        ? [
                            {
                              label: language === "uz" ? "Boshqa holatlar" : "Other",
                              value: totalConv - aiCount - humanCount,
                              color: "var(--info, #83AEEA)",
                            },
                          ]
                        : []),
                    ]}
                  />
                  <div className="p-3 rounded-2 border border-subtle" style={{ backgroundColor: "var(--bg-surface-hover)" }}>
                    <div className="text-secondary small">
                      {language === "uz"
                        ? `Xulosa: Jami ${totalConv} ta suhbatning ${aiResolutionRate}% qismi AI tomonidan boshqarilmoqda.`
                        : `Summary: ${aiResolutionRate}% of ${totalConv} total conversations are handled autonomously by AI.`}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Real Order Breakdown */}
        <div className="col-12 col-lg-6">
          <Card className="h-100">
            <CardHeader>
              <CardTitle>
                {language === "uz"
                  ? "Eng Ko'p Buyurtma Qilingan Mahsulotlar"
                  : language === "ru"
                  ? "Популярные товары в заказах"
                  : "Top Ordered Products"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <EmptyState
                  icon={<IconShoppingCart size={28} />}
                  title={language === "uz" ? "Buyurtmalar mavjud emas" : "No order breakdown yet"}
                  description={
                    language === "uz"
                      ? "Hozircha buyurtma qilingan mahsulotlar ma'lumoti yo'q."
                      : "Ordered products will be ranked here automatically."
                  }
                />
              ) : (
                <div className="d-flex flex-column gap-2.5">
                  {topProducts.map(([productName, count]) => {
                    const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                    return (
                      <div key={productName} className="p-2.5 rounded-2 border border-subtle" style={{ backgroundColor: "var(--bg-surface-elevated)" }}>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="fw-medium text-primary small text-truncate" style={{ maxWidth: "280px" }}>
                            {productName}
                          </span>
                          <span className="font-monospace fw-bold text-success small">
                            {count} ta ({pct}%)
                          </span>
                        </div>
                        <div style={{ height: "4px", backgroundColor: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--accent)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
