export interface ApiOptions extends RequestInit {
  orgId?: number | string;
}

export async function fetchApi<T = any>(path: string, options?: ApiOptions): Promise<T> {
  const currentOrgId =
    options?.orgId ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("org") ||
         sessionStorage.getItem("active_org_id") ||
         localStorage.getItem("active_org_id") ||
         "1")
      : "1");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Organization-Id": String(currentOrgId),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
    ...options,
    headers,
    cache: options?.cache || "no-store",
  });

  let rawText = "";
  try {
    rawText = await response.text();
  } catch {
    rawText = "";
  }

  let data: any = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    data = {};
  }

  if (!response.ok) {
    const errorDetail =
      data.detail ||
      (typeof data.message === "string" ? data.message : "") ||
      (rawText.length < 200 && rawText ? rawText : `HTTP ${response.status}`);
    throw new Error(errorDetail);
  }

  return data as T;
}

export interface PublicPlan {
  id: number;
  code: string;
  name: string;
  description: string;
  display_order: number;
  price_monthly: number;
  price_yearly: number;
  price_monthly_uzs: number;
  price_yearly_uzs: number;
  price_monthly_formatted: string;
  price_yearly_formatted: string;
  price_monthly_uzs_formatted: string;
  price_yearly_uzs_formatted: string;
  currency: string;
  is_featured: boolean;
  is_public: boolean;
  features: Record<string, any>;
  limits: Record<string, any>;
}

export interface CheckoutQuoteResponse {
  customer_id: number;
  customer_name: string;
  plan: {
    id: number;
    code: string;
    name: string;
  };
  billing_interval: string;
  currency: string;
  quote: {
    catalog_base_price_cents?: number | null;
    catalog_base_price_tiyin?: number | null;
    catalog_base_price_formatted: string;
    discount_amount_cents?: number | null;
    discount_amount_tiyin?: number | null;
    discount_amount_formatted: string;
    effective_price_cents?: number | null;
    effective_price_tiyin?: number | null;
    effective_price_formatted: string;
    discount_applied: boolean;
    price_source: string;
    discount_details?: {
      offer_id: number;
      discount_type: string;
      discount_value: number;
      starts_at: string;
      expires_at: string;
      notes?: string | null;
    } | null;
    renewal_policy: {
      will_change_on_renewal: boolean;
      upcoming_renewal_price: number;
      upcoming_renewal_price_formatted: string;
      explanation: string;
    };
    quote_generated_at: string;
    quote_expires_at: string;
  };
}

export async function getPublicPlans(
  currency: "USD" | "UZS" = "USD",
  billingCycle: "monthly" | "yearly" = "monthly"
): Promise<{ plans: PublicPlan[]; currency: string; billing_cycle: string }> {
  return fetchApi(`/api/plans?currency=${currency}&billing_cycle=${billingCycle}`, {
    cache: "no-store",
  });
}

export async function getCheckoutQuote(
  planCode: string,
  billingInterval: "monthly" | "yearly" = "monthly",
  currency: "USD" | "UZS" = "USD",
  orgId?: number | string
): Promise<CheckoutQuoteResponse> {
  return fetchApi(
    `/api/pricing/checkout-quote?plan_code=${encodeURIComponent(
      planCode
    )}&billing_interval=${encodeURIComponent(billingInterval)}&currency=${encodeURIComponent(
      currency
    )}`,
    {
      orgId,
      cache: "no-store",
    }
  );
}
