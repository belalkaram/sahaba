# UI-NOBLUE — blue removal (2026-11-06)

Status: IMPLEMENTED. Checks: `tsc --noEmit` clean, `npm run build` passes, `lint:design` reports 30 violations, all in student-dashboard/lesson files from the uncommitted registration/dashboard work (raw purple/amber/emerald and arbitrary font sizes, none blue). Not fixed here (out of scope). Visual check in both themes was NOT done in a browser.

## Changes
- tokens.css `--info*` light/dark -> lime-green (see changelog). `--tq` legacy alias follows `--info`.
- Settings page fallback colors, API AuthPayloadBuilder fallback, StatCard `indigo` -> `lime`.

## Intentional exceptions
- Logo/primary teal-greens (hue 170-174): not blue, unchanged.
- `#0f172a` QR code module color in `student/card/page.tsx` (near-black slate, must stay dark for scanning).
- Purple (`purple-*`) in student-dashboard widgets: violet, not blue; left for a separate decision.
- Historical migration `2026_09_30_000001` still contains the old defaults (history); the later migration clears them.
- `<fg=cyan>` in the TenantAuditCommand console output (CLI only).
