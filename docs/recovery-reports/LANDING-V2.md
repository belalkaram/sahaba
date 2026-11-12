# Phase Report — LANDING-V2 (landing and public showcase redesign)

Plan: `docs/design/LANDING-REDESIGN-PLAN.md`. Requested by the owner on 2026-11-12, outside the audit finding IDs.

## L3–L7 — The rest of the landing, the directories and the academy page

**Date:** 2026-11-12 · **Status:** L3, L4, L6 DONE · L5, L7 PARTIAL (see "Not done")

Done in one pass at the owner's request rather than as separate phases.

### What changed

| Area | Change | Files |
|---|---|---|
| The story (L3) | Six new sections: the problem it replaces (scattered tools that drift toward one panel as you scroll), the two services (OD-31), each role's experience plus the screens that role actually gets, tenant isolation with a drawn diagram, and analytics with each metric's source named. | `features/landing/story-sections.tsx`, `features/landing/content.ts`, `features/landing/landing-sections.tsx` |
| Academies and teachers (L4) | Landing rails and the full directories at `/academies` and `/teachers`: search, city, type and service filters, paging, and designed loading, empty, no-results and error states. Linked from the header and footer. | `features/landing/showcase.tsx`, `features/directory/directory-view.tsx`, `app/academies/page.tsx`, `app/teachers/page.tsx`, `components/layout/public-chrome.tsx` |
| Academy page (L5) | Logo, kind, city, services, real course and teacher counts, courses, teachers, and a registration call that preselects the academy on `/register`. | `app/a/[slug]/page.tsx`, `features/public-academy/academy-context.tsx`, `features/registration/*` |
| Public profile endpoint | `GET /public/academy/profile` returns marketing fields only. Public pages previously read `/tenant/current`, which answers **without authentication** and also carries `contact_phone`, `domains`, `auth_mode` and `brand_settings`. | `PublicAcademyController`, `routes/api.php`, `lib/public-api.ts` |
| Pricing (L6) | A section built on OD-39 with the headline from `GET /public/pricing`, so the page cannot contradict what the platform charges. | `features/landing/pricing-section.tsx` |
| Robustness | A section can tell "no data" from "the API did not answer": on a failed server fetch the browser loads the list, instead of the section vanishing for the whole revalidate window. A missing image falls back to the brand mark rather than a broken box. | `features/landing/server-data.ts`, `features/landing/showcase.tsx` |
| Freshness | `Cache::forget('public.stats')` when a listing changes or metrics are recomputed. | `PlatformDirectoryController`, `PlatformMetricsService` |
| Accessibility | Fixed the header brand link's name mismatch and the underlined link inside the academy footer sentence. | `components/layout/public-chrome.tsx`, `features/public-academy/academy-chrome.tsx` |

### Measurements — production build, ISR cache cleared (2026-11-12)

Four pages × light and dark × 1440 and 390 (390 with CPU ×4):

| Page | LCP 1440 | LCP 390 | CLS | Horizontal overflow | axe critical/serious | Frames > 32 ms on a full scroll |
|---|---|---|---|---|---|---|
| Landing | 520–552 ms | 1032 ms | ≤ 0.0002 | none | none | 0 of a 10 203 px page (desktop), 4 (mobile, worst 39 ms) |
| `/academies` | 140–168 ms | 288 ms | 0.0183 (390) | none | none | 0 |
| `/teachers` | 128–136 ms | 324 ms | 0 | none | none | 2 (worst 33 ms) |
| `/a/{slug}` | 544–660 ms | 1148 ms | 0.0004 | none | none | 0 |

Nothing was left hidden after scrolling on any page. Backend: 331 tests pass; `pint` clean on the files touched; OpenAPI regenerated (293 routes).

### Decisions taken here

- **No pinned scroll scene.** The plan allowed one. Pinning is the most jank-prone technique available and the complaint that started this work was jank, so the problem → solution section uses a scrubbed drift between two columns that are readable whether or not the animation runs. Desktop only.
- **No SplitText anywhere** (see L2).
- **Testimonials stay as labelled sample content** (OD-21) instead of being hidden; the release gate already blocks launch while any `sample: true` remains.
- **Contact details are not published** on an academy page. There is no per-field consent in the data, so the page offers registration or sign-in instead. The owner's answer to plan question 3 can change this.

### Not done

- **View transitions** between a card and its page (plan §3.9, L5). The pages are plain navigations.
- **Lighthouse** was not run; the numbers above come from PerformanceObserver on a production build. **Safari and Firefox** were not opened.
- The **768 px** width was not measured (390 and 1440 were).
- The platform console has **no UI** for the listing and featured switches yet; the API is there.

### Known limitations

- `/academies` at 390 shifts 0.0183 — under the 0.02 target but the largest left. The source is the filter row reflowing when the text font (IBM Plex Arabic, loaded through @fontsource CSS) arrives; preloading it, or moving it to `next/font`, would remove it.
- A teacher photo whose file is missing still produces a 404 request before the fallback renders: the directory stores a `photo_url` whenever `staff.photo_path` is set, without checking the file exists.
- The landing is 15 927 px tall at 390. Long for a phone; the sections are ordered so the first screen carries the offer.

### Local data note

So these sections could be seen with real data, the two **local** tenants (`almustaqbal`, `e2e-academy`) were switched on in the directory (`is_listed`), their published courses and active teachers marked public, and metrics recomputed. This is the local SQLite database only. To undo: set `is_listed` to false for those tenants, or toggle them from `POST /platform/directory/academies/{id}/toggle`.

## L2 — Hero, trust strip and header

**Date:** 2026-11-12 · **Status:** DONE (verified as listed below; limits in "Not verified")

The first part the visitor actually sees. Sections 3–13 of the plan are still the old ones.

### What changed

| Area | Change | Files |
|---|---|---|
| Hero | Headline rises line by line behind a mask; eyebrow, paragraph, CTAs, preview and chips follow on a short stagger. A row of three plain facts replaced the four sample numbers (they moved to the trust strip). | `features/landing/landing-hero.tsx` |
| Hero preview | Built from the product's own surfaces — `Badge`, card surfaces, KPI tiles with icons — instead of hand-drawn boxes. | same |
| Pattern | The khatam lattice is an inline SVG of stars and arches that draws itself once (DrawSVG), replacing a CSS mask stretched over the whole hero and repainted while scrolling. | `features/landing/hero-pattern.tsx` |
| Entrance technique | The hero entrance is **CSS**, started by the pre-paint boot script. GSAP keeps what is not in the first paint: the drawn pattern, the scroll reveals, the progress bar and the magnetic CTA. | `app/globals.css`, `features/landing/landing-motion.tsx` |
| Trust strip | Real counts from `GET /public/stats` with a count-up, and the academies that opted in with their logos. Sample content (OD-21) appears only while there are fewer than two real numbers or no listed academy, and stays labelled. | `features/landing/trust-strip.tsx`, `features/landing/server-data.ts` |
| Header | Scroll work writes to the DOM through refs instead of React state on every event; the bar hides on the way down, returns on the way up (never while the menu is open) and carries a reading-progress line. | `components/layout/public-chrome.tsx` |
| Font | The 18 KB display face is preloaded; its swap was the only layout shift left. | `app/fonts.ts` |

### Measurements — production build, ISR cache cleared (2026-11-12)

| Metric | Desktop 1440 | Mobile 390, CPU ×4 | Target |
|---|---|---|---|
| LCP | **464 ms** (hero headline) | **1104 ms** (hero paragraph) | ≤ 2000 ms |
| CLS at load and after a full scroll | **0** | **0** | ≤ 0.02 |
| Frames over 32 ms while scrolling the page | 0 of 57 | 1 of 92 (32 ms) | none |
| Long tasks | one, 103 ms | 269 / 166 / 58 / 53 ms | — |

Before this phase, the same production measurement gave LCP 4228 ms (desktop) and 5248 ms (mobile): the headline was held hidden until the JS bundle and GSAP had loaded. Moving the entrance to CSS is what fixed it. Preloading the font traded about 260 ms of LCP for removing the last shift (CLS 0.0165 → 0 on mobile).

Behaviour checks (dev server, Chromium): content present without JavaScript; the headline is hidden for 3 frames then visible, with no visible → hidden flash; nothing stays hidden after scrolling; reduced motion shows everything with no animation; with all script bundles blocked the content appears by itself; the header hides at `translateY(-77px)` scrolling down and returns at `0` scrolling up; the progress line tracks the scroll; no horizontal overflow at 390 or 1440; no console errors.

```text
apps/web> npx tsc --noEmit      → 0 errors
apps/web> npm run lint          → 0 errors
apps/web> npm run lint:design   → passed
apps/web> npm test              → 16 pass
apps/web> npm run build         → success
```

### Decisions taken here

- **SplitText dropped on the hero paragraph.** It needs the font and the bundle before it can measure lines, which is exactly what made the old LCP bad. A CSS rise gives the same impression at first paint. Lines-only splitting (never characters) remains the rule if it returns elsewhere.
- **No smooth-scroll library**, as planned: the native scroll measured 0 frames over 32 ms.
- **The "الأكاديميات" and "المعلمون" header links and the «تصفّح الأكاديميات» CTA are deferred to L4**, when those pages exist; linking to a 404 now would be worse than waiting. The secondary CTA stays «تسجيل الدخول» until then.

### Not verified

- Only Chromium. Safari and Firefox were not run.
- The trust strip's real path was not seen with real data: no academy is listed locally, so the labelled sample is what renders. The real branch is covered by types and by the L1 tests, not by a visual check.
- The count-up starts on mount, not when the strip scrolls into view; it sits just under the hero, so it is normally visible at load.
- Lighthouse itself was not run (the numbers above come from PerformanceObserver on a production build); it is planned for L7.
- Measurement note: a `next start` server kept serving a stale ISR page after a rebuild, so the first LCP numbers were wrong. Every number above comes from a server started after `rm -rf .next/cache`, with the served HTML checked for the new markup first. The four temporary servers (ports 3100–3103) were stopped afterwards.

## L1 — Public showcase API

**Date:** 2026-11-12 · **Status:** DONE (verified as listed below; limits in "Not verified")

Backend only: the data the academies and teachers sections need in L4, with no UI change beyond one corrected link.

### What changed

| Area | Change | Files |
|---|---|---|
| Academy opt-in (OD-40) | `tenants.is_listed` (default off) decides whether an academy appears in the public directory; `tenants.is_featured` reorders listed ones. A teacher's own opt-in is unchanged and is not overridden by it. | `…_add_public_listing_to_tenants_table.php`, `app/Models/Tenant.php` |
| Academies directory | `GET /public/directory/academies`: active + listed only, featured first then most recently active, filters (`search`, `city`, `type`, `kind`, `service`), paging capped at 48. Marketing fields only — no contact phone, no ids. | `PublicDirectoryController` |
| Teachers directory | Paging, `search` / `city` / `academy` filters, `courses_count`, and `profile_url` for the teacher's own page. `academy_url` now points at the academy home. | same |
| Landing numbers | `GET /public/stats`: listed academies, public teachers, public courses, cities; cached 10 minutes; a count not yet computed is `null`, never zero. | same |
| Counts | `lms:refresh-platform-metrics` also records `public_courses_count` / `public_teachers_count` per tenant and per opted-in teacher, so a public request never opens a tenant database. | `PlatformMetricsService`, `…_add_public_counts_for_directory.php` |
| Platform console | `GET /platform/directory/academies`, `POST /platform/directory/academies/{id}/toggle` (listing and featuring), audited as `platform.directory.academy_updated`. Featuring an unlisted academy is refused; unlisting clears the featured place. | `PlatformDirectoryController`, `routes/api.php` |
| Frontend client | `DirectoryAcademy`, `PublicStats`, `getDirectoryAcademies()`, `getPublicStats()`, filters on `getDirectoryTeachers()`; the landing card links to `profile_url`. | `lib/public-api.ts`, `features/landing/landing-sections.tsx` |

### Commands run and results (2026-11-12)

```text
apps/api> php artisan migrate --force          → 2 migrations DONE (local sqlite, .env checked first)
apps/api> php artisan test                     → 331 tests, 2831 assertions, 0 failures
apps/api> php scripts/generate-openapi.php     → 292 route entries; the 4 new routes documented
apps/api> vendor/bin/pint --test <changed>     → passed
apps/web> npx tsc --noEmit                     → 0 errors
apps/web> npm run build                        → success
```

Live checks against the running API (empty local directory, so these show the empty path):

| Request | Result |
|---|---|
| `GET /public/directory/academies` | `{"academies":[]}` + pagination meta |
| `GET /public/stats` | counts 0, `courses_count: null`, `computed_at: null` |
| `GET /public/directory/teachers?per_page=2` | `{"teachers":[]}` + pagination meta |
| `GET /platform/directory/academies` without a token | 401 |

New tests (`PublicShowcaseDirectoryTest`, 8): opt-in listing, featured-then-recent ordering, filters and paging caps, counts from snapshots (unknown stays unknown), teacher filters and links, a teacher staying visible while their academy is not listed, stats, platform toggles with audit, and the metrics refresh filling counts from a real tenant database.

### Behaviour change

`academy_url` on a teacher card was `/a/{slug}/teachers` (the academy's teacher list) while the landing labelled the link "صفحة المعلم". It is now the academy home, and the new `profile_url` is the teacher's page; the landing link and the PS-2 test were updated together.

### Not verified

- No academy is listed and no teacher is public in the local database, so the filled directory was exercised only in tests, not against real data.
- `lms:refresh-platform-metrics` was tested through `PlatformMetricsService::refreshTenant` on one tenant; the scheduled run across many tenants was not re-timed.
- Postgres: the ordering uses a portable `CASE WHEN … IS NULL` expression and the suite runs on SQLite; it was not executed against Postgres.
- No UI for the new platform toggles yet (API only) — planned with L4.

### Known limitations

- `is_listed` defaults to off, so the directory stays empty until the platform team switches academies on. That default is OD-40 and needs the owner's confirmation.
- Public counts are as fresh as the last metrics run (scheduled), not live.
- `cities_count` counts distinct `city` strings, so two spellings of one city count twice.

## L0 — Foundation

**Date:** 2026-11-12 · **Status:** DONE (verified as listed below; limits in "Not verified")

No visual redesign in this phase. It removes the causes of flicker and layout jumps and prepares the page for L2–L6.

### What changed

| Area | Change | Files |
|---|---|---|
| Rendering | `/` is a server component, prerendered and revalidated every 5 minutes. The opted-in teachers list is fetched on the server; if the server cannot reach the API the section loads it in the browser as before. | `app/page.tsx`, `features/landing/server-data.ts`, `features/landing/landing-sections.tsx` |
| Signed-in redirect | Done by the proxy before render, from a new `lms_home` cookie written when the session is known. Only four exact dashboard paths are accepted. A client fallback covers sessions created before the cookie existed. | `src/proxy.ts`, `lib/token-store.ts`, `context/auth-context.tsx`, `features/landing/landing-motion.tsx` |
| Next 16 convention | `src/middleware.ts` renamed to `src/proxy.ts` (`middleware` is deprecated in Next 16). Behaviour for protected routes unchanged. | `src/proxy.ts` |
| Motion | One client island loads GSAP ScrollTrigger on demand. Animated elements are hidden by CSS before first paint (`html.motion-ready`, set by the boot script), and the class is removed in the same tick the tweens are created. Removed the endless floating-chip loop. Hero is now a server component. | `app/layout.tsx`, `app/globals.css`, `features/landing/landing-motion.tsx`, `features/landing/landing-hero.tsx` |
| FAQ | All answers are in the HTML; open/close is a CSS `grid-template-rows` transition; closed answers are `inert`. | `features/landing/landing-sections.tsx` |
| Images | Teacher photos have fixed dimensions, `loading="lazy"`, `decoding="async"`. | same |
| Config | Optional `API_INTERNAL_URL` for server-side fetches when `NEXT_PUBLIC_API_URL` is relative. | `infrastructure/docker-compose.yml`, `infrastructure/.env.production.example`, `apps/web/.env.example` |

### Commands run and results (2026-11-12)

```text
apps/web> npx tsc --noEmit                 → 0 errors
apps/web> npm run lint                     → 0 errors (175 warnings, pre-existing kind; one new: <img> in the teachers card)
apps/web> npm run lint:design              → passed
apps/web> npm test                         → 16 pass, 0 fail
apps/web> npm run build                    → success; "/" listed as static, Revalidate 5m; "ƒ Proxy (Middleware)" present
```

Playwright script against the dev server (`http://localhost:3000`, Chromium):

| Check | Result |
|---|---|
| JavaScript disabled | Headline and FAQ answers present in HTML; `motion-ready` not set; all content visible |
| Flash check (headline visibility sampled every frame) | 1440: hidden 15 frames then visible 180; 390: hidden 14 then visible 181. No visible → hidden → visible sequence |
| CLS after load and full scroll | 1440: 0.0193 · 390: 0.0100 |
| Elements still hidden after scrolling the page | 0 |
| Console / page errors | none |
| FAQ | second item opens, first closes |
| `prefers-reduced-motion: reduce` | 0 hidden elements at DOMContentLoaded; class not set |
| Script bundles blocked | 27 elements hidden at first, 0 after 4.2s (failsafe) |
| Proxy: token + `lms_home=/student/dashboard` | 307 → `/student/dashboard` |
| Proxy: token + `lms_home=https://evil.example` | 200, no redirect |
| Proxy: anonymous `/` | 200 |
| Proxy: `/student/dashboard` without token | 307 → `/login?redirect=…` (unchanged behaviour) |

### Not verified

- CLS and frame checks ran on the dev server, not a production build; Lighthouse and a performance trace are planned for L7.
- Server-side teachers data in the HTML: the local directory is empty (`teachers: []`), so only the empty path and the null fallback were exercised.
- `API_INTERNAL_URL` in Docker: the variable is wired but no value is set; the right internal URL depends on the deployment and was not tested.
- Safari and Firefox were not run.
- The full Playwright route matrix and backend suite were not re-run (no backend change in L0).

### Known limitations

- CLS at 1440 (0.0193) is just inside the 0.02 target; the source was not isolated (likely font swap in the hero). To be measured in L2 when the hero is rebuilt.
- Teacher photos still use `<img>`: `next/image` needs the API host allowed for optimisation, which is decided in L4.
- The hero pattern is still a CSS mask over a large area (plan §1, item 5); replaced in L2.
- A visitor with a stale `lms_auth_token` cookie and a valid `lms_home` is redirected to the dashboard and from there to `/login` by the existing 401 handling.

### Correction to the plan

Plan §1 item 3 first said the landing had "no content in the initial HTML". That was wrong: Next renders client components on the server, so the static text was already in the HTML. What was missing was the directory data. The plan row is corrected.
