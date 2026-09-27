import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { cn } from "@notra/ui/lib/utils";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";

export type PlanCardFeature = {
  text: string;
  overageText?: string;
};

export type PlanCardButton = {
  label: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "cta";
  onClick: () => void;
};

export type PlanCardProps = {
  name: string;
  description: string;
  priceLabel: string;
  intervalLabel?: string;
  features: PlanCardFeature[];
  featured?: boolean;
  highlighted?: boolean;
  action?: ReactNode;
  button: PlanCardButton;
};

function planCardClassName(highlighted: boolean, featured: boolean): string {
  if (highlighted) return "ring-2 ring-primary";
  if (featured) return "ring-2 ring-primary/50 transition-all hover:ring-primary/80";
  return "transition-all hover:ring-2 hover:ring-muted-foreground/20";
}

/** Port of Notra PlanCard . Cavio keeps Stripe/credits CTA (green primary). */
export function PlanCard({
  name,
  description,
  priceLabel,
  intervalLabel,
  features,
  featured = false,
  highlighted = false,
  action,
  button,
}: PlanCardProps) {
  return (
    <TitleCard
      action={action}
      className={cn(planCardClassName(highlighted, featured))}
      heading={name}
    >
      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm">{description}</p>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-3xl leading-none font-bold tabular-nums">{priceLabel}</span>
            {intervalLabel ? (
              <span className="text-muted-foreground mb-0.5 text-sm font-normal">/{intervalLabel}</span>
            ) : null}
          </div>
        </div>

        {button.variant === "cta" ? (
          <CtaButton className="h-11 w-full" disabled={button.disabled} onClick={button.onClick}>
            {button.label}
          </CtaButton>
        ) : (
          <Button
            className="w-full"
            disabled={button.disabled}
            onClick={button.onClick}
            variant={button.variant === "outline" ? "outline" : "default"}
          >
            {button.label}
          </Button>
        )}

        <ul className="space-y-2.5 pt-2">
          {features.map((feature) => (
            <li className="flex items-start gap-2 text-sm" key={feature.text}>
              <HugeiconsIcon
                className="text-primary mt-0.5 size-4 shrink-0"
                icon={CheckmarkCircle02Icon}
              />
              <div>
                <span>{feature.text}</span>
                {feature.overageText ? (
                  <p className="text-muted-foreground text-xs">{feature.overageText}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </TitleCard>
  );
}
