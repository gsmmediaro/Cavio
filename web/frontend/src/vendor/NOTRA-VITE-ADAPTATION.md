# Notra → Cavio (Vite) adaptation notes

Vendored from Documents/crack/notra-src/packages/ui into src/vendor/notra-ui (full tree).
Dashboard shell patterns adapted from pps/dashboard (SidebarProvider / SidebarInset / header).

## Kept product-local (Cavio)
- Routes: /analyze, /history, /settings, /terms, /privacy (+ auth gate)
- Credits / Firebase auth / clinical analyze flows
- Cavio GREEN primary via CSS tokens (oklch(0.52 0.102 156))
- Light mode default (ThemeProvider defaultTheme="light", enableSystem={false})

## Next-only pieces — honest adaptation
| Notra (Next) | Cavio (Vite) |
|---|---|
| 
ext/image | src/shims/next-image.tsx (<img>) |
| 
ext/link | src/shims/next-link.tsx (react-router / <a>) |
| 
ext/font (Inter, Geist Mono) | system ui-sans-serif + Exposure Trial display |
| 
ext/dynamic | not used; Auth brand panel is CSS gradient (no WebGL dither) |
| 
ext/headers cookies for sidebar | client cookie via SidebarProvider (already in UI) |
| 
uqs / RSC layouts / server actions | omitted — SPA routes only |
| @notra/schemas, @notra/utils | thin stubs under src/vendor/notra-schemas|utils |
| Full DashboardShell (orgs, agent, billing gates) | Cavio Layout.tsx uses same Sidebar primitives with Cavio nav |

## Heavy folders vendored but tsc-excluded
i-elements, rainless, charts, geo, instrument, kibo-ui — present on disk for the full design system; import on demand and add matching npm deps if enabled.

## Run
`ash
cd web/frontend && npm run dev   # http://127.0.0.1:5173
`
