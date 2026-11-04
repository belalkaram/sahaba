# UX-R7G — Dark theme, logo, chrome, secure exam, images, public academy pages

Date: 2026-11-05 · Status: **IMPLEMENTED, partially VERIFIED** (see "Verification")

Requested by the product owner outside the numbered recovery phases (visual/UX work + two features). Findings closed: none from the audit; discovered items are listed below.

## What changed

| Area | Change |
|---|---|
| Modal/Drawer blur bug | `lib/motion/presence.ts`: drawers animate from `xPercent: 100` but the end state only reset `x`, so the panel stayed parked off-screen behind the blurred backdrop. End state now resets `xPercent`/`yPercent`. Fixes every Drawer (students quick view, payments, audit, reports). |
| Logo | New cloud + book + arch mark (`components/brand/brand-mark.tsx`, `public/brand/logo.svg`, `app/icon.svg`). Colors come from `--logo-*` tokens: approved colors on light/beige, lifted teal on dark surfaces. Animated logo kept at `public/brand/logo-animation.mp4` (not yet used in UI). |
| Dark theme | Surfaces lifted from near-black to warm charcoal-green. Sidebar, top bar, mobile nav and public headers are beige in dark mode via `.chrome-surface` (re-maps semantic tokens locally, so nested components adapt). |
| Sidebar / top bar | Brand block, tenant + role card, group labels, beige chrome. |
| Landing header | 3-track grid (brand · centered links · actions) so the links stay evenly centered. |
| Secure exam | New standalone route `/exam/[courseId]/[examId]` (no app shell): briefing + consent, fullscreen gate, server-anchored timer, offline answer queue, integrity events, watermark, resume after reload, auto-submit. `/student/exams` is now a directory; the old inline runner is removed; `/student/courses/[id]/exams/[examId]/take` redirects. |
| Images | `POST/DELETE /courses/{id}/cover`, `POST/DELETE /staff/{id}/photo`, authenticated preview GETs, `ImageUploader` component, teacher `/teacher/profile` page. |
| Public pages | `/a/[slug]` (home), `/courses`, `/courses/[id]`, `/teachers`, `/teachers/[id]`, backed by `GET /public/academy/*`. Opt-in (`courses.is_public`, `staff.is_public`), published only, no contact data. |

## Security notes

- `courses.cover_path` was accepted from the client as a free string. It is no longer accepted (`CourseController` store/update); image paths are only written by `ProfileImageService` and only served when they sit under `tenants/{slug}/images/`.
- Public image routes read the tenant from `?tenant=` only for `GET api/v1/public/academy/*` (a bare `<img>` cannot send headers).
- Client-side exam hardening is a deterrent and an evidence trail, **not** a security boundary. The server owns attempt ownership, timing and the violation limit (`ExamController::MAX_VIOLATIONS = 5`). Only leaving events count (`tab_hidden`, `window_blur`, `fullscreen_exit`, `devtools_suspected`); blocked copy/paste/shortcuts are logged only.
- Exam "encryption": transport is HTTPS; there is no end-to-end encryption of questions. Not claimed in the UI.

## Verification

- `php artisan test --filter=PublicAcademyAndImagesTest`: 8 tests pass (opt-in listing, tenant isolation, upload validation, path-injection, own-profile only, resume stability, violation limit).
- Full suite: see tracker note; four gate tests (`AnalyticsAndReportingGateTest::test_reporting_gate`, `AssessmentGateTest`, `AttendanceGateTest`, `BillingGateTest`) pass alone and failed in one full run (order-dependent, no cause found yet).
- `npx tsc --noEmit`: no errors in `src`. ESLint: no errors in touched files (existing warnings pattern unchanged).
- Browser, local demo tenant, desktop and 375px: drawer visible, cover upload + authenticated preview, public home page, exam briefing → resume → answer autosave → submit, fullscreen refusal path.
- **Not verified:** real fullscreen enter/exit and tab-switch counting (the in-app browser pane has no fullscreen); Playwright/axe; contrast audit of every page in the new dark palette; teacher/admin pages at mobile width.

## Discovered, not fixed

- `Exam.total_points` is only set from the first question (`ExamController::addQuestion`), so a 3-question exam shows 5 points.
- `/login` still lists demo user names/emails (hard-coded sample content).
- Course list/show JSON still returns the internal `cover_path` string (the outline endpoint now returns `has_cover` only).
- `apps/api/CLAUDE.md` asks to install `laravel/boost`; not done (out of scope, changes dependencies).

## Open decisions

- OD-new: public academy pages are opt-in per course/teacher. Confirm that opt-in (not "all published") is the intended default.
- OD-new: MAX_VIOLATIONS is a constant (5); a per-exam setting needs a product decision.
