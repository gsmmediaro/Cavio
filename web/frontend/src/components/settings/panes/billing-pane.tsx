import { Badge } from "@notra/ui/components/ui/badge";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession, type CreditsInfo, type PlanInfo } from "@/api/client";
import { PlanCard } from "@/components/billing/plan-card";
import { UpgradePaywallDialog } from "@/components/billing/upgrade-paywall-dialog";
import { SettingsPane } from "@/components/settings/settings-pane";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CAVIO_PAID_PLAN_DEFS,
  CAVIO_PLAN_DEFS,
  CAVIO_PLANS,
  FEATURED_PLAN_ID,
  formatPlanPrice,
} from "@/constants/plans";

type BillingPaneProps = {
  credits: CreditsInfo | null;
  creditsLoading: boolean;
};

function mergePlans(credits: CreditsInfo | null): PlanInfo[] {
  const fromApi = credits?.plans;
  if (fromApi && fromApi.length > 0) return fromApi;
  return CAVIO_PLAN_DEFS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price_cents: p.priceCents,
    credits: p.credits,
    featured: Boolean(p.featured),
  }));
}

/** Port of Notra BillingSettingsPane plan grid — Cavio Free + Starter/Pro/Clinic packs. */
export function BillingSettingsPane({ credits, creditsLoading }: BillingPaneProps) {
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const plans = useMemo(() => mergePlans(credits), [credits]);
  const freePlan = plans.find((p) => p.id === CAVIO_PLANS.FREE);
  const paidPlans = plans.filter((p) => p.id !== CAVIO_PLANS.FREE);
  const featuredId = credits?.featured_plan_id ?? FEATURED_PLAN_ID;
  const scanCost = Math.max(credits?.scan_cost ?? 1, 1);

  const handleBuy = async (planId: string) => {
    if (planId === CAVIO_PLANS.FREE) return;
    setBuyingPlan(planId);
    try {
      const { checkout_url } = await createCheckoutSession(planId);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg);
      setBuyingPlan(null);
    }
  };

  return (
    <SettingsPane>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="scroll-mt-24 text-lg font-semibold" id="plans">
            Plans
          </h2>
          <p className="text-muted-foreground text-sm">
            Free to try, then one-time credit packs — no subscription. Credits never expire.
          </p>
        </div>
        <Button onClick={() => setPaywallOpen(true)} size="sm" variant="outline">
          Open paywall
        </Button>
      </div>

      {creditsLoading && !credits ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlanCard
            button={{
              label: "Current",
              disabled: true,
              variant: "outline",
              onClick: () => undefined,
            }}
            description={freePlan?.description ?? "Scan on demand. Buy credits when you need more."}
            features={[
              { text: `${credits?.credits ?? freePlan?.credits ?? 0} credits remaining` },
              { text: `${scanCost} credit per OPG scan` },
              { text: "Patient history included" },
              { text: "No card required" },
            ]}
            intervalLabel="mo"
            name={freePlan?.name ?? "Free"}
            priceLabel="$0"
          />

          {(paidPlans.length ? paidPlans : CAVIO_PAID_PLAN_DEFS.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price_cents: p.priceCents,
            credits: p.credits,
            featured: Boolean(p.featured),
          }))).map((plan) => {
            const featured = plan.id === featuredId || Boolean(plan.featured);
            const priceUsd = plan.price_cents / 100;
            const scans = Math.floor(plan.credits / scanCost);
            return (
              <PlanCard
                action={featured ? <Badge>Most popular</Badge> : undefined}
                button={{
                  label:
                    buyingPlan === plan.id
                      ? "Loading..."
                      : `Get ${plan.credits} credits`,
                  disabled: buyingPlan !== null,
                  variant: featured ? "cta" : "outline",
                  onClick: () => void handleBuy(plan.id),
                }}
                description={plan.description}
                featured={featured}
                features={[
                  { text: `${plan.credits} scan credits` },
                  {
                    text: `~${scans} OPG scans`,
                    overageText: `${scanCost} credit per scan`,
                  },
                  { text: "Credits never expire" },
                  { text: "Stripe checkout" },
                  ...(plan.id === CAVIO_PLANS.CLINIC
                    ? [{ text: "Priority support" }]
                    : [{ text: "Stacks with current balance" }]),
                ]}
                intervalLabel="pack"
                key={plan.id}
                name={plan.name}
                priceLabel={formatPlanPrice(priceUsd)}
              />
            );
          })}
        </div>
      )}

      <UpgradePaywallDialog
        credits={credits}
        loadingCredits={creditsLoading}
        onOpenChange={setPaywallOpen}
        open={paywallOpen}
      />
    </SettingsPane>
  );
}
