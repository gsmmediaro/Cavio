import { Badge } from "@notra/ui/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
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
  formatCentsAsUsd,
  priceForInterval,
  type BillingInterval,
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
    price_cents: p.priceCentsMonthly,
    price_cents_monthly: p.priceCentsMonthly,
    price_cents_yearly: p.priceCentsMonthly * 10,
    credits: p.creditsMonthly,
    credits_monthly: p.creditsMonthly,
    featured: Boolean(p.featured),
  }));
}

/** Port of Notra BillingSettingsPane — Monthly/Yearly toggle + Subscribe CTAs. */
export function BillingSettingsPane({ credits, creditsLoading }: BillingPaneProps) {
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(false);

  const interval: BillingInterval = isYearly ? "year" : "month";
  const intervalLabel = isYearly ? "year" : "mo";

  const plans = useMemo(() => mergePlans(credits), [credits]);
  const freePlan = plans.find((p) => p.id === CAVIO_PLANS.FREE);
  const paidPlans = plans.filter((p) => p.id !== CAVIO_PLANS.FREE);
  const featuredId = credits?.featured_plan_id ?? FEATURED_PLAN_ID;
  const scanCost = Math.max(credits?.scan_cost ?? 1, 1);
  const activePlanId = credits?.subscription_plan_id || "";
  const activeInterval = credits?.subscription_interval || "";

  const handleSubscribe = async (planId: string) => {
    if (planId === CAVIO_PLANS.FREE) return;
    setBuyingPlan(planId);
    try {
      const { checkout_url } = await createCheckoutSession(planId, interval);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg);
      setBuyingPlan(null);
    }
  };

  const paidSource =
    paidPlans.length > 0
      ? paidPlans
      : CAVIO_PAID_PLAN_DEFS.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price_cents: p.priceCentsMonthly,
          price_cents_monthly: p.priceCentsMonthly,
          price_cents_yearly: p.priceCentsMonthly * 10,
          credits: p.creditsMonthly,
          credits_monthly: p.creditsMonthly,
          featured: Boolean(p.featured),
        }));

  return (
    <SettingsPane>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="scroll-mt-24 text-lg font-semibold" id="plans">
            Plans
          </h2>
          <p className="text-muted-foreground text-sm">
            Subscribe for monthly scan credits. Yearly bills 10× monthly — Save 20%.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            onValueChange={(v) => setIsYearly(v === "yearly")}
            value={isYearly ? "yearly" : "monthly"}
          >
            <TabsList aria-label="Billing interval">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger className="flex items-center gap-1.5" value="yearly">
                Yearly
                <Badge className="text-[10px]" variant="secondary">
                  Save 20%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setPaywallOpen(true)} size="sm" variant="outline">
            Open paywall
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Your plan renews automatically every {isYearly ? "year" : "month"} until you cancel.
      </p>

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
              label: !activePlanId ? "Current" : "Free",
              disabled: true,
              variant: "outline",
              onClick: () => undefined,
            }}
            description={
              freePlan?.description ?? "Scan on demand. Subscribe when you need more."
            }
            features={[
              { text: `${credits?.credits ?? freePlan?.credits ?? 0} credits remaining` },
              { text: `${scanCost} credit per OPG scan` },
              { text: "Patient history included" },
              { text: "No card required" },
            ]}
            highlighted={!activePlanId}
            intervalLabel="mo"
            name={freePlan?.name ?? "Free"}
            priceLabel="$0"
          />

          {paidSource.map((plan) => {
            const featured = plan.id === featuredId || Boolean(plan.featured);
            const cents = priceForInterval(plan, interval);
            const creditsMo = plan.credits_monthly ?? plan.credits;
            const scans = Math.floor(creditsMo / scanCost);
            const isCurrent =
              activePlanId === plan.id &&
              (!activeInterval || activeInterval === interval);
            const subscribeLabel =
              buyingPlan === plan.id
                ? "Loading..."
                : isCurrent
                  ? "Current Plan"
                  : "Subscribe";
            return (
              <PlanCard
                action={
                  isCurrent ? (
                    <Badge>Current</Badge>
                  ) : featured ? (
                    <Badge>Most popular</Badge>
                  ) : undefined
                }
                button={{
                  label: subscribeLabel,
                  disabled: buyingPlan !== null || isCurrent,
                  variant: featured ? "cta" : "outline",
                  onClick: () => void handleSubscribe(plan.id),
                }}
                description={plan.description}
                featured={featured}
                features={[
                  { text: `${creditsMo} scan credits / mo` },
                  {
                    text: `~${scans} OPG scans / mo`,
                    overageText: `${scanCost} credit per scan`,
                  },
                  {
                    text: isYearly
                      ? `${creditsMo * 12} credits granted on yearly payment`
                      : "Credits renew each month",
                  },
                  { text: "Cancel anytime" },
                  ...(plan.id === CAVIO_PLANS.CLINIC
                    ? [{ text: "Priority support" }]
                    : []),
                ]}
                highlighted={isCurrent}
                intervalLabel={intervalLabel}
                key={plan.id}
                name={plan.name}
                priceLabel={formatCentsAsUsd(cents)}
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
