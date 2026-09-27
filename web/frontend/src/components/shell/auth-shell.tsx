import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Notra-style auth chrome adapted for Vite/Cavio:
 * split layout (form | brand panel), light-first, Cavio green brand wash.
 * Skips Next-only pieces (next/dynamic WebGL dither, next/font).
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
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(200deg,oklch(0.72_0.09_156)_0%,oklch(0.52_0.102_156)_55%,oklch(0.40_0.09_155)_100%)] p-14">
              <div className="relative max-w-sm text-center text-white">
                <img
                  src="/Cavio Header.png"
                  alt="Cavio"
                  className="mx-auto mb-8 h-10 brightness-0 invert"
                />
                <p className="text-lg font-medium leading-snug tracking-tight">
                  Clinical screening, designed with care.
                </p>
                <p className="mt-3 text-sm text-white/75">
                  Analyze scans, track patients, and keep your practice moving — in a calm, light workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
