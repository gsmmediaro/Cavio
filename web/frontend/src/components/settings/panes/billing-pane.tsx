import { Badge } from "@notra/ui/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession, type CreditsInfo } from "@/api/client";
import { PlanCard } from "@/components/billing/plan-card";
import { UpgradePaywallDialog } from "@/components/billing/upgrade-paywall-dialog";
import { SettingsPane } from "@/components/settings/settings-pane";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type BillingPaneProps = {
  credits: CreditsInfo | null;
  creditsLoading: boolean;
};

/** Port of Notra BillingSettingsPane plan grid — Cavio single Stripe pack. */
export function BillingSettingsPane({ credits, creditsLoading }: BillingPaneProps) {
  const [buying, setBuying] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const handleBuy = async () => {
    setBuying(true);
    try {
      const { checkout_url } = await createCheckoutSession();
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg);
      setBuying(false);
    }
  };

  const packPrice = credits ? credits.pack_price_cents / 100 : 0;
  const packCredits = credits?.pack_credits ?? 0;
  const scanCost = Math.max(credits?.scan_cost ?? 1, 1);

  return (
    <SettingsPane>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Credit packs</p>
          <p className="text-muted-foreground text-xs">
            One-time Stripe purchase · no subscription
          </p>
        </div>
        <Button onClick={() => setPaywallOpen(true)} size="sm" variant="outline">
          Open paywall
        </Button>
      </div>

      {creditsLoading && !credits ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard
            button={{
              label: "Current",
              disabled: true,
              variant: "outline",
              onClick: () => undefined,
            }}
            description="Scan on demand. Buy credits when you need more."
            features={[
              { text: `${credits?.credits ?? 0} credits remaining` },
              { text: `${scanCost} credit per OPG scan` },
              { text: "Patient history included" },
            ]}
            name="Free"
            priceLabel="$0"
            intervalLabel="mo"
          />
          <PlanCard
            action={<Badge>Most popular</Badge>}
            button={{
              label: buying ? "Loading..." : `Get ${packCredits || ""} credits`.trim(),
              disabled: buying || !credits,
              variant: "cta",
              onClick: () => void handleBuy(),
            }}
            description="One-time credit pack. Credits never expire."
            featured
            features={[
              { text: `${packCredits} scan credits` },
              {
                text: `~${Math.floor(packCredits / scanCost)} OPG scans`,
                overageText: `${scanCost} credit per scan`,
              },
              { text: "Stripe checkout" },
              { text: "Stacks with current balance" },
            ]}
            intervalLabel="pack"
            name="Credit Pack"
            priceLabel={`$${packPrice.toFixed(packPrice % 1 === 0 ? 0 : 2)}`}
          />
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
