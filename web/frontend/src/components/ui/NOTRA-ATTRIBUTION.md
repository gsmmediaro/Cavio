# Vendored from Notra (@notra/ui)

Source: Documents/crack/notra-src/packages/ui (usenotra monorepo local checkout)
Package: @notra/ui
Copied files under components/ui and lib/utils.ts + lib/motion.ts are verbatim
except import path rewrites:
  @notra/ui/lib/utils           -> ../../lib/utils
  @notra/ui/lib/motion          -> ../../lib/motion
  @notra/ui/components/ui/button -> ./button

"use client" directives left intact (Next-only; no-ops under Vite).
Cavio green tokens remain in styles/globals.css via CSS variables only.
nav.tsx is Cavio-local (not present in @notra/ui as a primitive).
