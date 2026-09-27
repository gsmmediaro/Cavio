import type { CreditsInfo } from "@/api/client";
import { UpgradePaywallDialog } from "@/components/billing/upgrade-paywall-dialog";

type CreditTopupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credits: CreditsInfo | null;
  loadingCredits?: boolean;
  success?: boolean;
};

/**
 * Subscribe from allowance. Matches Notra GeoUpgrade / credit upgrade structure:
 * PlanCard grid + Monthly/Yearly via UpgradePaywallDialog.
 * Kept as a named entry for Credits pane callers.
 */
export function CreditTopupModal({
  open,
  onOpenChange,
  credits,
  loadingCredits = false,
}: CreditTopupModalProps) {
  return (
    <UpgradePaywallDialog
      credits={credits}
      description="Subscribe for monthly scan credits. One credit per OPG. Yearly saves 20%."
      loadingCredits={loadingCredits}
      onOpenChange={onOpenChange}
      open={open}
      title="Choose your plan"
    />
  );
}
