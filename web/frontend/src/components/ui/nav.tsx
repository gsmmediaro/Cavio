import * as React from "react";
import { cn } from "../../lib/utils";

/** Notra-inspired sidebar nav item */
function NavItem({
  className,
  active,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[active]:bg-muted",
        className
      )}
      data-slot="nav-item"
      {...props}
    />
  );
}

function NavSectionLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-2.5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
      data-slot="nav-section-label"
      {...props}
    />
  );
}

export { NavItem, NavSectionLabel };
