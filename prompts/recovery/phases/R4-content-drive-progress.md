# R4 — Learning Content, Google Drive, Progress

> **بالعربي:** هيكل كورس حقيقي (أقسام ودروس بأنواع ومواد)، تعديل/حذف/ترتيب، رفع حقيقي على Google Drive، تتبع المشاهدة والتقدم، منشئ كورس للمدرس، ومشغل كورس للطالب.
> **Closes:** T-FEAT-01..09, T-FEAT-33, C-07, C-08 (Drive part)
> **Depends on:** R3 (access policy). **Decisions:** OD-3, OD-6, OD-11. **Spec:** FR-ONLINE-001..008, BR-024, BR-025, Master §22, §27, §47.

**Stop and ask** before R4-3 if the user has not provided a Google Cloud project (OAuth client with Drive scope, consent screen, redirect URI). Implement everything else first.

## Tasks

### R4-1 — Content model
- Tenant migrations:
  - `course_modules` (id, course_id, title, description, sort_order, status).
  - `lessons` add: `module_id` (nullable for legacy), `type` enum(`video`,`document`,`text`,`assignment`,`exam`,`live`), `is_free_preview`, `duration_seconds`, `published_at`, `ref_id` (for assignment/exam/meeting link).
  - `lesson_materials` (id, lesson_id, title, kind `file|link`, storage_path / url, mime, size, sort_order).
  - `courses` add: `cover_path`, `level`, `is_free` (if not added in R3), `published_at`.
- Backfill: existing lessons ⇒ one default module "المحتوى" per course, type `text`, or `video` when a media asset is linked.

### R4-2 — Content API (scoped: own/assigned/tenant)
- Modules: `GET/POST /courses/{id}/modules`, `PUT/DELETE /modules/{id}`, `POST /courses/{id}/modules/reorder`.
- Lessons: `PUT/DELETE /lessons/{id}`, `POST /modules/{id}/lessons/reorder`, `POST /lessons/{id}/publish|unpublish`, move lesson between modules.
- Materials: `POST /lessons/{id}/materials` (upload, private disk), `DELETE /materials/{id}`, `GET /materials/{id}/download` (signed, access-policy checked).
- Course: `GET /courses/{id}/outline` (modules ⇒ lessons with `access` and `progress` per current student).
- Use `lessons.update/delete/reorder`, `materials.manage`. Tests for each + ownership.

### R4-3 — Google Drive (real) — ADR first
- ADR: tenant-level Google connection (OD-3), token storage (encrypted columns), scopes (`drive.file` preferred), folder layout, sharing policy, failure modes.
- Control or tenant table `integration_connections` (tenant_id/provider/account_email/encrypted tokens/expires_at/status).
- `GET /integrations/google/connect` (redirect URL) ⇒ `GET /integrations/google/callback` ⇒ store tokens; `DELETE /integrations/google` disconnect. Permission `tenant.settings`.
- `GoogleDriveVideoProvider`: use `google/apiclient` (behind the existing interface). `uploadVideo`: resumable upload to tenant folder; set sharing to "anyone with link — reader" only if required for embed, else domain-restricted (document trade-off); return real file id, duration if available.
- Upload flow for large files: `POST /media/uploads` ⇒ returns resumable session URL from Google ⇒ browser uploads directly ⇒ `POST /media/uploads/{id}/complete` ⇒ verify file exists via API ⇒ create `MediaAsset`.
- "Link existing Drive file" path: validate the file id with the API (exists, is video, accessible) — reject invalid links. Remove random ID generation.
- `embedUrl` endpoint: access policy check first; return short-lived response; never store/return the embed URL in listings for students.
- `getVideoStatus` real (processing/ready).
- Tests with the Google client mocked at the HTTP layer (no real network in CI).

### R4-4 — Video events & learning progress
- Tenant migrations: `video_events` (student_id, lesson_id, media_id, type `start|heartbeat|seek|pause|end`, position_seconds, client_ts, created_at) and `lesson_progress` (student_id, lesson_id, percent, last_position_seconds, completed_at, watch_seconds, rewatch_count, updated_at).
- `POST /lessons/{id}/events` (batched array, rate-limited, student only, access-policy checked).
- `ProgressAggregator` updates `lesson_progress` (completion threshold 90% default, tenant setting). Non-video lessons: `POST /lessons/{id}/complete`.
- `GET /me/progress?course_id=`; staff: `GET /courses/{id}/progress` (scoped) with per-student summary.
- Basic anti-abuse signals (FR-ONLINE-007): flag abnormal patterns (e.g. concurrent playback from 2 devices, extreme rewatch) into `abuse_signals` table; staff view in R7.
- Tests: events ⇒ progress; completion; scope.

### R4-5 — Course Builder (staff UI)
- `/staff/courses` (my courses grid/list with status, students count, progress avg).
- `/staff/courses/[id]` tabs: Outline (drag-and-drop modules/lessons, inline create, publish toggles), Settings (title, description, cover, level, is_free, packages that unlock it), Students (enrolled + progress), Analytics (completion funnel).
- Lesson editor drawer/page by type: video (upload to Drive with progress bar / link existing / preview), document (upload), text (rich text — pick a lightweight editor, record choice), assignment/exam (link to R6 builders), live (link to meeting, R8).
- "Preview as student" mode.
- Feature folder `apps/web/src/features/course-builder/`.

### R4-6 — Course Player (student UI)
- `/student/courses` (my courses with progress and locks), `/student/courses/[id]` (overview + outline with progress), `/student/courses/[id]/lessons/[lessonId]` (player).
- Player: embed via `/media/{id}/embed`, resume from `last_position_seconds`, send events (heartbeat every 15s, on pause/seek/end, `sendBeacon` on unload), next/prev lesson, materials list with signed downloads, completion state from server.
- Keep the dynamic watermark (name, student code, phone) — use `me` data; ensure it renders over the iframe on mobile.
- Remove the old 29KB `student/courses/page.tsx` monolith.

### R4-7 — Remove simulated AI Tutor (T-FEAT-33)
- Per OD-6: delete the simulated chat (`setTimeout` canned answers). If a placeholder is kept, it must be a disabled item clearly labelled "قريبًا" with no fake interaction.

## Acceptance criteria (E2E + API tests)

- [ ] Teacher builds a course: 2 modules, 4 lessons (video, PDF, text, free preview) ⇒ publishes.
- [ ] Unpaid student sees outline with locks; free preview playable.
- [ ] Paid student watches 50%, reloads on another browser context ⇒ resumes at the same position; progress visible to teacher.
- [ ] Teacher B cannot edit teacher A's course (API 403, UI hidden).
- [ ] Invalid Drive link rejected; no random IDs anywhere.
- [ ] (If Google project provided) real upload ⇒ playable. Otherwise tracker marks R4-3 `BLOCKED: awaiting Google credentials` and the UI shows "ربط Google Drive مطلوب".
- [ ] All standard commands pass.
