import { useEffect, useState } from "react";

import { CarouselProgress } from "@notra/ui/components/ui/carousel-progress";
import { cn } from "@notra/ui/lib/utils";

/**
 * Port of Notra AuthBrandPanel + TestimonialCarousel from SOURCE:
 * apps/dashboard/src/components/auth/auth-brand-panel.tsx
 * apps/dashboard/src/components/auth/testimonial-carousel.tsx
 * apps/dashboard/src/constants/auth-split-panel.ts
 * apps/dashboard/src/constants/auth-testimonials.ts
 *
 * WebGL Dithering (@paper-design/shaders-react) skipped — CSS stand-in keeps
 * the same absolute placement / opacity / rotate as source.
 * Brand hue = Cavio green oklch(0.52 0.102 156), not Notra purple.
 */

const AUTH_SPLIT_PANEL_MIN_WIDTH = "64rem";
const AUTH_TESTIMONIAL_INTERVAL_MS = 6000;

const AUTH_TESTIMONIALS = [
  {
    quote:
      "Cavio cut our screening backlog in half. The reports are clear enough that my associates trust them on first read.",
    name: "Dr. Andrei Popescu",
    role: "Founder, Clinica Dentala Nord",
    initials: "AP",
  },
  {
    quote:
      "We finally have a calm workspace for X-rays and follow-ups. Patients notice — and so does our front desk.",
    name: "Dr. Elena Marinescu",
    role: "Orthodontist, SmileLab",
    initials: "EM",
  },
  {
    quote:
      "Onboarding took minutes. The AI flags what I care about and stays out of the way for everything else.",
    name: "Dr. Mihai Ionescu",
    role: "Oral surgeon, MedOral",
    initials: "MI",
  },
] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function TestimonialCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const shouldReduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const startedAt = performance.now();

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const nextProgress = Math.min(
        (elapsed / AUTH_TESTIMONIAL_INTERVAL_MS) * 100,
        100,
      );

      if (nextProgress >= 100) {
        setProgress(0);
        setActiveIndex((i) => (i + 1) % AUTH_TESTIMONIALS.length);
      } else {
        setProgress(nextProgress);
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [activeIndex, shouldReduceMotion]);

  return (
    <section
      aria-label="Customer testimonials"
      aria-roledescription="carousel"
      className="flex w-full max-w-xl flex-col gap-5"
    >
      <div
        aria-live={shouldReduceMotion ? "polite" : "off"}
        className="grid min-h-[15rem] rounded-3xl bg-white/10 p-7 shadow-[0_0_0_0.0625rem_rgba(255,255,255,0.2)]"
      >
        {AUTH_TESTIMONIALS.map((testimonial, index) => (
          <figure
            aria-hidden={index !== activeIndex}
            aria-label={`Testimonial ${index + 1} of ${AUTH_TESTIMONIALS.length}`}
            aria-roledescription="slide"
            className={cn(
              "duration-slower col-start-1 row-start-1 flex flex-col justify-between gap-5 transition-opacity ease-in-out motion-reduce:transition-none",
              index === activeIndex
                ? "opacity-100"
                : "pointer-events-none opacity-0 select-none",
            )}
            key={testimonial.name}
          >
            <blockquote className="text-base leading-relaxed text-white">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white"
              >
                {testimonial.initials}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">
                  {testimonial.name}
                </span>
                {/* Source uses text-violet-100/75 on purple panel; green panel → white/75 */}
                <span className="text-sm text-white/75">{testimonial.role}</span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      <CarouselProgress
        activeIndex={activeIndex}
        labels={AUTH_TESTIMONIALS.map(
          (item) => `Show testimonial from ${item.name}`,
        )}
        onSelect={(index) => {
          if (index === activeIndex) {
            return;
          }
          setActiveIndex(index);
          setProgress(0);
        }}
        progress={shouldReduceMotion ? 100 : progress}
        variant="inverted"
      />
    </section>
  );
}

export function AuthBrandPanel() {
  const shouldReduceMotion = usePrefersReducedMotion();
  const [canMountPanel, setCanMountPanel] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(min-width: ${AUTH_SPLIT_PANEL_MIN_WIDTH})`,
    );
    const onChange = () => {
      setCanMountPanel(mediaQuery.matches);
    };
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  if (!canMountPanel) {
    return null;
  }

  // Source gradient: purple. Cavio: green oklch(... 156). Same angle/stops structure.
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(200deg,oklch(0.72_0.09_156)_0%,oklch(0.52_0.102_156)_55%,oklch(0.40_0.09_155)_100%)] p-14">
      {shouldReduceMotion ? null : (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Source Dithering placement */}
          <div
            aria-hidden
            className="absolute top-[56.875rem] left-[calc(100%-38.75rem)] h-[49.0625rem] w-[56.625rem] origin-top-left rotate-[270deg] opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,0.24) 3px 4px), repeating-linear-gradient(90deg, transparent 0 3px, rgba(255,255,255,0.18) 3px 4px)",
              maskImage:
                "radial-gradient(ellipse at 40% 50%, black 0%, transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at 40% 50%, black 0%, transparent 70%)",
            }}
          />
        </div>
      )}
      <div className="relative">
        <TestimonialCarousel />
      </div>
    </div>
  );
}
