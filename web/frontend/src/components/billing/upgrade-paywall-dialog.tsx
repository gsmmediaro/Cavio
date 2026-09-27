import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession, type CreditsInfo } from "@/api/client";
import { PlanCard } from "@/components/billing/plan-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CAVIO_PAID_PLAN_DEFS,
  CAVIO_PLANS,
  FEATURED_PLAN_ID,
  formatCentsAsUsd,
  priceForInterval,
  type BillingInterval,
} from "@/constants/plans";

type UpgradePaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credits: CreditsInfo | null;
  loadingCredits?: boolean;
  title?: string;
  description?: string;
};

/** Port of Notra GeoUpgradeDialog. Subscription cards + Monthly/Yearly toggle. */
export function UpgradePaywallDialog({
  open,
  onOpenChange,
  credits,
  loadingCredits = false,
  title = "Choose your plan",
  description = "Subscribe for monthly scan credits. One credit per OPG. Yearly saves 20%.",
}: UpgradePaywallDialogProps) {
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const interval: BillingInterval = isYearly ? "year" : "month";
  const intervalLabel = isYearly ? "year" : "mo";

  const paidPlans = useMemo(() => {
    const fromApi = credits?.plans?.filter((p) => p.id !== CAVIO_PLANS.FREE);
    if (fromApi && fromApi.length > 0) return fromApi;
    return CAVIO_PAID_PLAN_DEFS.map((p) => ({
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
  }, [credits]);

  const featuredId = credits?.featured_plan_id ?? FEATURED_PLAN_ID;
  const scanCost = Math.max(credits?.scan_cost ?? 1, 1);

  const handleSubscribe = async (planId: string) => {
    setBuyingPlan(planId);
    try {
      const { checkout_url } = await createCheckoutSession(planId, interval);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg, { description: "Stripe checkout could not start." });
      setBuyingPlan(null);
    }
  };

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="z-[60] flex max-h-[90svh] flex-col overflow-hidden pointer-events-auto sm:max-w-5xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex justify-center pb-2">
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          {loadingCredits && !credits ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {paidPlans.map((plan) => {
                const featured = plan.id === featuredId || Boolean(plan.featured);
                const cents = priceForInterval(plan, interval);
                const creditsMo = plan.credits_monthly ?? plan.credits;
                const scans = Math.floor(creditsMo / scanCost);
                const label =
                  buyingPlan === plan.id ? "Loading..." : "Subscribe";
                return (
                  <PlanCard
                    action={featured ? <Badge>Most popular</Badge> : undefined}
                    button={{
                      label,
                      disabled: buyingPlan !== null,
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
                          ? "Billed yearly. Save 20%."
                          : "Credits renew each month",
                      },
                      { text: "Cancel anytime" },
                    ]}
                    highlighted={false}
                    intervalLabel={intervalLabel}
                    key={plan.id}
                    name={plan.name}
                    priceLabel={formatCentsAsUsd(cents)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
