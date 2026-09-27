import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";

import type { CavioSettingsSection, SettingsNavGroup } from "./settings-constants";

type SettingsNavProps = {
  groups: readonly SettingsNavGroup[];
  activeSection: CavioSettingsSection;
  onSelect: (id: CavioSettingsSection) => void;
};

/** Port of Notra SettingsModalNav (sans search. Cavio sections are few). */
export function SettingsNav({ groups, activeSection, onSelect }: SettingsNavProps) {
  return (
    <nav
      aria-label="Settings"
      className="border-border relative z-10 flex shrink-0 flex-col gap-4 border-b px-3 py-3 pointer-events-auto md:w-56 md:border-r md:border-b-0 md:px-3 md:py-4"
      data-settings-nav=""
    >
      {groups.map((group) => (
        <div className="space-y-1" key={group.id}>
          <p className="text-muted-foreground px-2 text-[11px] font-medium tracking-wide uppercase">
            {group.label}
          </p>
          <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {group.items.map((item) => {
              const active = item.id === activeSection;
              return (
                <button
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative z-10 flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors pointer-events-auto",
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  data-settings-section={item.id}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  <HugeiconsIcon className="size-4 shrink-0 pointer-events-none" icon={item.icon} strokeWidth={2} />
                  <span className="whitespace-nowrap pointer-events-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
