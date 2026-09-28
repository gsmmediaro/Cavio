# Vendored from Notra (@notra/ui) — FULL package

Source: Documents/crack/notra-src/packages/ui
Copied verbatim to `src/vendor/notra-ui` (all components, hooks, lib, styles, types, constants).

Vite adaptations:
- `next/image` → `src/shims/next-image.tsx`
- `next/link` → `src/shims/next-link.tsx` (react-router for internal)
- `@notra/schemas/*` / `@notra/utils/*` → thin stubs under `src/vendor/notra-schemas|utils`
- Path aliases in vite.config.ts + tsconfig.json
- Primary tokens patched to Cavio GREEN (oklch ~156)
- Light mode default via ThemeProvider (next-themes, enableSystem=false)

`components/ui/*.tsx` re-export from `@notra/ui/components/ui/*` for existing Cavio imports.
`nav.tsx` remains Cavio-local (not a Notra primitive).

Heavy product folders (ai-elements, brainless, charts, geo, instrument, kibo-ui) are
vendored on disk but excluded from `tsc` include to keep Vite builds lean; import
on demand and install matching deps if you light them up.

## Dashboard chat (agent analyze)
Vendored lean extracts under `src/vendor/notra-dashboard/` from
`apps/dashboard` chat activity + `packages/ui` ai-elements Message/MessageContent.
Analyze chat chrome (bubbles, thinking) must import these — do not invent Cavio-only message UI.
