import { cn } from "@notra/ui/lib/utils";
import type { ReactNode } from "react";

type SettingsPaneProps = {
  children: ReactNode;
  className?: string;
};

/** Port of Notra SettingsPane spacing wrapper. */
export function SettingsPane({ children, className }: SettingsPaneProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
