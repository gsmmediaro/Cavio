import { CreditCardIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession, type CreditsInfo } from "@/api/client";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";
import { Skeleton } from "@/components/ui/skeleton";
import { CAVIO_TOPUP_PRESETS, type CavioPlanId } from "@/constants/plans";

type CreditTopupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credits: CreditsInfo | null;
  loadingCredits?: boolean;
  success?: boolean;
};

/** Port of Notra CreditTopupModal — Cavio multi-pack Stripe checkout. */
export function CreditTopupModal({
  open,
  onOpenChange,
  credits,
  loadingCredits = false,
  success = false,
}: CreditTopupModalProps) {
  const [buying, setBuying] = useState(false);
  const [selected, setSelected] = useState<CavioPlanId>("pro");

  const handleBuy = async () => {
    setBuying(true);
    try {
      const { checkout_url } = await createCheckoutSession(selected);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      toast.error(msg, { description: "Stripe checkout could not start." });
      setBuying(false);
    }
  };

  const preset = CAVIO_TOPUP_PRESETS.find((p) => p.planId === selected) ?? CAVIO_TOPUP_PRESETS[1];
  const balanceHint = credits
    ? String(credits.scan_cost) + " credit per OPG scan"
    : "Sign in to view balance";
  const ctaLabel = buying
    ? "Redirecting..."
    : "Buy " + String(preset.credits) + " credits (" + preset.label + ")";

  if (success) {
    return (
      <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <HugeiconsIcon className="text-primary size-12" icon={Tick02Icon} />
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Credits Added!</h2>
              <p className="text-muted-foreground text-sm">
                Your scan credits have been topped up and are ready to use.
              </p>
            </div>
            <Button className="mt-2" onClick={() => onOpenChange(false)} size="sm">
              Continue
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog onOpenChange={onOpenChange} open={open}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <HugeiconsIcon className="size-5" icon={CreditCardIcon} />
            Top Up Credits
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose a Cavio credit pack: Starter, Pro, or Clinic.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {loadingCredits && !credits ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="bg-muted/60 ring-foreground/10 rounded-lg px-4 py-3 ring-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Current balance
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {credits ? credits.credits : "-"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">{balanceHint}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Select pack</p>
              <div className="grid grid-cols-3 gap-2">
                {CAVIO_TOPUP_PRESETS.map((p) => (
                  <button
                    className={cn(
                      "rounded-lg border py-2.5 text-sm font-medium transition-colors",
                      selected === p.planId
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-accent",
                    )}
                    disabled={buying}
                    key={p.planId}
                    onClick={() => setSelected(p.planId)}
                    type="button"
                  >
                    <div>{p.label}</div>
                    <div className="text-muted-foreground text-[10px] font-normal">
                      {p.credits} credits
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <CtaButton
              className="h-11 w-full"
              disabled={buying || !credits}
              onClick={() => void handleBuy()}
            >
              {ctaLabel}
            </CtaButton>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
