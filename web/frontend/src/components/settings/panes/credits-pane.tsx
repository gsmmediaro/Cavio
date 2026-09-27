import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import type { CreditsInfo } from "@/api/client";
import { CreditSummaryCards } from "@/components/billing/credit-summary-cards";
import { CreditTopupModal } from "@/components/billing/credit-topup-modal";
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

/** Port of Notra CreditsSettingsPane — Cavio Stripe credits. */
export function CreditsSettingsPane({
  credits,
  creditsLoading,
  creditsError,
  notice,
  onRefresh,
  topupSuccess = false,
}: CreditsPaneProps) {
  const [topupOpen, setTopupOpen] = useState(false);

  return (
    <SettingsPane>
      {notice ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm" role="status">
          {notice}
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
            aria-label="Top up credits"
            onClick={() => setTopupOpen(true)}
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
        <Button onClick={() => setTopupOpen(true)} variant="outline">
          Top up
        </Button>
        <Button onClick={onRefresh} variant="ghost">
          Refresh
        </Button>
      </div>

      <CreditTopupModal
        credits={credits}
        loadingCredits={creditsLoading}
        onOpenChange={setTopupOpen}
        open={topupOpen}
        success={topupSuccess && topupOpen}
      />
    </SettingsPane>
  );
}
