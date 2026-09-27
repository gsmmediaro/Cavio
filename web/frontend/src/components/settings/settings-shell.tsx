import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import {
  CAVIO_SETTINGS_DESCRIPTIONS,
  CAVIO_SETTINGS_LABELS,
  CAVIO_SETTINGS_NAV_GROUPS,
  type CavioSettingsSection,
} from "./settings-constants";
import { SettingsNav } from "./settings-nav";

type SettingsShellProps = {
  section: CavioSettingsSection;
  onSectionChange: (section: CavioSettingsSection) => void;
  children: ReactNode;
  className?: string;
};

/**
 * Port of Notra SettingsModal chrome as a page shell:
 * rounded-2xl panel, left nav, header title/description, close → back.
 */
export function SettingsShell({
  section,
  onSectionChange,
  children,
  className,
}: SettingsShellProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "border-border bg-background mx-auto flex w-full max-w-[64rem] flex-1 flex-col overflow-hidden border md:my-6 md:h-[min(44rem,calc(100svh-3rem))] md:rounded-2xl md:shadow-sm",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SettingsNav
          activeSection={section}
          groups={CAVIO_SETTINGS_NAV_GROUPS}
          onSelect={onSectionChange}
        />
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5 md:px-5">
            <div className="min-w-0 space-y-1">
              <h1 className="text-sm leading-none font-medium">{CAVIO_SETTINGS_LABELS[section]}</h1>
              <p className="text-muted-foreground text-xs">{CAVIO_SETTINGS_DESCRIPTIONS[section]}</p>
            </div>
            <Button
              aria-label="Close settings"
              className="shrink-0"
              onClick={() => navigate("/analyze")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm md:px-5 md:pb-4">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
