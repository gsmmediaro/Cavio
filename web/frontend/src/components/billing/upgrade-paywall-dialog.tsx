import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession, type CreditsInfo } from "@/api/client";
import { PlanCard } from "@/components/billing/plan-card";
import { Skeleton } from "@/components/ui/skeleton";

type UpgradePaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credits: CreditsInfo | null;
  loadingCredits?: boolean;
  title?: string;
  description?: string;
};

/**
 * Port of Notra GeoUpgradeDialog / billing plan grid.
 * Cavio: single Stripe credit pack as featured plan card (green CTA).
 */
export function UpgradePaywallDialog({
  open,
  onOpenChange,
  credits,
  loadingCredits = false,
  title = "Upgrade your credits",
  description = "Buy a credit pack to keep running OPG caries scans. One credit per scan.",
}: UpgradePaywallDialogProps) {
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    setBuying(true);
    try {
      const { checkout_url } = await createCheckoutSession();
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg, { description: "Stripe checkout could not start." });
      setBuying(false);
    }
  };

  const packPrice = credits ? credits.pack_price_cents / 100 : 0;
  const packCredits = credits?.pack_credits ?? 0;
  const scanCost = Math.max(credits?.scan_cost ?? 1, 1);

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="flex max-h-[90svh] flex-col overflow-hidden sm:max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          {loadingCredits && !credits ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-80 rounded-lg" />
              <Skeleton className="h-80 rounded-lg" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <PlanCard
                button={{
                  label: "Current plan",
                  disabled: true,
                  variant: "outline",
                  onClick: () => undefined,
                }}
                description="Pay as you go — scan when you need, buy credits when you run out."
                features={[
                  { text: `${credits?.credits ?? 0} credits remaining` },
                  { text: `${scanCost} credit per OPG scan` },
                  { text: "History & patient records" },
                  { text: "No subscription required" },
                ]}
                highlighted={false}
                name="Free"
                priceLabel="$0"
                intervalLabel="mo"
              />
              <PlanCard
                action={<Badge>Most popular</Badge>}
                button={{
                  label: buying
                    ? "Loading..."
                    : credits
                      ? `Get ${packCredits} credits`
                      : "Buy credits",
                  disabled: buying || !credits,
                  variant: "cta",
                  onClick: () => void handleBuy(),
                }}
                description="One-time credit pack via Stripe. Credits never expire."
                featured
                features={[
                  { text: `${packCredits} scan credits` },
                  {
                    text: `~${Math.floor(packCredits / scanCost)} OPG scans`,
                    overageText: `${scanCost} credit per scan`,
                  },
                  { text: "Instant Stripe checkout" },
                  { text: "Works with existing balance" },
                ]}
                highlighted={false}
                intervalLabel="pack"
                name="Credit Pack"
                priceLabel={`$${packPrice.toFixed(packPrice % 1 === 0 ? 0 : 2)}`}
              />
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
