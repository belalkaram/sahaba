# R7A — Design System & App Shell

> **بالعربي:** نظام تصميم حقيقي بثيم فاتح وداكن يعمل، مكونات ناقصة، App Shell واحد لكل الأدوار، وتقسيم الصفحات الضخمة.
> **Closes:** T-UX-03, 06, 07, 08, 10, C-14 (foundation)
> **Depends on:** R1B. **Spec:** `LMS_Frontend_Recovery_and_UIUX_Quality_Gate.md` §7, §8, §21, §30, §33-35; Master §7, §63-67.

**Before coding:** load the `frontend-design` guidance if available in your environment, and re-read Quality Gate §7 (identity: premium Gulf/Saudi education SaaS, calm, data-rich, IBM Plex Sans Arabic, RTL-first; avoid generic AI gradients/glass/card-grid sameness).

## Tasks

### R7-0a — Tokens
- `apps/web/src/styles/tokens.css`: semantic tokens for light and dark — `--surface`, `--surface-raised`, `--surface-sunken`, `--fg`, `--fg-muted`, `--fg-inverse`, `--border`, `--primary`, `--primary-fg`, `--success`, `--warning`, `--danger`, `--info` (+ `-subtle` variants), radius scale, spacing scale, shadow/elevation, motion durations, focus ring. Brand overrides via `--brand-primary`/`--brand-secondary` from tenant branding with contrast-safe foregrounds.
- Map into Tailwind v4 `@theme`. Remove the forced `data-theme="dark"` from `app/layout.tsx`; theme = user preference (system default) stored per user (localStorage + optional profile setting).
- Replace all hardcoded color utilities (`text-white` ×263, `bg-[#…]`, `text-slate-*` etc.) in touched files with semantic classes. Add an ESLint rule or a CI grep that fails on new raw color utilities in `src/app` and `src/features`.

### R7-0b — Primitives & patterns (`apps/web/src/components/ui/`)
Existing: Button, Badge, Card, Drawer, EmptyState, Input, Modal, Select, Skeleton, StatCard, Tabs.
Add: `Textarea`, `Checkbox`, `Radio`, `Switch`, `Avatar`, `Tooltip`, `DropdownMenu`, `Toast` (+ provider), `ConfirmDialog`, `FileUpload` (drag/drop, progress, preview), `DataTable` (sort, column visibility, row actions, selection, sticky header, RTL, mobile card fallback), `FilterBar`, `SearchInput` (debounced), `Pagination`, `Breadcrumbs`, `PageHeader` (title, description, actions, breadcrumbs), `Timeline`, `ActivityFeed`, `CalendarWeek`, `ProgressBar/Ring`, `KpiCard` (value, delta, sparkline slot), `StatusDot`, `Forbidden`, `ErrorState`, `StateView`.
- All accessible (keyboard, focus, aria), RTL-correct, both themes.
- Replace `/components` public page with a dev-only gallery (excluded from production build, or behind `NODE_ENV !== 'production'`).

### R7-1 — App Shell
- One `AppShell` used by every experience: sidebar from navigation registry (R1-B3), top bar (tenant logo/name, global search placeholder wired to a simple search endpoint if available else hidden, notifications bell (wired in R8), theme toggle, user menu with profile/logout, support-session banner slot).
- Mobile: bottom navigation for the 4-5 primary items + drawer for the rest; not a compressed desktop.
- Delete dead layouts (`components/layout/*-nav-layout.tsx`) and per-experience duplicated layout code.
- Remove all hardcoded identity fallbacks ("سلطان الغامدي", "معلم رياضيات — ثانوية اليرموك", "ثالث ثانوي / 2 — جدة", "زائر", etc.) — use `me` data or nothing.

### R7-2 — Break up God pages
- Move logic into `apps/web/src/features/<feature>/{api,hooks,components}`; pages ≤ ~300 lines. Priority: payments, platform/tenants, credentials, student/courses (if still present), student/dashboard, assessments, media, meetings, attendance.
- No behavior change in this task beyond moving and using new primitives; verify with existing Playwright tests.

### R7-3 — Detail page pattern
- Shared `DetailLayout` (header with entity identity + status + primary actions, tabs, side summary on desktop). Used by R7B–R7F.

## Acceptance criteria

- [ ] Every route renders correctly in light and dark (Playwright screenshots attached to report: desktop 1440 + mobile 390, both themes, for at least one page per experience).
- [ ] No raw color utilities in `src/app`/`src/features` (CI check).
- [ ] No page file > 300 lines among touched pages.
- [ ] `/components` not available in production build.
- [ ] axe check: 0 critical violations on shell + 3 sample pages.
- [ ] tsc / lint / build / Playwright pass.
