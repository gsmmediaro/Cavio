/**
 * Ported from usenotra/notra-src apps/dashboard/src/components/composer/composer-shell.tsx
 * Structure matches Notra Studio agent chat composer exactly.
 * Send uses Cavio green CTA (cta-gradient-primary) with inner glow when active.
 */
import { ArrowUp, Loader2, Pencil, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import {
  COMPOSER_FRAME_NUDGE_PADDING,
  COMPOSER_FRAME_TRANSITION,
  COMPOSER_INNER_FRAME,
  COMPOSER_NUDGE_ENTER,
  COMPOSER_NUDGE_GRID_TRANSITION,
  COMPOSER_SEND_BUTTON,
  COMPOSER_SEND_BUTTON_ACTIVE,
  COMPOSER_SEND_BUTTON_IDLE,
  COMPOSER_TOOLBAR_BUTTON,
} from "@/constants/composer";
import { cn } from "@/lib/utils";
import type {
  ComposerChipProps,
  ComposerFrameProps,
  ComposerNudgeProps,
  ComposerSendProps,
  ComposerToolbarProps,
} from "@/types/components/composer";

function ComposerFrame({
  children,
  nudge,
  connectedTop = false,
  className,
}: ComposerFrameProps) {
  const hasNudge = Boolean(nudge);

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-2xl",
        COMPOSER_FRAME_TRANSITION,
        hasNudge ? COMPOSER_FRAME_NUDGE_PADDING : "bg-transparent p-0",
        connectedTop ? "rounded-t-none" : null,
        className,
      )}
    >
      <div
        className={cn(
          "grid",
          COMPOSER_NUDGE_GRID_TRANSITION,
          hasNudge ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">{nudge}</div>
      </div>
      <div
        className={cn(
          COMPOSER_INNER_FRAME,
          hasNudge ? "rounded-xl" : "rounded-2xl",
          connectedTop && !hasNudge ? "rounded-t-none border-t-0" : null,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ComposerNudge({ title, action, children }: ComposerNudgeProps) {
  const hasChips = Boolean(children);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 pb-1",
        COMPOSER_NUDGE_ENTER,
        hasChips ? "flex-wrap" : null,
      )}
    >
      {title && !hasChips ? (
        <p className="min-w-0 flex-1 text-xs font-medium wrap-anywhere">{title}</p>
      ) : null}
      {hasChips ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
      ) : null}
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}

function ComposerChip({
  icon,
  label,
  onRemove,
  removeLabel,
  onEdit,
  editLabel,
  onSteer,
  steerLabel,
  onClick,
  pending = false,
  className,
  labelClassName,
}: ComposerChipProps) {
  const labelClasses = cn("max-w-[12rem] truncate", labelClassName);

  return (
    <span
      aria-busy={pending || undefined}
      className={cn(
        "border-foreground/25 bg-background text-foreground inline-flex max-w-full items-center gap-1.5 rounded-md border border-dashed py-1 pr-1 pl-1.5 text-xs",
        pending ? "border-foreground/15 text-muted-foreground" : null,
        className,
      )}
    >
      {onClick ? (
        <button
          aria-label={`Preview ${label}`}
          className="hover:text-foreground flex min-w-0 items-center gap-1.5 rounded-sm text-left transition-colors"
          onClick={onClick}
          type="button"
        >
          {icon}
          <span className={labelClasses} title={label}>
            {label}
          </span>
        </button>
      ) : (
        <>
          {icon}
          <span className={labelClasses} title={label}>
            {label}
          </span>
        </>
      )}
      {onSteer && !pending ? (
        <button
          aria-label={steerLabel ?? `Steer with ${label}`}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded transition-colors"
          onClick={onSteer}
          type="button"
        >
          <ArrowUp className="size-3" />
        </button>
      ) : null}
      {onEdit && !pending ? (
        <button
          aria-label={editLabel ?? `Edit ${label}`}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded transition-colors"
          onClick={onEdit}
          type="button"
        >
          <Pencil className="size-3" />
        </button>
      ) : null}
      {onRemove ? (
        <button
          aria-label={removeLabel ?? `Remove ${label}`}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded transition-colors"
          onClick={onRemove}
          type="button"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

function ComposerToolbar({ children, className }: ComposerToolbarProps) {
  return (
    <div className={cn("flex items-center gap-1 px-2 pb-2", className)}>
      {children}
    </div>
  );
}

function ComposerToolbarButton({
  className,
  type = "button",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className={cn(COMPOSER_TOOLBAR_BUTTON, className)}
      type={type}
      {...props}
    />
  );
}

function ComposerSend({
  children,
  busy = false,
  disabled = false,
  active = false,
  tooltip,
  label,
  onClick,
}: ComposerSendProps) {
  const content = busy ? <Loader2 className="size-3.5 animate-spin" /> : children;
  const className = cn(
    COMPOSER_SEND_BUTTON,
    active && !disabled ? COMPOSER_SEND_BUTTON_ACTIVE : COMPOSER_SEND_BUTTON_IDLE,
    disabled ? "pointer-events-none" : null,
    disabled && !busy ? "opacity-30" : null,
  );

  const trigger = (
    <button
      aria-busy={busy}
      aria-disabled={disabled}
      aria-label={label}
      className={className}
      onClick={disabled ? undefined : onClick}
      type="button"
    >
      {content}
    </button>
  );

  if (!tooltip) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-busy={busy}
            aria-disabled={disabled}
            aria-label={label}
            className={className}
            onClick={disabled ? undefined : onClick}
            type="button"
          />
        }
      >
        {content}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export const Composer = {
  Frame: ComposerFrame,
  Nudge: ComposerNudge,
  Chip: ComposerChip,
  Toolbar: ComposerToolbar,
  ToolbarButton: ComposerToolbarButton,
  Send: ComposerSend,
};

export type { ReactNode };
