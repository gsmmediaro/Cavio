/**
 * Analyze chat chrome: thin Cavio wrappers around vendored Notra SOURCE components.
 * Do not invent bubbles / thinking / shimmers here — import from
 * vendor/notra-dashboard (dashboard chat) and @notra/ui (packages/ui).
 *
 * Kept local: ErrorBanner + layout skeletons (settings/composer/result mirrors).
 */
import type { ReactNode } from "react";
import { AlertCircleIcon, InboxIcon, RefreshCwIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@notra/ui/components/ui/alert";
import { Button } from "@notra/ui/components/ui/button";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import {
  Message,
  MessageContent,
} from "@/vendor/notra-dashboard/components/ai-elements/message";
import { ChatActivityStatus } from "@/vendor/notra-dashboard/components/ai/chat-activity-status";
import { UserMessageTextBubble } from "@/vendor/notra-dashboard/components/chat/user-message-text-bubble";

export { Message, MessageContent, ChatActivityStatus, UserMessageTextBubble };

/** User turn — Notra Message + MessageContent (agent chat). */
export function ChatUserBubble({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Message from="user" className={className}>
      <MessageContent>{children}</MessageContent>
    </Message>
  );
}

/** Assistant turn — Notra Message + MessageContent; optional activity/reasoning row. */
export function ChatAssistantBlock({
  children,
  reasoning,
  className,
}: {
  children?: ReactNode;
  reasoning?: ReactNode;
  className?: string;
}) {
  return (
    <Message from="assistant" className={className}>
      <MessageContent>
        {reasoning}
        {children}
      </MessageContent>
    </Message>
  );
}

/** Pending assistant row — Notra ChatActivityStatus (BrailleLoader Thinking). */
export function ThinkingIndicator({
  label = "Thinking",
  seconds = 0,
  active = true,
  className,
}: {
  label?: string;
  seconds?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm leading-5",
        className,
      )}
      role="status"
    >
      <ChatActivityStatus active={active} label={label} seconds={seconds} />
    </span>
  );
}

/** Analyzing / streaming — same ChatActivityStatus with Cavio dental label. */
export function AnalyzingIndicator({
  label = "Analyzing scan",
  seconds = 0,
  className,
}: {
  label?: string;
  seconds?: number;
  className?: string;
}) {
  return (
    <ThinkingIndicator
      active
      className={className}
      label={label}
      seconds={seconds}
    />
  );
}

/** Conversation empty / idle prompt (FindingsTable empty). */
export function ChatEmptyState({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      {children ?? (
        <>
          <div className="text-muted-foreground">
            {icon ?? <InboxIcon className="size-8" strokeWidth={1.5} />}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/** Inline error banner (Notra Alert destructive). */
export function ErrorBanner({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={cn("items-start", className)}>
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{description}</span>
        {onRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-fit gap-1.5"
            onClick={onRetry}
          >
            <RefreshCwIcon className="size-3.5" />
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** Settings credits card skeleton — mirrors CreditSummaryCards 3-col grid */
export function SettingsCreditsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading credits">
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Full settings shell skeleton — mirrors SettingsShell (nav + header + pane).
 */
export function SettingsShellSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading settings"
      className={cn(
        "border-border bg-background mx-auto flex w-full max-w-[64rem] flex-1 flex-col overflow-hidden border md:my-6 md:h-[min(44rem,calc(100svh-3rem))] md:rounded-2xl md:shadow-sm",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="border-border flex shrink-0 flex-col gap-4 border-b px-3 py-3 md:w-56 md:border-r md:border-b-0 md:px-3 md:py-4">
          {[0, 1].map((g) => (
            <div className="space-y-2" key={g}>
              <Skeleton className="mx-2 h-3 w-16" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </nav>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5 md:px-5">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="size-8 rounded-md" />
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-4 py-4 md:px-5">
            <SettingsCreditsSkeleton />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Welcome / composer skeleton — mirrors Analyze welcome (avatars + title + composer).
 */
export function AnalyzeComposerSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading composer"
      className={cn(
        "mx-auto flex w-full max-w-[680px] flex-1 flex-col items-center justify-center px-5 py-10 md:px-8",
        className,
      )}
    >
      <div className="mb-7 flex items-center justify-center">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="-ml-2.5 size-11 rounded-full" />
        <Skeleton className="-ml-2.5 size-11 rounded-full" />
      </div>
      <Skeleton className="mb-6 h-12 w-[min(100%,28rem)] rounded-lg md:h-14" />
      <div className="w-full max-w-[680px] overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="px-3 py-3">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
        <div className="flex items-center gap-2 px-2 pb-2">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="ml-auto size-7 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Result / streaming skeleton — mirrors Analyze result (back+title, image, findings).
 */
export function AnalyzeResultSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading scan result">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid gap-2 pt-2">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
