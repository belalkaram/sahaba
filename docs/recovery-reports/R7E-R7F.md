# Phase Report — R7E/R7F + Sahaba identity (R7-0a, R7-0b, R7-1)

**Date:** 2026-11-04
**Status:** PARTIAL
**Session scope:** Owner-requested redesign (`docs/design/UI-UX-REDESIGN-PLAN.md`), OD-16 to OD-22, R7E, R7F, R8-2. Tracker reconciled with real tests.

## 1. Tasks

| Task | Status | Evidence |
|---|---|---|
| R7-0a Tokens & themes | PARTIAL | `styles/tokens.css`, `npm run lint:design`; light and dark checked on sample pages |
| R7-0b Primitives | PARTIAL | `components/ui/*`, dev-only `/components` |
| R7-1 App Shell | PARTIAL | `components/layout/app-shell.tsx`; checked at 1280 and 390 on sample pages |
| R7E Tenant admin | PARTIAL | `/admin`, `/admin/audit` checked in browser; `/admin/integrations` is an explicit "not available" state |
| R7F Platform & public | PARTIAL | Landing, login with access code, contact, `/platform/login`, `/platform/audit`, `/platform/settings`; `PlatformSettingsAndContactTest` |
| R8-2 Notification center | PARTIAL | Bell and `/notifications` read real data; the demo user had no notifications, so a populated list was not seen |

## 2. What changed

- **Backend:** migration `2026_11_04_000001_create_platform_settings_and_contact_messages` (new tables, reversible, no data impact); `PlatformSetting`, `ContactMessage`, `PublicConfigController`, `ContactMessageController`, `PlatformSettingsController`; `routes/api.php` reformatted by Pint, which is why its diff is large.
- **Endpoints:** `GET /public/config` (public), `POST /public/contact` (public, `throttle:auth`), `GET|PUT /platform/settings`, `GET /platform/contact-messages`, `POST /platform/contact-messages/{id}/handled` (all `platform.auth`; mutations audited).
- **Frontend:** see `docs/project-management/changelog.md`. Codemods are in `apps/web/scripts/design-codemods/`.
- **Removed:** `components/layout/navbar.tsx`, `components/layout/sidebar-nav.tsx` (unused), `app/favicon.ico` (default Next icon).

## 3. Commands run and results

```text
apps/api> php artisan test        → 166 tests, 1798 assertions, 0 failures
apps/api> vendor/bin/pint --test  → passed
apps/web> npx tsc --noEmit        → no errors
apps/web> npm run lint            → 0 errors, 115 warnings (10 errors at session start)
apps/web> npm run lint:design     → passed
apps/web> npm test                → 9 tests, 0 failures
apps/web> npm run build           → passed, 61 static pages
Playwright                        → not run: not installed
```

## 4. Behavior verified in the browser

- Platform login, then dashboard with real metrics; no console errors.
- Demo switch: `public/config` went `false → true → false`, and both changes appear in `/platform/audit`.
- Tenant admin lands on `/admin`; `/admin/audit` shows only that tenant's rows.
- Login page renders both modes. **Access-code sign-in was not exercised with a real code.**
- Landing, login, dashboards: 1280 and 390 widths, light and dark, on sample pages only. The browser pane was small, so fine visual detail was not fully inspected.

## 5. Not done / limitations

- No Playwright screenshots or axe audit (Playwright is not installed), so no R7 row is marked DONE.
- Internal role pages were migrated by codemod; only a sample was reviewed visually. Not every page uses `PageHeader`.
- R7-2: several pages are still over 300 lines.
- OD-17: some raw numbers remain in Western digits (e.g. `SAR 5500.00` in student payments).
- OD-18: `formatDual` is used only in notifications and the audit log so far.
- R8-1, R8-3 to R8-7 and R9 were not started in this session. R8-6 and R4-3 need Google credentials; real email needs SMTP.

## 6. Discovered (not fixed)

- Many pages still use `.catch(() => [])`, which breaks Operating Rule §4 by turning errors into empty data (e.g. student dashboard, `/admin`).
- The API returned HTTP 429 during normal dashboard loads: pages fire many parallel requests against the throttle.
- `R2.md` cites test method names that do not exist in the code; the tracker now cites the real test classes.
- Phase reports R2 to R7D claimed `COMPLETE & VERIFIED` while UI tasks have no E2E tests; the tracker marks those rows PARTIAL.
- `PlatformAuthenticate` keeps a static-token fallback for CI (`platform_token`).
- The demo password constant ships in the client bundle; harmless only while demo accounts are never seeded in production.
- `apps/api/CLAUDE.md` asks for `laravel/boost` to be installed; the install was denied by the permission system and was not done.

## 7. Decisions needed

- Install `laravel/boost` as `apps/api/CLAUDE.md` asks? It needs the owner's approval.
- Install Playwright to close R7 acceptance criteria?

## 8. Docs updated

- [x] 03-PROGRESS-TRACKER.md
- [x] 04-capability-coverage-matrix.md rows: Master §7, Quality Gate §10
- [x] changelog.md
- [x] openapi.yaml
- [x] 01-DECISIONS.md (OD-20, OD-22)
