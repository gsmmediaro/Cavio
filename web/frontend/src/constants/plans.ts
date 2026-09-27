/**
 * Cavio pricing — adapted from Notra (usenotra) multi-tier pattern.
 *
 * Notra SoT (apps/dashboard + packages/ai/billing/features):
 *   Free + paid Starter / Growth (featured) / Scale (+ Enterprise landing)
 *   Monthly/Yearly toggle, ZDR add-on, separate AI credit top-up presets [$5,$10,$25,$50]
 *
 * Cavio adaptation (credit packs via Stripe Checkout TEST, not Autumn subscriptions):
 *   Free + Starter / Pro (featured) / Clinic — one-time scan credit packs
 *   Top-up presets mirror Notra grid for extra packs
 */

export const CAVIO_PLANS = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  CLINIC: "clinic",
} as const;

export type CavioPlanId = (typeof CAVIO_PLANS)[keyof typeof CAVIO_PLANS];

export const FEATURED_PLAN_ID: CavioPlanId = CAVIO_PLANS.PRO;

export type CavioPlanDef = {
  id: CavioPlanId;
  name: string;
  description: string;
  /** Display price in USD (one-time pack). Free is 0. */
  priceUsd: number;
  priceCents: number;
  credits: number;
  featured?: boolean;
  /** Env var holding Stripe Price id (price_...). Empty → checkout uses price_data. */
  stripePriceEnv: string;
  features: { text: string; overageText?: string }[];
};

/** Signup / free allowance comes from SIGNUP_BONUS_CREDITS on the API (default 3). */
export const CAVIO_PLAN_DEFS: CavioPlanDef[] = [
  {
    id: CAVIO_PLANS.FREE,
    name: "Free",
    description: "Try Cavio on a few OPGs. Buy a pack when you need more.",
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
    priceUsd: 19,
    priceCents: 1900,
    credits: 25,
    stripePriceEnv: "STRIPE_PRICE_ID_STARTER",
    features: [
      { text: "25 scan credits" },
      { text: "~25 OPG scans", overageText: "1 credit per scan" },
      { text: "Credits never expire" },
      { text: "Stripe checkout" },
    ],
  },
  {
    id: CAVIO_PLANS.PRO,
    name: "Pro",
    description: "For busy chairs running regular panoramic caries screening.",
    priceUsd: 49,
    priceCents: 4900,
    credits: 80,
    featured: true,
    stripePriceEnv: "STRIPE_PRICE_ID_PRO",
    features: [
      { text: "80 scan credits" },
      { text: "~80 OPG scans", overageText: "1 credit per scan" },
      { text: "Best value per scan" },
      { text: "Credits never expire" },
      { text: "Stripe checkout" },
    ],
  },
  {
    id: CAVIO_PLANS.CLINIC,
    name: "Clinic",
    description: "For multi-chair clinics and high OPG volume.",
    priceUsd: 149,
    priceCents: 14900,
    credits: 250,
    stripePriceEnv: "STRIPE_PRICE_ID_CLINIC",
    features: [
      { text: "250 scan credits" },
      { text: "~250 OPG scans", overageText: "1 credit per scan" },
      { text: "Lowest cost per scan" },
      { text: "Credits never expire" },
      { text: "Priority support" },
    ],
  },
];

/** Paid tiers only — Notra-style 3-card grid (Starter / Pro / Clinic). */
export const CAVIO_PAID_PLAN_DEFS = CAVIO_PLAN_DEFS.filter((p) => p.id !== CAVIO_PLANS.FREE);

/** Top-up preset packs (mirror Notra TOPUP_PRESETS dollar grid, mapped to Cavio packs). */
export const CAVIO_TOPUP_PRESETS = [
  { planId: CAVIO_PLANS.STARTER as CavioPlanId, label: "$19", credits: 25, priceCents: 1900 },
  { planId: CAVIO_PLANS.PRO as CavioPlanId, label: "$49", credits: 80, priceCents: 4900 },
  { planId: CAVIO_PLANS.CLINIC as CavioPlanId, label: "$149", credits: 250, priceCents: 14900 },
] as const;

export function getPlanDef(planId: string): CavioPlanDef | undefined {
  return CAVIO_PLAN_DEFS.find((p) => p.id === planId);
}

export function formatPlanPrice(priceUsd: number): string {
  if (priceUsd === 0) return "$0";
  return `$${priceUsd % 1 === 0 ? priceUsd.toFixed(0) : priceUsd.toFixed(2)}`;
}
