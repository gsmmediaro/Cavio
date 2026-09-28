/**
 * View-only UserMessageTextBubble from Notra dashboard chat.
 * Source: apps/dashboard/src/components/chat/user-message-actions.tsx
 * (edit/resend chrome omitted; Cavio analyze is scripted, not free chat edit.)
 */
import type { ReactNode } from "react";
import { cn } from "@notra/ui/lib/utils";

const USER_MESSAGE_BUBBLE_CLASS =
  "ml-auto flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg bg-secondary px-4 py-3 text-foreground text-sm";

export function UserMessageTextBubble({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        USER_MESSAGE_BUBBLE_CLASS,
        "is-user:dark w-fit max-w-full",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 overflow-hidden">{children}</div>
    </div>
  );
}
