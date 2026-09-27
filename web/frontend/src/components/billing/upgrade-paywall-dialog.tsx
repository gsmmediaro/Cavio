import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession, type CreditsInfo } from "@/api/client";
import { PlanCard } from "@/components/billing/plan-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CAVIO_PAID_PLAN_DEFS,
  CAVIO_PLANS,
  FEATURED_PLAN_ID,
  formatPlanPrice,
} from "@/constants/plans";

type UpgradePaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credits: CreditsInfo | null;
  loadingCredits?: boolean;
  title?: string;
  description?: string;
};

/** Port of Notra GeoUpgradeDialog — Cavio Starter/Pro/Clinic packs. */
export function UpgradePaywallDialog({
  open,
  onOpenChange,
  credits,
  loadingCredits = false,
  title = "Upgrade your credits",
  description = "Pick a credit pack to keep running OPG caries scans. One credit per scan.",
}: UpgradePaywallDialogProps) {
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);

  const paidPlans = useMemo(() => {
    const fromApi = credits?.plans?.filter((p) => p.id !== CAVIO_PLANS.FREE);
    if (fromApi && fromApi.length > 0) return fromApi;
    return CAVIO_PAID_PLAN_DEFS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price_cents: p.priceCents,
      credits: p.credits,
      featured: Boolean(p.featured),
    }));
  }, [credits]);

  const featuredId = credits?.featured_plan_id ?? FEATURED_PLAN_ID;
  const scanCost = Math.max(credits?.scan_cost ?? 1, 1);

  const handleBuy = async (planId: string) => {
    setBuyingPlan(planId);
    try {
      const { checkout_url } = await createCheckoutSession(planId);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg, { description: "Stripe checkout could not start." });
      setBuyingPlan(null);
    }
  };

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="flex max-h-[90svh] flex-col overflow-hidden sm:max-w-5xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

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
                const priceUsd = plan.price_cents / 100;
                const scans = Math.floor(plan.credits / scanCost);
                const buyLabel =
                  buyingPlan === plan.id
                    ? "Loading..."
                    : "Get " + String(plan.credits) + " credits";
                return (
                  <PlanCard
                    action={featured ? <Badge>Most popular</Badge> : undefined}
                    button={{
                      label: buyLabel,
                      disabled: buyingPlan !== null,
                      variant: featured ? "cta" : "outline",
                      onClick: () => void handleBuy(plan.id),
                    }}
                    description={plan.description}
                    featured={featured}
                    features={[
                      { text: String(plan.credits) + " scan credits" },
                      {
                        text: "~" + String(scans) + " OPG scans",
                        overageText: String(scanCost) + " credit per scan",
                      },
                      { text: "Credits never expire" },
                      { text: "Instant Stripe checkout" },
                    ]}
                    highlighted={false}
                    intervalLabel="pack"
                    key={plan.id}
                    name={plan.name}
                    priceLabel={formatPlanPrice(priceUsd)}
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
