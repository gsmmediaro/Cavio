import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { AuthBrandPanel } from "./auth-brand-panel";

/**
 * Notra-style auth chrome adapted for Vite/Cavio:
 * split layout (form | brand panel), light-first, Cavio green brand wash.
 * Brand panel ambient effects mirror Notra AuthBrandPanel (CSS stand-in for
 * WebGL dither). Skips Next-only pieces (next/dynamic, next/font).
 */
export function AuthShell({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="bg-background fixed inset-0 z-[1000] flex h-svh w-full justify-center lg:grid lg:grid-cols-2">
      <section className="flex h-full min-h-0 w-full flex-col items-center justify-between px-6 py-5 lg:px-10 lg:py-6">
        <div className="flex w-full items-center justify-between self-stretch">
          <Link to="/" className="flex items-center gap-2 self-start">
            <img src="/Cavio Logo.png" alt="" className="size-9 rounded-lg" />
            <span className="text-foreground text-lg font-semibold tracking-tight">
              Cavio
            </span>
          </Link>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="w-full max-w-md">{children}</div>

        <p className="text-muted-foreground px-8 text-center text-xs">
          By continuing, you agree to our{" "}
          <Link
            className="hover:text-primary underline underline-offset-4"
            to="/terms"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            className="hover:text-primary underline underline-offset-4"
            to="/privacy"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <div className="relative hidden lg:flex">
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="corner-squircle relative h-full w-full overflow-hidden rounded-md supports-[corner-shape:squircle]:rounded-2xl">
            <AuthBrandPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
