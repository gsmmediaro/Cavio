/**
 * Cavio pricing — Notra-style recurring subscriptions via Stripe.
 *
 * Notra SoT (apps/dashboard + packages/ai/billing/features):
 *   Free + paid Starter / Growth (featured) / Scale
 *   Monthly/Yearly toggle (yearly ≈ 10× month / Save 20%)
 *
 * Cavio adaptation:
 *   Free + Starter / Pro (featured) / Clinic — Stripe mode=subscription
 *   Each plan grants monthly scan credits; yearly bills 10× monthly.
 */

export const CAVIO_PLANS = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  CLINIC: "clinic",
} as const;

export type CavioPlanId = (typeof CAVIO_PLANS)[keyof typeof CAVIO_PLANS];

export type BillingInterval = "month" | "year";

export const FEATURED_PLAN_ID: CavioPlanId = CAVIO_PLANS.PRO;

/** Yearly = 10 × monthly (Save 20% / 2 months free). */
export const YEARLY_MONTHS_BILLED = 10;

export type CavioPlanDef = {
  id: CavioPlanId;
  name: string;
  description: string;
  /** Monthly price in USD. Free is 0. */
  priceUsdMonthly: number;
  priceCentsMonthly: number;
  /** Monthly credit allotment granted/reset on invoice. */
  creditsMonthly: number;
  featured?: boolean;
  stripePriceEnvMonthly: string;
  stripePriceEnvYearly: string;
  features: { text: string; overageText?: string }[];
  /** @deprecated use priceUsdMonthly */
  priceUsd: number;
  /** @deprecated use priceCentsMonthly */
  priceCents: number;
  /** @deprecated use creditsMonthly */
  credits: number;
  /** @deprecated use stripePriceEnvMonthly */
  stripePriceEnv: string;
};

export const CAVIO_PLAN_DEFS: CavioPlanDef[] = [
  {
    id: CAVIO_PLANS.FREE,
    name: "Free",
    description: "Try Cavio on a few OPGs. Subscribe when you need more.",
    priceUsdMonthly: 0,
    priceCentsMonthly: 0,
    creditsMonthly: 3,
    stripePriceEnvMonthly: "",
    stripePriceEnvYearly: "",
    priceUsd: 0,
    priceCents: 0,
    credits: 3,
    stripePriceEnv: "",
    features: [
      { text: "3 signup scan credits" },
      { text: "1 credit per OPG scan" },
      { text: "Patient history included" },
      { text: "No card required" },
    ],
  },
  {
    id: CAVIO_PLANS.STARTER,
    name: "Starter",
    description: "For solo dentists screening a handful of OPGs each week.",
    priceUsdMonthly: 19,
    priceCentsMonthly: 1900,
    creditsMonthly: 25,
    stripePriceEnvMonthly: "STRIPE_PRICE_ID_STARTER",
    stripePriceEnvYearly: "STRIPE_PRICE_ID_STARTER_YEARLY",
    priceUsd: 19,
    priceCents: 1900,
    credits: 25,
    stripePriceEnv: "STRIPE_PRICE_ID_STARTER",
    features: [
      { text: "25 scan credits / mo" },
      { text: "~25 OPG scans / mo", overageText: "1 credit per scan" },
      { text: "Credits renew each billing period" },
      { text: "Cancel anytime" },
    ],
  },
  {
    id: CAVIO_PLANS.PRO,
    name: "Pro",
    description: "For busy chairs running regular panoramic caries screening.",
    priceUsdMonthly: 49,
    priceCentsMonthly: 4900,
    creditsMonthly: 80,
    featured: true,
    stripePriceEnvMonthly: "STRIPE_PRICE_ID_PRO",
    stripePriceEnvYearly: "STRIPE_PRICE_ID_PRO_YEARLY",
    priceUsd: 49,
    priceCents: 4900,
    credits: 80,
    stripePriceEnv: "STRIPE_PRICE_ID_PRO",
    features: [
      { text: "80 scan credits / mo" },
      { text: "~80 OPG scans / mo", overageText: "1 credit per scan" },
      { text: "Best value per scan" },
      { text: "Credits renew each billing period" },
      { text: "Cancel anytime" },
    ],
  },
  {
    id: CAVIO_PLANS.CLINIC,
    name: "Clinic",
    description: "For multi-chair clinics and high OPG volume.",
    priceUsdMonthly: 149,
    priceCentsMonthly: 14900,
    creditsMonthly: 250,
    stripePriceEnvMonthly: "STRIPE_PRICE_ID_CLINIC",
    stripePriceEnvYearly: "STRIPE_PRICE_ID_CLINIC_YEARLY",
    priceUsd: 149,
    priceCents: 14900,
    credits: 250,
    stripePriceEnv: "STRIPE_PRICE_ID_CLINIC",
    features: [
      { text: "250 scan credits / mo" },
      { text: "~250 OPG scans / mo", overageText: "1 credit per scan" },
      { text: "Lowest cost per scan" },
      { text: "Credits renew each billing period" },
      { text: "Priority support" },
    ],
  },
];

export const CAVIO_PAID_PLAN_DEFS = CAVIO_PLAN_DEFS.filter((p) => p.id !== CAVIO_PLANS.FREE);

/** Optional top-up still routes to the same subscription checkout (primary path = Subscribe). */
export const CAVIO_TOPUP_PRESETS = [
  { planId: CAVIO_PLANS.STARTER as CavioPlanId, label: "$19/mo", credits: 25, priceCents: 1900 },
  { planId: CAVIO_PLANS.PRO as CavioPlanId, label: "$49/mo", credits: 80, priceCents: 4900 },
  { planId: CAVIO_PLANS.CLINIC as CavioPlanId, label: "$149/mo", credits: 250, priceCents: 14900 },
] as const;

export function getPlanDef(planId: string): CavioPlanDef | undefined {
  return CAVIO_PLAN_DEFS.find((p) => p.id === planId);
}

export function yearlyPriceCents(monthlyCents: number): number {
  return monthlyCents * YEARLY_MONTHS_BILLED;
}

export function yearlyPriceUsd(monthlyUsd: number): number {
  return monthlyUsd * YEARLY_MONTHS_BILLED;
}

export function priceForInterval(
  plan: { price_cents?: number; price_cents_monthly?: number; price_cents_yearly?: number; priceCentsMonthly?: number },
  interval: BillingInterval,
): number {
  const monthly =
    plan.price_cents_monthly ??
    plan.priceCentsMonthly ??
    plan.price_cents ??
    0;
  if (interval === "year") {
    return plan.price_cents_yearly ?? yearlyPriceCents(monthly);
  }
  return monthly;
}

export function formatPlanPrice(priceUsd: number): string {
  if (priceUsd === 0) return "$0";
  return `$${priceUsd % 1 === 0 ? priceUsd.toFixed(0) : priceUsd.toFixed(2)}`;
}

export function formatCentsAsUsd(cents: number): string {
  return formatPlanPrice(cents / 100);
}
