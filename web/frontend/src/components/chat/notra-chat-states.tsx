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

/** Settings credits card skeleton */
export function SettingsCreditsSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-border p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}

/** Analyze result image / findings skeleton while streaming */
export function AnalyzeResultSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-busy="true">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <div className="space-y-2 rounded-xl border border-border p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}