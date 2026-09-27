"use client";

import { TooltipProvider } from "@notra/ui/components/ui/tooltip";
import { Toaster } from "@notra/ui/components/ui/sonner";
import type { ReactNode } from "react";

import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delay={500}>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
