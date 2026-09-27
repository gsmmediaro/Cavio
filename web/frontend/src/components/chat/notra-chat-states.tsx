import type { ReactNode } from "react";
import { AlertCircleIcon, InboxIcon, RefreshCwIcon } from "lucide-react";
import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { Loader } from "@notra/ui/components/ai-elements/loader";
import { Alert, AlertDescription, AlertTitle } from "@notra/ui/components/ui/alert";
import { Button } from "@notra/ui/components/ui/button";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";

/** Notra chatgpt-message user bubble */
export function ChatUserBubble({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end", className)}>
      <div className="max-w-[85%] rounded-[1.5rem] bg-secondary px-[18px] py-2.5 text-[15px] leading-6 text-foreground md:max-w-[70%]">
        {children}
      </div>
    </div>
  );
}

/** Notra chatgpt-message assistant block */
export function ChatAssistantBlock({
  children,
  reasoning,
  actions,
  className,
}: {
  children: ReactNode;
  reasoning?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group/chatgpt-msg flex flex-col items-start gap-2", className)}>
      {reasoning}
      <div className="max-w-full text-[15px] leading-7 text-foreground">{children}</div>
      {actions ? (
        <div className="opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/chatgpt-msg:opacity-100 group-focus-within/chatgpt-msg:opacity-100 -ms-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Streaming / analyzing indicator (Notra Shimmer "Thinking") */
export function AnalyzingIndicator({
  label = "Analyzing scan…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div
      className={cn(
        "animate-in fade-in flex items-center gap-2 text-[15px] leading-7 text-muted-foreground duration-300",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader size={16} />
      {reduce ? (
        <span className="font-medium">{label}</span>
      ) : (
        <Shimmer className="font-medium">{label}</Shimmer>
      )}
    </div>
  );
}

/** Conversation empty / idle prompt */
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

/** Inline error banner (Notra Alert destructive) */
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
 * Use while settings route / credits are hydrating so layout does not jump.
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
 * Prefer this over a generic card when loading a saved patient or mid-analyze.
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
