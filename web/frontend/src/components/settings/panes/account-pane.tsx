import { Separator } from "@/components/ui/separator";
import { SettingsPane } from "@/components/settings/settings-pane";

type AccountPaneProps = {
  displayName: string;
  email: string;
};

/** Port of Notra AccountSettingsPane rows. Cavio profile fields. */
export function AccountSettingsPane({ displayName, email }: AccountPaneProps) {
  return (
    <SettingsPane>
      <div className="border-border/80 bg-muted/80 overflow-hidden rounded-lg border">
        <div className="px-4 py-3">
          <p className="text-sm font-medium">Account Information</p>
          <p className="text-muted-foreground text-xs">Manage and update your profile information</p>
        </div>
        <div className="border-border/60 rounded-t-lg border-t bg-background px-4">
          <Separator className="mb-0" />
          <div className="flex flex-col justify-between gap-1 border-b border-border py-5 sm:flex-row sm:items-center">
            <span className="text-sm font-semibold text-foreground">Name</span>
            <span className="text-sm text-muted-foreground">{displayName || "-"}</span>
          </div>
          <div className="flex flex-col justify-between gap-1 py-5 sm:flex-row sm:items-center">
            <span className="text-sm font-semibold text-foreground">Email</span>
            <span className="text-sm text-muted-foreground">{email || "-"}</span>
          </div>
        </div>
      </div>
    </SettingsPane>
  );
}
