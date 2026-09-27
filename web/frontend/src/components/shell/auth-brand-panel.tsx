import type { ReactNode } from "react";

/**
 * Cavio adaptation of Notra AuthBrandPanel.
 * Notra uses @paper-design/shaders-react Dithering (WebGL) — skipped for Vite.
 * CSS ambient layers approximate the same depth: brand gradient wash, soft
 * halos, and a subtle wave/noise veil (reduced-motion safe).
 */
export function AuthBrandPanel({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(200deg,oklch(0.72_0.09_156)_0%,oklch(0.52_0.102_156)_55%,oklch(0.40_0.09_155)_100%)] p-14">
      {/* Ambient halos — Notra dither wave stand-in */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      >
        <div className="absolute -top-[20%] -right-[15%] h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,oklch(0.85_0.08_156/0.45)_0%,transparent_65%)] blur-2xl" />
        <div className="absolute -bottom-[25%] -left-[20%] h-[75%] w-[75%] rounded-full bg-[radial-gradient(circle,oklch(0.35_0.08_155/0.55)_0%,transparent_60%)] blur-3xl" />
        <div className="absolute top-[40%] left-[55%] h-[45%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,oklch(1_0_0/0.18)_0%,transparent_70%)] blur-xl" />
        {/* Soft wave veil (replaces WebGL dither at opacity ~0.3) */}
        <div
          className="absolute inset-0 opacity-[0.28] mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0 10px, oklch(1 0 0 / 0.07) 10px 11px), repeating-linear-gradient(205deg, transparent 0 14px, oklch(1 0 0 / 0.05) 14px 15px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,oklch(1_0_0/0.22)_0%,transparent_50%),radial-gradient(ellipse_at_80%_80%,oklch(0.3_0.08_155/0.35)_0%,transparent_55%)]" />
      </div>

      <div className="relative z-[1] max-w-sm text-center text-white">
        {children ?? (
          <>
            <img
              src="/Cavio Header.png"
              alt="Cavio"
              className="mx-auto mb-8 h-10 brightness-0 invert"
            />
            <p className="text-lg font-medium leading-snug tracking-tight">
              Clinical screening, designed with care.
            </p>
            <p className="mt-3 text-sm text-white/75">
              Analyze scans, track patients, and keep your practice moving — in
              a calm, light workspace.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
