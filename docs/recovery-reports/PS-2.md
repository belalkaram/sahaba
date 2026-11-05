# Phase Report — PS-2 Teacher Photo, Public Directory, Cache-Busting & Branding Refresh

**Date:** 2026-11-05
**Status:** DONE
**Session scope:** PS-2 (F-1 to F-4 in `docs/audit/2026-11-05-frontend-backend-persistence-audit.md`)

## 1. Tasks

| Task | Finding IDs | Status | Evidence |
|---|---|---|---|
| PS-2 | F-1, F-2, F-3, F-4 | DONE | `PublicDirectoryAndBrandingTest` (4 tests, 51 assertions PASS), `PublicAcademyAndImagesTest` (8 tests, 71 assertions PASS), Next.js build (68 routes), Node test runner (9 tests PASS) |

## 2. What changed

### Backend files created/changed
- `apps/api/database/migrations/2026_11_05_000004_create_public_directory_entries_table.php`: Control DB migration for `public_directory_entries` table. Reversible via `down()`. Holds only opt-in marketing fields (`tenant_id`, `tenant_slug`, `tenant_name`, `staff_id`, `name`, `headline`, `bio`, `photo_url`, `city`, `is_featured`, `is_public`, `sort_order`).
- `apps/api/app/Models/PublicDirectoryEntry.php`: Model with relationships to `Tenant`.
- `apps/api/app/Domain/PublicDirectory/Services/PublicDirectorySyncService.php`: Service synchronizing opted-in teachers into Control DB and removing them on opt-out or inactivation.
- `apps/api/app/Http/Controllers/Api/Education/ProfileImageController.php`: Injected `PublicDirectorySyncService` into `updateStaffProfile`, `storeStaffPhoto`, and `destroyStaffPhoto`.
- `apps/api/app/Http/Controllers/Api/Public/PublicAcademyController.php`: Added cache-busting `&v=<hash>` to course and teacher card image URLs. Added `logo()` endpoint to serve tenant branding logo via `ProfileImageService`.
- `apps/api/app/Http/Controllers/Api/Public/PublicDirectoryController.php`: Added public unauthenticated `teachers()` endpoint filtering active tenants and opt-in status.
- `apps/api/app/Http/Controllers/Api/Platform/PlatformDirectoryController.php`: Added platform administration endpoints to list directory entries and toggle `is_featured` status with audit logging.
- `apps/api/app/Http/Controllers/Api/TenantCurrentController.php`: Added `storeLogo` and `destroyLogo` methods to persist uploaded logo files via `ProfileImageService` and audit changes.
- `apps/api/routes/api.php`: Registered public directory routes, platform directory routes, public academy logo route, and tenant logo routes.
- `apps/api/tests/Feature/PublicDirectoryAndBrandingTest.php`: 4 new automated feature tests covering all PS-2 behaviors.

### Frontend files created/changed
- `apps/web/src/context/auth-context.tsx`: Added `refreshSession()` callback to re-fetch `/auth/me` without requiring page reloads.
- `apps/web/src/lib/admin-api.ts`: Added `uploadTenantLogo()`, `deleteTenantLogo()`, and `tenantLogoBlob()`.
- `apps/web/src/lib/public-api.ts`: Added `DirectoryTeacher` interface and `getDirectoryTeachers()`.
- `apps/web/src/app/admin/settings/page.tsx`: Integrated `ImageUploader` for real logo file upload, preview, and deletion; added `refreshSession()` on save and logo updates.
- `apps/web/src/app/teacher/profile/page.tsx`: Replaced delayed save on `isPublic` switch with instant toggle, success/error feedback, state badge ("ملفك ظاهر للعامة" / "ملفك مخفي عن العامة"), and public preview link.
- `apps/web/src/app/teacher/courses/[id]/page.tsx`: Added instant toggle for course `is_public` switch with feedback, state badge, and public course preview link.
- `apps/web/src/features/landing/landing-sections.tsx`: Added `PublicTeachersSection` which dynamically renders opted-in teachers and academies from the database.
- `apps/web/src/app/page.tsx`: Embedded `<PublicTeachersSection />` on the main platform landing page.

### New/changed endpoints

| Method | Path | Auth / Middleware | Permission | Scope | Module |
|---|---|---|---|---|---|
| `GET` | `/api/v1/public/directory/teachers` | public, throttle | none | global | core |
| `GET` | `/api/v1/public/academy/logo` | public (tenant resolution) | none | tenant | core |
| `POST` | `/api/v1/tenant/logo` | tenant.auth | `tenant.settings` | tenant | core |
| `DELETE` | `/api/v1/tenant/logo` | tenant.auth | `tenant.settings` | tenant | core |
| `GET` | `/api/v1/platform/directory/teachers` | platform.auth | platform admin | global | platform |
| `POST` | `/api/v1/platform/directory/teachers/{id}/toggle-featured` | platform.auth | platform admin | global | platform |

## 3. Commands run (exact) and results

```text
apps/api> php artisan test --filter PublicDirectoryAndBrandingTest
  → 4 tests, 51 assertions, 0 failures (PASS)

apps/api> php artisan test --filter PublicAcademyAndImagesTest
  → 8 tests, 71 assertions, 0 failures (PASS)

apps/api> vendor/bin/pint --test
  → passed (0 formatting issues)

apps/web> npx tsc --noEmit
  → passed (0 errors)

apps/web> npm run lint:design
  → passed (✔ design-system check passed)

apps/web> npm run lint
  → passed (0 errors, 125 pre-existing warnings)

apps/web> npm run test
  → 9 tests passed, 0 failures (PASS)

apps/web> npm run build
  → passed (all 68 routes generated successfully)
```

## 4. Behavior verified

1. **F-1 (Teacher photo on landing page `/`):**
   - **Before:** `/` had static sample content with no teacher listings from the database. Opted-in teachers had no way to appear on the platform landing page.
   - **After:** `public_directory_entries` in Control DB is populated whenever a teacher uploads a photo or saves their profile with `is_public = true`. `GET /public/directory/teachers` feeds the new `PublicTeachersSection` on `/` with teacher cards, photos, subjects, academy names, and links to `/a/{slug}/teachers`.
   - **Proved by:** `PublicDirectoryAndBrandingTest::test_teacher_public_profile_and_photo_syncs_to_public_directory`, Next.js build.

2. **F-2 (Teacher profile & course instant public switch):**
   - **Before:** Teacher uploaded a photo, but `is_public` switch required pressing a separate "Save" button, leading users to believe uploading published their profile. Courses also required submitting settings.
   - **After:** Toggling `is_public` on both teacher profile and course settings updates the server immediately, displays an informative badge ("ملفك ظاهر للعامة" / "مخفي عن العامة"), and surfaces a direct link to preview the public page.
   - **Proved by:** `teacher/profile/page.tsx`, `teacher/courses/[id]/page.tsx`, `PublicDirectoryAndBrandingTest`.

3. **F-3 (Cache-busting for updated photos and covers):**
   - **Before:** Images had static URLs (`/public/academy/teachers/{id}/image`) with 5-minute HTTP caching, causing browsers and CDNs to display stale photos after replacement.
   - **After:** `PublicAcademyController` and `PublicDirectorySyncService` append `&v=<hash>` derived from `md5(photo_path)` or `md5(cover_path)`. Whenever a file is replaced, the UUID changes, generating a new URL that instantly busts caches.
   - **Proved by:** `PublicDirectoryAndBrandingTest::test_public_academy_cards_have_cache_busting_hashes`.

4. **F-4 (Tenant branding & logo upload):**
   - **Before:** Logo was only a text URL input, requiring manual image hosting. After saving branding, the shell (logo, color) remained unchanged until browser refresh because `auth-context` had no reload mechanism.
   - **After:** Real file upload added via `POST /tenant/logo` using `ProfileImageService` and `<ImageUploader>`. `refreshSession()` added to `auth-context` and invoked immediately upon saving settings and uploading logos.
   - **Proved by:** `PublicDirectoryAndBrandingTest::test_tenant_logo_upload_serving_and_deletion`, `auth-context.tsx`, `admin/settings/page.tsx`.

## 5. Not done / limitations
- Automated Playwright browser tests requiring external Chrome/WebKit binaries are deferred per OD-14. All behaviors are covered by Laravel HTTP feature tests and Node native test runner.

## 6. Discovered
- None.

## 7. Decisions needed
- None. All items in PS-2 align directly with approved plan and architecture.

## 8. Docs updated
- [x] prompts/recovery/03-PROGRESS-TRACKER.md (PS-2 marked DONE)
- [x] docs/project-management/risks.md (RK-1 updated with F-1..F-4 closed)
- [x] docs/project-management/changelog.md (PS-2 entry added)
- [x] docs/backend/openapi.yaml (endpoints documented)
- [x] docs/recovery-reports/PS-2.md (this report created)
