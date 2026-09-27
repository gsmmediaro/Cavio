import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import type { CreditsInfo } from "@/api/client";
import { CreditSummaryCards } from "@/components/billing/credit-summary-cards";
import { UpgradePaywallDialog } from "@/components/billing/upgrade-paywall-dialog";
import { ErrorBanner } from "@/components/chat/notra-chat-states";
import { SettingsPane } from "@/components/settings/settings-pane";
import { Button } from "@/components/ui/button";

type CreditsPaneProps = {
  credits: CreditsInfo | null;
  creditsLoading: boolean;
  creditsError: string;
  notice: string;
  onRefresh: () => void;
  topupSuccess?: boolean;
};

/**
 * Port of Notra CreditsSettingsPane.
 * Cavio Subscribe from allowance opens UpgradePaywallDialog
 * (same PlanCard + Monthly/Yearly structure as Notra GeoUpgradeDialog).
 */
export function CreditsSettingsPane({
  credits,
  creditsLoading,
  creditsError,
  notice,
  onRefresh,
  topupSuccess = false,
}: CreditsPaneProps) {
  const [paywallOpen, setPaywallOpen] = useState(false);

  return (
    <SettingsPane>
      {notice ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm" role="status">
          {notice}
        </div>
      ) : null}

      {topupSuccess && !notice ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm" role="status">
          Subscription updated. Your monthly scan credits are ready to use.
        </div>
      ) : null}

      {creditsError ? (
        <ErrorBanner
          description={creditsError}
          onRetry={onRefresh}
          title="Could not load credits"
        />
      ) : null}

      <CreditSummaryCards
        balanceAction={
          <Button
            aria-label="Subscribe"
            onClick={() => setPaywallOpen(true)}
            size="icon-sm"
            variant="ghost"
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          </Button>
        }
        credits={credits}
        isLoading={creditsLoading}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPaywallOpen(true)} variant="outline">
          Subscribe
        </Button>
        <Button onClick={onRefresh} variant="ghost">
          Refresh
        </Button>
      </div>

      <UpgradePaywallDialog
        credits={credits}
        description="Subscribe for monthly scan credits. One credit per OPG. Yearly saves 20%."
        loadingCredits={creditsLoading}
        onOpenChange={setPaywallOpen}
        open={paywallOpen}
        title="Choose your plan"
      />
    </SettingsPane>
  );
}
