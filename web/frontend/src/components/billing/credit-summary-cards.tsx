import { TitleCard } from "@notra/ui/components/ui/title-card";
import { cn } from "@notra/ui/lib/utils";
import type { ReactNode } from "react";

import type { CreditsInfo } from "@/api/client";
import { Skeleton } from "@/components/ui/skeleton";

type CreditSummaryCardsProps = {
  credits: CreditsInfo | null;
  isLoading?: boolean;
  balanceAction?: ReactNode;
};

/** Port of Notra CreditSummaryCards — Cavio Stripe credits balance. */
export function CreditSummaryCards({
  credits,
  isLoading = false,
  balanceAction,
}: CreditSummaryCardsProps) {
  if (isLoading && !credits) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  const balance = credits?.credits ?? null;
  const pack = credits?.pack_credits ?? null;
  const scanCost = credits?.scan_cost ?? 1;
  const usagePercent =
    pack && pack > 0 && balance !== null
      ? Math.min(Math.max(((pack - Math.min(balance, pack)) / pack) * 100, 0), 100)
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <TitleCard
        accentColor="#10b981"
        action={balanceAction}
        className="min-w-0"
        heading="Current Balance"
      >
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            {balance !== null ? balance : "—"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {scanCost} credit per scan
          </p>
        </div>
      </TitleCard>
      <TitleCard accentColor="#8b5cf6" className="min-w-0" heading="Pack size">
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            {pack !== null ? pack : "—"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {credits
              ? `$${(credits.pack_price_cents / 100).toFixed(2)} via Stripe`
              : "—"}
          </p>
        </div>
      </TitleCard>
      <TitleCard className="min-w-0" heading="Usage">
        <div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight tabular-nums">
              {Math.round(usagePercent)}%
            </p>
            <p className="text-muted-foreground text-sm">of last pack</p>
          </div>
          <div className="bg-muted mt-3 h-2 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                usagePercent > 90 ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </TitleCard>
    </div>
  );
}
