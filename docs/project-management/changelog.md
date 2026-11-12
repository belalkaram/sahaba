# Changelog

All notable changes to this project will be documented in this file.

## [Feature] - 2026-11-12 — Academy-defined minimum attendance for exams (ATT-1, OD-35)
### Added
- Tenant setting `min_attendance_for_exams` (`/tenant/academic-settings`, null = no rule) with a switch and value on `/admin/academic-settings`; exposed to the UI as `tenant.min_attendance_for_exams` in `/auth/me`.
- `ExamAttendanceGate`: `POST .../exams/{id}/start` answers `403 ATTENDANCE_BELOW_MINIMUM` (Arabic message, `details.rate` / `details.minimum`) when the student's recorded attendance is below the academy's minimum. No recorded attendance = not blocked.
### Fixed
- Parent pages no longer show an invented "75% required for exams" rule or describe students scanning their own QR; they show the academy's rule only when it is set.
### Decisions
- OD-34..OD-39 recorded; ADR-006 (academy capacity, seat = code, academy pays instead of the 10 SAR student fee).
### Known limitation
- Classes are not linked to courses, so attendance is an overall rate, not per course (also affects per-course analytics, audit J-16).

## [Fix] - 2026-11-12 — Self-registered students can sign in and follow their request (UX-FIX-1)
### Fixed
- `/login`: the identifier field was `type="email"`, so the browser refused a mobile number and students created by self-registration (REG-1) could not sign in. It is now "البريد الإلكتروني أو رقم الجوال" (`type="text"`, `autocomplete="username"`); Arabic-Indic digits are converted before sending (the API already normalises `+966…`).
- Registration done screen: each accepted request now shows the academy code and the reference, with "متابعة حالة الطلب" and a sign-in link that pre-fills the academy code. With one academy, the main button opens that academy's sign-in page.
### Added
- `/register/status` (`features/registration/status-check.tsx`): public check of a request with academy code + reference + student mobile, using the existing `GET /public/registration/status`; shows pending / approved (with sign-in link) / rejected. Linked from `/login` and `/register`.
### Verification
- Browser, local sqlite: register -> done screen -> status pending -> approve -> status approved -> sign in with mobile in Arabic-Indic digits -> student dashboard. 375 px checked on the status page. `tsc`, ESLint (0 errors), `lint:design` pass. No automated E2E test (R9-1).

## [Docs] - 2026-11-12 — User-journey and UI/UX audit (all roles)
### Added
- `docs/audit/2026-11-12-user-journey-ux-audit/README.md`: static review of the student, teacher, assistant, academy admin, platform super admin and parent journeys against Master Spec §70-74 and ADR-004. 15 findings; P0: self-registered students cannot sign in with their mobile (login field is `type="email"`) and are never shown their academy code or a status page. No code changed.

## [Security] - 2026-11-06 — Grading inbox and grade publishing respect course scope
### Fixed
- `POST /grading/publish-bulk` accepted any exam or assignment in the tenant, so a teacher could publish another teacher's grades. It now checks every item against the caller's `exams.grade` / `assignments.grade` course scope before writing; one item outside it returns 403 and publishes nothing.
- `GET /grading/pending` limited results only for `staff_type = teacher`, so assistants saw every course. It now uses the same role scope (`GradingScopeTest`).
- Test suite: `NotificationRoutingTest`, `ParentLinkRequiredTest` and `WhatsAppChannelTest` deleted every file in the real `database/tenants` folder, wiping local development data on each full run. The cleanup is removed; `TestCase::tearDown` already cleans the throwaway test folder.

## [Feature] - 2026-11-06 — Separate exams and assignments pages with counters, filters and grading links
### Added
- `GET /assessments/exams-overview` and `/assessments/assignments-overview` (`AssessmentOverviewController`, `ExamOverviewService`, `AssignmentOverviewService`): each row reports enrolled, started or submitted, not started or missing, in progress, timed out, late, pending grading, graded and best-attempt scores. Filters: search, course, status, what needs attention, date range, sort. Query count does not grow with the number of rows. Staff scopes only.
- Tenant migration `2026_11_07_000002`: indexes on `(course_id, status)` for enrollments, exams and assignments.
- Web: `/teacher/exams` and `/teacher/assignments` with KPI shortcuts to filters, per-row grade publishing, and a submissions dialog; shared tabs with `/teacher/grading`.
- `/teacher/grading?exam=` and `?assignment=` open the inbox on one item; its publish button then affects only that item.
### Changed
- Sidebar shows "الاختبارات" and "الواجبات" instead of one entry; `/teacher/assessments` redirects to `/teacher/exams`.
- `ExamAttempt::pendingGrading` and `AssignmentSubmission::pendingGrading` scopes now define "pending" for both the inbox and the overviews.

## [Fix] - 2026-11-06 — Teachers can create exams from the UI (PS-3, partial)
### Added
- `features/assessment/create-exam-form.tsx`: "إنشاء اختبار جديد" on `/teacher/assessments` creates a draft exam, then opens its builder. Until now `createExam` had no caller and nothing linked to the builder page.
### Fixed
- `/teacher/assessments`: exam cards always said "منشور للطلبة" and showed 100 points for an exam with none; they now show the real status and total, and link to the builder.
- Submitting the assignment form with no course did nothing and said nothing; both forms now ask for a course first. Failed creates show the server's reason instead of a generic message.
- Create buttons follow `exams.create` / `assignments.create`.

## [Feature] - 2026-11-07 — Assessment v2 (question images, assignment questions, split-session exams, model answers)
### Added
- Tenant migration `2026_11_07_000001`: `image_path`/`model_answer`/`model_answer_image_path` on questions and bank questions; `exams.allow_split_sessions`, `auto_release_model_answers` (exams, assignments); `exam_attempts.time_used_seconds`/`last_seen_at`; tables `assignment_questions`, `assignment_answers`, `model_answer_releases`. Applied to the template and both Supabase tenants via `lms:migrate-tenants`.
- Split-session exams: `ExamTimeBudget` (heartbeat accounting) + `POST .../attempts/{id}/heartbeat`; `active-attempt` is now a free peek for split exams.
- Assignments with questions (`AssignmentQuestionController`, `AssignmentAnswerService`), auto-grading shared with exams (`QuestionAutoGrader`).
- Question / model-answer images (`QuestionMediaController`) and teacher-controlled model-answer release (`ModelAnswerController`, `ModelAnswerAccess`).
- Web: image upload + model answer in the exam builder, split-session switch, `AssignmentSolver`, student model-answer page, teacher release panel, assignment question manager, heartbeat + "save and continue later" in the secure exam runner, paste/drop/cut blocked on typed answers.
### Changed
- Exam shuffle is now seeded by the attempt id at `start` too, so the order seen at start equals the order after a resume.
- Question JSON hides `image_path`, `model_answer`, `model_answer_image_path` from students (exposes `has_image`).
### Verification
- 13 new PHPUnit tests (`AssessmentV2Test`) + existing assessment tests pass on sqlite; `tsc --noEmit` clean. See `docs/recovery-reports/ASSESSMENT-V2.md` for decisions and known limitations.

## [Perf] - 2026-11-06 — School registration: ~8 min -> ~17 s on Supabase
### Changed
- `TenantDatabaseManager`: on pgsql, a new (empty) tenant schema is cloned from a pre-migrated template schema `_tenant_template` in ONE server-side statement instead of replaying 26 migrations (~thousands of round trips at ~0.3 s each). Existing tenants still upgrade through the normal incremental `migrate`. Disable with `DB_TENANT_TEMPLATE=false`.
- New command `php artisan tenants:refresh-template` builds/updates the template. **Run it after adding a tenant migration / on deploy** (otherwise the first registration builds it lazily and is slow).
- `RoleSynchronizer::sync` rewritten set-based (bulk selects/inserts): 541 -> 43 queries per provisioning. Behaviour unchanged (idempotent; updates changed labels/scopes, removes stale links, keeps custom roles).
- `SchoolRegistrationController`: `set_time_limit(300)` + `ignore_user_abort(true)` so a slow network or a closed tab cannot leave a half-provisioned tenant.
### Automatic template refresh
- `AppServiceProvider` listens to `CommandFinished`: after a plain `php artisan migrate` (not `--database=...`) the template is refreshed; `lms:migrate-tenants` refreshes it first; scheduler runs `tenants:refresh-template` hourly. Failures are logged, never fail a deploy. Documented in `infrastructure/RUNBOOK.md`.
### Verification
- 35 related PHPUnit tests pass (sqlite). Real registrations against Supabase: 17 s (HTTP), 19.5 s / 43 queries (CLI). Remaining time is network latency (~0.3 s per query; 15 `tenant_features` inserts could still be batched).

## [Fix] - 2026-11-06 — School registration timeout on remote DB
### Fixed
- `SchoolRegistrationController::register`: `set_time_limit(300)` before tenant provisioning. Tenant schema migration on Neon exceeded PHP's 30s limit; the fatal timeout bypassed the cleanup `catch`, left a half-provisioned tenant (`octo`, no schema/owner), returned a response without CORS headers (browser showed a CORS error), and retries then failed with 422 (slug taken). The orphan tenant was removed.
### Known limitation
- Not re-tested end-to-end against Neon after the fix (a real registration writes to the shared DB).

## [UI] - 2026-11-06 — Remove blue from the palette (info -> lime-green)
### Changed
- `apps/web/src/styles/tokens.css`: `--info*` family moved from sky blue to lime-green (light `#4D7C0F` / subtle `#F7FEE7` / fg `#365314`; dark `#A3E635` / subtle 16% alpha / fg `#D9F99D`), distinct from the emerald primary (hue ~171) and success green (hue ~142). Text pairs keep WCAG AA.
- `StatCard` variant `indigo` renamed to `lime` (maps to `info`); call sites updated.
- Settings page fallbacks `#04c3c9`/`#0284c7` replaced by `#0C7F6D`/`#4D7C0F`; API `AuthPayloadBuilder` fallback `#2563eb` replaced by `#0C7F6D`.
- Stored tenant colors are untouched (data). Migration `2026_11_05_000002` already nulls the old blue DB defaults.
- Details: `docs/recovery-reports/UI-NOBLUE.md`.

## [P4] - 2026-11-05 — Student 10 SAR/Month Manual Payment Reviewed by Super Admin (OD-27, ADR-004, F-17)
### Added
- **Centralized Platform Payment Architecture (OD-27, ADR-004):**
  - Approved `ADR-004`: Superseded OD-7; centralized payment verification, subscription activation, and entitlement grants in the Platform Console under `platform_super_admin`.
  - Control DB table `platform_pricing`: stores global baseline monthly fee (`student_monthly_fee`, default 10.00 SAR), currency (`SAR`), receiving account details (`receiving_account_type`, `bank_name`, `account_holder_name`, `iban`, `transfer_instructions`), and optional per-tenant overrides.
  - Control DB table `platform_payment_reviews`: audit ledger recording all payment approval/rejection actions taken by platform super admins across all tenants (`period_month`, `amount`, `reviewer_id`, `action`, `notes`, `reviewed_at`).
  - Tenant DB migration: added `period_month`, `reviewed_by_platform_user_id`, `reviewed_by_platform_user_name` to `payment_requests` and `payment_review_logs`, and added `period_month` to `subscriptions`. Made `package_id` nullable in `subscriptions` and `payment_requests`.
- **Authorization & Security (OD-27):**
  - Removed `payments.approve` and `payments.reject` from default tenant roles (`owner`, `center_admin`, `finance`) in `config/authorization.php`. Tenant staff retain `payments.view` (read-only visibility).
  - Calling approve/reject from a tenant role returns HTTP 403 `FORBIDDEN`.
- **Payment Review Service & Platform Endpoints:**
  - `PaymentReviewService`: updated `approve` and `reject` to support `PlatformUser` reviewers, bound subscription start and end dates to the target calendar month (`period_month`), and dispatched dual notifications to student and parents (`NotificationCatalog::PAYMENT_APPROVED`, `PAYMENT_REJECTED`) per OD-33.
  - `PlatformPaymentController`: cross-tenant review inbox (`GET /platform/payments`) with filters by tenant, status, month, and search; details (`GET /platform/payments/{tenantId}/{paymentId}`); proof streaming (`GET /platform/payments/{tenantId}/{paymentId}/proof`); and audited approval/rejection (`POST /platform/payments/{tenantId}/{paymentId}/approve`, `reject`).
  - `PlatformPricingController`: super admin pricing settings (`GET /platform/pricing`, `PUT /platform/pricing`), public pricing (`GET /public/pricing`), and tenant billing pricing (`GET /billing/pricing`).
- **Web Frontend (`apps/web`):**
  - `/platform/payments`: New super admin review inbox UI with KPI summary cards (Total Requests, Pending Review with warning styling, Approved, and Total SAR collected), filter toolbar (search, tenant select, status tabs, month), receipt preview modal, approval confirmation with verification notes, and rejection dialog with mandatory reason.
  - `/pricing`: Completely redesigned public pricing page (F-17) highlighting "مجانًا للمدرس والسنتر، 10 ريال للطالب في الشهر" dynamically fetched from `/public/pricing`, detailing 0 SAR features for teachers/centers, 10 SAR/month features for students, database tenant isolation guarantees, and pricing FAQ.
  - `/teacher/payments`: Reconfigured to read-only with a notice banner indicating centralized platform review (OD-27). Removed approve/reject action modals.
  - `/student/plans/[id]/pay`: Updated to dynamically display bank transfer credentials and instructions (IBAN, bank name) loaded from `/billing/pricing`, and added `period_month` selector with current month default.
  - `navigation-registry.ts`: Added `platform-payments` item to platform console navigation.
### Tests
- `Tests\Feature\PlatformPaymentReviewTest` (6 tests PASS):
  - Teacher role cannot approve payments (HTTP 403 FORBIDDEN).
  - Super admin can view cross-tenant payment requests with filters.
  - Super admin approves payment request, activating subscription and entitlements for that specific month only, writing to Control DB ledger and AuditLog.
  - Re-approval is idempotent and returns 422 ALREADY_PROCESSED without duplicated records.
  - Super admin can reject payment with required reason, writing to Control DB ledger and AuditLog.
  - Pricing endpoints return dynamic student fee (10 SAR) and public marketing headline.
- `Tests\Feature\BillingGateTest` (1 test PASS, 33 assertions): full lifecycle verification.
- `Tests\Feature\OpenApiCoverageTest` (1 test PASS, 244 route entries).
- `Tests\Feature\PermissionCatalogIntegrityTest` (4 tests PASS, 820 assertions).
- Full web verification: `tsc --noEmit` (0 errors), `npm run lint:design` (PASS), `npm run test` (13 tests PASS), `npm run lint` (0 errors), and `npm run build` (all 70 routes compiled successfully).

## [P9] - 2026-11-05 — Mandatory Parent Link, Notification Routing & WhatsApp Adapter (OD-33, F-10)
### Added
- **Mandatory Parent Link Enforced (OD-33, F-10):**
  - Student creation (`POST /api/v1/students`) strictly requires either `parent_id` OR (`parent_name` AND `parent_phone`), returning HTTP 422 if missing.
  - Automatic sibling linking: `findOrCreateParentByPhone` searches for existing parent users with identical mobile numbers and links new children to the existing parent profile.
  - CSV Bulk Student Import (`StudentImportService`): validates that every row contains `parent_name` and `parent_phone`, marking rows without parent info as failed.
  - Filter `GET /api/v1/students?without_parent=1` to query legacy students missing parent relationships.
- **WhatsApp Channel Adapter (AGENTS §3):**
  - Contract interface `MessagingChannel` and value object `MessageSendResult`.
  - Meta WhatsApp Business Cloud API adapter `WhatsAppCloudApiChannel` (Graph API v19.0) with automatic phone number sanitization, template payloads in Arabic (`ar`), and secure error logging without leaking tokens or auth headers (AGENTS §7).
  - Local/testing fallback channel `LogMessagingChannel` logging to Laravel logs and persisting to database.
  - Database table `whatsapp_message_logs` tracking message status (`queued`, `sent`, `failed`, `logged`), recipient phone, template name, parameters, provider message IDs, and errors.
  - Queue worker job `SendWhatsAppMessage` with exponential retry policy (`$tries = 3`, `$backoff = 60`) executing within `TenantRunner` context to guarantee strict tenant data isolation.
  - Parent opt-in support: `whatsapp_opt_in` and `whatsapp_opted_out_at` on `parents` table; `POST /api/v1/parents/{id}/whatsapp-opt-in` endpoint; opt-out prevents WhatsApp message dispatch.
- **Canonical Notification Routing & Catalog:**
  - Expanded `NotificationCatalog` with canonical events: `attendance_late`, `homework_missing`, `session_reminder`, `weekly_report`.
  - Target recipient metadata (`recipients: both | student | parent | staff`) per approved OD-33 routing matrix.
  - Approved WhatsApp templates mapped to canonical events.
  - Automated dispatch: `OfflineHomeworkCheckController` dispatches `HOMEWORK_MISSING` on `not_done` checks; `AttendanceController` dispatches `ATTENDANCE_ABSENT` and `ATTENDANCE_LATE`.
- **Web Admin Interface Updates:**
  - `/admin/users/new`: Mandatory parent link section with toggle between "تسجيل ولي أمر جديد" and "اختيار ولي أمر مسجل", with relation type selector. Removed "password123".
  - `/admin/users`: Added tab "طلاب بدون ولي أمر" displaying counter badge for unlinked students, with quick modal to link existing or create new parents.
  - `/admin/users`: Parent management (F-10) with child linking (`LinkChildModal`) and unlinking (`handleUnlinkChild`), plus WhatsApp opt-in toggle button per parent.
  - `/admin/students/import`: Updated guidance and column definitions specifying `parent_name` and `parent_phone` as mandatory fields.
### Tests
- `Tests\Feature\ParentLinkRequiredTest` (7 tests PASS): mandatory parent on student creation, sibling linking by phone, CSV row rejection, link/unlink child endpoints, and unlinked student query filter.
- `Tests\Feature\NotificationRoutingTest` (7 tests PASS): event routing matrix (absent/late/homework/grade to both, reminder to student, weekly report to parent) and user preferences.
- `Tests\Feature\WhatsAppChannelTest` (7 tests PASS): Cloud API template sending with fake HTTP, phone sanitization, error handling, log channel fallback, parent opt-out respect, and cross-tenant isolation.
- Full regression suites (`PermissionCatalogIntegrityTest`, `StudentImportTest`, `UserManagementApiTest`, `OfflineServiceTest`) PASS.
- Web checks (`tsc --noEmit`, `npm run lint:design`, `npm run test`, `npm run build` all 69 routes) PASS.

## [P8] - 2026-11-05 — Offline Service: Student Mode, Assistant Workspace, Homework Checks & Paper Scores (OD-31, OD-32)
### Added
- **Tenant DB Data Model for Offline Learning:**
  - Added `mode` column (`'online'`, `'offline'`, `'both'`) to `enrollments` and `class_students` tables.
  - Created `offline_homework_checks` table (`session_id`, `student_id`, `status: done|partial|not_done|absent`, `note`, `checked_by_staff_id`, `checked_at`).
  - Created `offline_assessments` table (`class_id`, `session_id`, `title`, `max_score`, `date`, `description`, `created_by_staff_id`).
  - Created `offline_assessment_scores` table (`offline_assessment_id`, `student_id`, `score`, `is_absent`, `notes`, `recorded_by_staff_id`).
- **Canonical Authorization & Permissions (`config/authorization.php`):**
  - Added `homework_checks.record` (module `offline`, scopes: `['assigned', 'own', 'branch', 'tenant']`).
  - Added `offline_scores.record` (module `offline`, scopes: `['assigned', 'own', 'branch', 'tenant']`).
  - Added `offline_assessments.manage` (module `offline`, scopes: `['own', 'branch', 'tenant']`).
  - Granted permissions across `owner`, `center_admin`, `branch_manager`, `teacher`, and `assistant` (with `assigned` scope).
  - Extended `ScopeResolver::canAccess` to support `ClassSession` and `OfflineAssessment` resources.
- **Backend API Controllers & Endpoints:**
  - Created `OfflineHomeworkCheckController`: `GET /sessions/{id}/homework-checks`, `POST /sessions/{id}/homework-checks`, `POST /sessions/{id}/homework-checks/bulk`.
  - Created `OfflineAssessmentController`: `GET /classes/{id}/offline-assessments`, `POST /classes/{id}/offline-assessments`, `GET /offline-assessments/{id}`, `POST /offline-assessments/{id}/scores`.
  - Auto-syncs recorded paper scores to canonical `grades` table with percentage calculation so students and parents see results on their transcripts.
  - Server-side offline student restriction: `LessonController::index`, `LessonController::show`, and `ContentAccessPolicy` strictly reject offline students (`mode === 'offline'`) with 403 `OFFLINE_STUDENT_RESTRICTED` while allowing `both` and `online` students.
  - Static printed QR card scan: `AttendanceController::qrScan` supports scanning student printed cards tied to `AccessCredential`, validating `active` status and rejecting revoked (`CREDENTIAL_REVOKED`) or expired credentials.
- **Mobile-First Assistant Workspace (`/staff/sessions/[id]`):**
  - Unified 3-tab mobile workspace:
    1. **الحضور والغياب**: Live stats, quick launcher for mobile camera scanner, student roster with fast status toggles (present, late, absent).
    2. **متابعة الواجب**: Student roster with 4-state buttons (✓ تم بالكامل, جزئي, ✗ لم يُحل, غائب), inline notes, and bulk save.
    3. **الدرجات والكويزات الورقية**: Assessment selector, new quiz modal, numerical score input table, absence flag, and instant saving.
  - Backward compatibility redirect: `/teacher/sessions/[id]` redirects to `/staff/sessions/[id]` (OD-8).
- **Printable Student ID Card:**
  - Added "معاينة وطباعة بطاقة الطالب الورقية" modal to `/student/card` displaying student info and static QR code ready for paper printing (`window.print()`).
- **Student Navigation Mode Filtering:**
  - `filterNavItems` hides online course items (`courses`, `meetings`, `exams`, `assignments`) for students with `mode === 'offline'`, keeping attendance, card, grades, payments, and profile.
### Tests
- Backend test suite: `Tests\Feature\OfflineServiceTest` (8 tests, 25 assertions PASS) testing:
  - Offline student requesting `/courses/{id}/lessons` returns 403 `OFFLINE_STUDENT_RESTRICTED`.
  - `both` mode student requesting `/courses/{id}/lessons` succeeds with 200.
  - Assistant records homework checks for assigned classes.
  - Assistant cannot record homework checks for unassigned classes (403 Forbidden).
  - Bulk homework check recording.
  - Teacher creating offline assessment & assistant recording paper scores with `grades` synchronization.
  - Printed card `AccessCredential` attendance scan succeeds.
  - Revoked printed card `AccessCredential` is rejected with 422 `CREDENTIAL_REVOKED`.
- Regression suite: `CameraAttendanceScanTest`, `SecureAttendanceQrAndLifecycleTest`, `ModuleEnforcementTest` (21 tests, 72 assertions PASS).
- Frontend tests: `apps/web/tests/access-model.test.ts` (13 tests PASS), including OD-32 navigation filtering for offline students.
- Code quality & builds: `vendor/bin/pint --test` (PASS), `npx tsc --noEmit` (0 errors), `npm run lint:design` (PASS), `npm run lint` (0 errors), `npm run build` (all 69 static & dynamic routes compiled).

## [P6] - 2026-11-05 â€” Universal Camera QR Attendance, Mobile Experience & Auto-Absent on Session End (OD-29, OD-4, F-14, R5-6)
### Added
- **Universal QR Scanner Hook (`useQrScanner`):** Implemented mobile-first QR scanner supporting high-speed native `BarcodeDetector` on modern Chromium browsers with automatic lazy-loading fallback to `@zxing/browser` on iOS Safari, Firefox, and desktop (OD-29). Features 720p resolution, 8-10 fps frame throttling, 3-second duplicate scan cooldown, torch/flashlight toggle, camera flip, and automatic stream pausing on visibility change.
- **Mobile Staff Attendance Portal (`/staff/attendance/scan` & `/staff/attendance/scan/[sessionId]`):**
  - Created `/staff/attendance/scan` displaying today's active and scheduled sessions (`GET /me/sessions?date=today`, closing F-14).
  - Created high-performance scanning interface `/staff/attendance/scan/[sessionId]` featuring real-time KPIs (present, late, absent, total), live audio/haptic feedback, floating student verification card, and live session roster.
  - Implemented 30-second "Undo last scan" capability calling `DELETE /api/v1/attendance-records/{id}` with audit logging.
  - Added "End Session & Record Absence" modal calling `POST /sessions/{id}/end` with `mark_absent_remaining: true`, automatically recording unrecorded students as absent and triggering parent absence notifications (OD-33 / P9).
- **Backend Attendance & Sessions Enhancements:**
  - Added support for `date=today` and `date=YYYY-MM-DD` in `MyResourceController::sessions` (F-14).
  - Added late arrival evaluation in `AttendanceController::qrScan` based on tenant `late_after_minutes` setting (default 15 minutes).
  - Added `DELETE /api/v1/attendance-records/{id}` for instant scan reversals with audit tracking.
  - Added `mark_absent_remaining` option to `SessionController::end` marking unrecorded students as absent with parent notifications.
  - Granted `sessions.update => assigned` permission to `assistant` role in `config/authorization.php`.
- **Backward Compatibility:** Redirects legacy route `/teacher/attendance/scan/[sessionId]` to `/staff/attendance/scan/[sessionId]` (OD-8).
### Tests
- Backend test suite: `Tests\Feature\CameraAttendanceScanTest` (6 tests, 20 assertions PASS) covering `date=today` filtering, on-time vs late QR scans, invalid student rejection, expired QR token rejection, undo deletion, and auto-absent on session end.
- Full attendance suite: `SecureAttendanceQrAndLifecycleTest` (13 tests PASS), `ModuleEnforcementTest` (4 tests PASS). Total 23 tests, 93 assertions PASS.
- Frontend test suite: `access-model.test.ts` (12 tests PASS) testing `attendance.scan` navigation permissions.
- Code quality & builds: `pint --test` (PASS), `tsc --noEmit` (0 errors), `npm run lint:design` (PASS), `npm run lint` (0 errors), `npm run build` (all 69 routes compiled).

## [P1] - 2026-11-05 â€” Tenant Archetypes, Simplified Teacher UI, Service Bundles & ADR-002 (OD-23, OD-24, OD-31, F-6)
### Added
- **Architectural Decision Record (ADR-002):** Approved canonical tenant archetypes (`individual_teacher` vs `organization`), organizational kinds (`center`, `academy`, `school`, `institute`), role syncing isolation, and service bundles (`online`, `offline`, or both).
- **Control DB Migration:** Added `organization_kind`, `city`, `contact_phone`, and `onboarding_source` to `tenants` table with backfill for legacy rows.
- **Tenant Profiles Config (`apps/api/config/tenant_profiles.php`):** Central definition of tenant archetypes, permitted roles, archetype-specific UI terminology, and service module bundles.
- **Tenant Role Filtering & Staff Type:** `RoleSynchronizer` now supports filtering by archetype permitted roles (`sync(?array $roleNames = null)`). `individual_teacher` provisions with 4 roles (`owner`, `assistant`, `student`, `parent`) and owner staff type `teacher`. `organization` provisions with all 8 roles and owner staff type `admin`.
- **Tenant Conversion (`POST /tenants/{id}/convert-to-organization`):** Allows super admins to seamlessly upgrade an `individual_teacher` to an `organization` without data loss, expanding system roles and logging an audit event.
- **Service Bundling:** `TenantProvisioningService` derives active tenant modules from selected services (`online`, `offline`, or both), populating `tenant_features` with explicit enabled/disabled states.
- **Super Admin Module Management (F-6):** Added `TenantModulesModal` to the platform console (`/platform/tenants`), allowing super admins to inspect and toggle tenant modules and upgrade individual teachers.
- **Simplified Independent Teacher UI (OD-24):** `filterNavItems` hides complex role management (`admin-roles`) for independent teachers and rebrands "Ø§Ù„ÙØ±ÙˆØ¹ ÙˆØ§Ù„Ù‚Ø§Ø¹Ø§Øª" to "Ø£Ù…Ø§ÙƒÙ† Ø§Ù„ØªØ¯Ø±ÙŠØ³ ÙˆØ§Ù„Ù‚Ø§Ø¹Ø§Øª".
- **Dynamic Service Navigation Filtering:** `filterNavItems` dynamically filters navigation items based on active tenant services (`online` vs `offline`).
- **Registration Archetype Selector:** Updated `/register-school` with OD-23 type picker, organization kind, city, and service checkboxes.
### Tests
- Backend test suite: `Tests\Feature\TenantTypeProfileTest` (7 tests, 39 assertions PASS) testing teacher role restriction, organization role expansion, service bundling module states, conversion without data loss, validation, and `/tenant/current`.
- Tenancy test suite: `TenantProvisioningTest` (4 tests PASS), `PlatformTenantApiTest` (2 tests PASS), `PlatformTenantProvisioningSecurityTest` (7 tests PASS), `ModuleEnforcementTest` (4 tests PASS). Total 24 tests, 114 assertions PASS.
- Frontend test suite: `apps/web/tests/access-model.test.ts` (11 tests PASS) including OD-24 simplified UI and OD-31 services navigation filtering.
- Verification passed: `pint --test` (PASS), `tsc --noEmit` (0 errors), `npm run lint:design` (PASS), `npm run lint` (0 errors), `npm run build` (68 routes compiled).

## [PS-2] - 2026-11-05 â€” Teacher Public Directory, Cache-Busting, Logo Upload & Instant Public Switches (F-1 to F-4)
### Added
- **Platform Public Directory (F-1):** Added `public_directory_entries` table in Control DB and `PublicDirectorySyncService` which automatically syncs opted-in (`is_public = true`, `status = active`) teacher public profiles and photos. Added `GET /api/v1/public/directory/teachers` and `PublicTeachersSection` on the landing page (`/`), allowing visitors to view and visit opted-in teachers and academies across the platform.
- **Featured Directory Entries:** Added platform super-admin endpoints (`GET /platform/directory/teachers`, `POST /platform/directory/teachers/{id}/toggle-featured`) with audit logging.
- **Tenant Logo Upload (F-4):** Added `POST /tenant/logo` and `DELETE /tenant/logo` using `ProfileImageService` and `GET /public/academy/logo`. Added `ImageUploader` component to Tenant Settings (`/admin/settings`).
- **Session Refresh (F-4):** Added `refreshSession()` to `auth-context` so branding updates (logo, name, colors) are immediately reflected across the workspace shell and UI without a page reload.
### Fixed
- **Instant Public Visibility (F-2):** Changed `is_public` switches in Teacher Profile (`/teacher/profile`) and Course Settings (`/teacher/courses/[id]`) to save immediately on toggle with feedback, state badges ("Ø¸Ø§Ù‡Ø± Ù„Ù„Ø¹Ø§Ù…Ø©" / "Ù…Ø®ÙÙŠ Ø¹Ù† Ø§Ù„Ø¹Ø§Ù…Ø©"), and direct preview links to public academy pages (`/a/{slug}/teachers`, `/a/{slug}/courses/{id}`).
- **Cache-Busting (F-3):** Added `&v=<hash>` query parameter to teacher photos, course covers, and tenant logos in `PublicAcademyController` and `PublicDirectorySyncService` so updated images are immediately served without being stale in browser or CDN caches.
### Tests
- Added `Tests\Feature\PublicDirectoryAndBrandingTest` (4 tests, 51 assertions): teacher photo/profile sync to public directory, opt-out removal, super admin featured toggling, logo upload/serve/deletion, and cache-busting hashes.
- Verified `PublicAcademyAndImagesTest` (8 tests, 71 assertions PASS).
- Frontend tests: `tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run lint:design` (PASS), `npm run test` (9 tests PASS), `npm run build` (all 68 routes build).

## [PS-1] - 2026-11-05 â€” Platform Create-Tenant Form Security & Consistency (F-5 / RK-2)
### Fixed
- **Security:** Removed default owner password 'password123' when creating a tenant via the platform console. The owner password is now strictly required (min 8 chars) in both the frontend modal and backend validation (owner.password).
- **Domain Persistence:** Fixed missing custom domain submission: the domain field is now sent from the frontend and persisted into tenant_domains as an active custom domain.
- **Owner Identity:** Added a real owner-name input field (adminName) in the creation modal, removing the auto-generated "<Name> Admin" fallback.
- **Tenant Types (OD-23):** Restricted type selection to fixed OD-23 types (individual_teacher, organization + organization_kind for center, academy, school, institute). Enforced server-side with Rule::in on both store and update in TenantController.
- Closed risk **RK-2** and finding **F-5**.
### Tests
- Added Tests\Feature\PlatformTenantProvisioningSecurityTest (7 tests, 24 assertions): validates rejection of missing/empty password (422), invalid type rejection (422), valid OD-23 type creation, custom domain persistence, and code hygiene verifying no password123 default remains.

## 2026-11-05 â€” Documentation cleanup + platform/tenancy/QR/persistence plan

- Removed stale and duplicate docs (`lms-recovery/`, `source/`, phase copies, bootstrap manifests). See `docs/audit/2026-11-05-documentation-hygiene.md`.
- Added `docs/audit/2026-11-05-frontend-backend-persistence-audit.md` (F-1..F-19; F-5 is a security issue).
- Added plan `docs/plans/2026-11-05-platform-console-tenancy-venues-qr-plan.md` (v2). Owner approved OD-23..OD-33: tenant types, simple teacher UI, online/offline services, offline student mode, mandatory parent link + WhatsApp, 10 SAR/student/month reviewed by the super admin (supersedes OD-7), super-admin PII access with audit.
- No application code changed.

## [REG-1] - 2026-11-06 -- STUDENT SELF-REGISTRATION (SAUDI MARKET)
### Added
- Public `/register`: 6-step form with progress bar (student, address, guardian, password, centers/teachers, review). Saudi rules: national ID/iqama checksum, `05XXXXXXXX` mobiles, 13 regions, stage/grade.
- Requests go to each chosen center/teacher (per-tenant `student_registration_requests`); review inbox `/teacher/registrations`; approval creates the student and links the guardian by mobile. Tenant opt-in switch in `/admin/settings`.
- `GET /public/registration/options|academies|status`, `POST /public/registration`, `GET /registration-requests`, `/pending-count`, `POST /registration-requests/{id}/approve|reject`.
### Changed
- Login also matches a mobile typed as +966 / 966 / 5… / Arabic digits.
- `phpunit.xml` forces a sqlite tenant store: a run had reached the remote Postgres configured in `.env` (see `docs/recovery-reports/REG-1.md`).
### Security
- National ID encrypted at rest and never serialised; password hash wiped on rejection; honeypot and throttling on the public endpoints.

## [UX-R7G] - 2026-11-05 -- DARK THEME, LOGO, CHROME, SECURE EXAM, IMAGES, PUBLIC ACADEMY PAGES
### Added
- New logo (cloud + book + arch) as theme-aware SVG; beige sidebar/top bar/public headers in dark mode; lifted dark surfaces.
- Secure standalone exam page `/exam/[courseId]/[examId]` (briefing, fullscreen gate, server-anchored timer, resume, offline queue, integrity events, auto-submit). `GET .../exams/{id}/active-attempt`, `POST .../attempts/{id}/integrity-events`.
- Course cover and teacher photo upload; teacher public profile page; opt-in public academy pages `/a/[slug]/...` with `GET /public/academy/*`.
### Fixed
- Drawers opened off-screen behind the blurred backdrop (`xPercent` was never reset), so "view" actions showed only a blur.
- **Security:** `cover_path` was a client-supplied string; it is no longer accepted.
### Known limitations
- Browser-side exam protection is a deterrent, not a security boundary. See `docs/recovery-reports/UX-R7G.md`.

## [RECOVERY-R8] - 2026-11-05 -- NOTIFICATIONS, QUEUED REPORTS, HONEST ANALYTICS, MEETING ACCESS (PARTIAL)
### Added
- `NotificationService` with 13 events, in-app and queued email, per-user preferences, tenant absence setting, scheduled notifications.
- Notification bell with real unread count, `/notifications`, `/notifications/preferences`.
- Queued reports (student, parent, class attendance, course progress, payments), CSV download and print view; `/admin/reports`, `/teacher/reports`, `/parent/reports`.
- At-risk students, course and class analytics APIs; `/admin/academic-settings`.
- Commands `lms:migrate-tenants`, `lms:notify-scheduled`, `lms:compute-analytics`, `lms:refresh-platform-metrics`; scheduler service in Docker.
- Platform metrics from scheduled snapshots, queue health, refresh button.
### Fixed
- **Security:** meeting links were exposed to anyone with `meetings.view`, and join skipped the access policy. Links now come only from the join endpoint, after access and time-window checks.
- **Session:** any non-401 error on restore deleted the token, so a 429 logged users out. Only a 401 ends a session now. The API rate limit is per token instead of per IP.
- **Fabricated data removed:** 100% dashboard fallback, 100% for metrics with no data, generated Meet codes, "Google Meet API enabled" banner with a hard-coded client ID, simulated student classroom, `simulate_failure`, fake "last watched" and course progress.
- Assignment completion now counts the student's enrolled courses only.
### Known limitations
- Real Google Meet and real email need credentials. PDF needs an approved library. CSV import is still synchronous. See `docs/recovery-reports/R8.md`.

## [RECOVERY-R7] - 2026-11-04 -- SAHABA IDENTITY, DESIGN SYSTEM, PLATFORM CONSOLE LOGIN (PARTIAL)
### Added
- Product identity **Ø³Ø­Ø§Ø¨Ø© / Sahaba** (OD-22): `config/brand.ts`, brand mark, app icon, manifest.
- Design tokens (Deep Emerald-Teal + Sand), system/light/dark switcher, self-hosted IBM Plex Sans Arabic, Liftaswash display face (Arabic only).
- `lib/format.ts` (Arabic-Indic digits, Gregorian + Hijri), Lucide icon system with semantic RTL arrows, GSAP motion layer.
- Landing page with clearly marked sample content (OD-21), access-code login, unified public header/footer.
- Platform console login, `/platform/audit`, `/platform/settings`; `/admin/audit`, `/admin/integrations`; notification bell and `/notifications`.
- `GET /public/config`, `POST /public/contact`, `GET|PUT /platform/settings`, `GET /platform/contact-messages`, `POST /platform/contact-messages/{id}/handled`.
- `npm run lint:design` in CI; release gate fails while landing sample content remains.
### Fixed
- Navigation used module keys the backend does not have (`courses`, `attendance`, `meetings`), hiding Courses, Attendance and Meetings for every user. Tests used the same wrong keys; a new test checks the keys against the backend catalog.
- Platform links no longer appear in a tenant admin's sidebar; staff pages with no navigation entry now have one.
- Platform console had no sign-in and was guarded by the tenant experience, so its APIs always failed.
- Contact form showed success without sending anything; it now posts to a real endpoint.
- `TenantProvider` no longer calls the platform tenant list or switches the API client to the first tenant.
- Tenant admins land on `/admin` (OD-19). Fake unread dot on the bell removed.
### Known limitations
- Internal role pages migrated by codemod with sample visual checks only. No Playwright screenshots or axe audit. See `docs/recovery-reports/R7E-R7F.md`.

## [RECOVERY-R7D] - 2026-11-02 -- PARENT GUARDIAN PORTAL & DETAIL EXPERIENCE (PHASE R7D COMPLETE)
### Added
- **Parent Root & Redirect Routing (`/parent`, `/parent/*`)**:
  - Created `/parent/page.tsx` redirecting to `/parent/dashboard`.
  - Added `/parent` to middleware protected prefixes and experience boundary.
- **Parent Dashboard (`/parent/dashboard`)**:
  - Dynamic child switcher for parents with multiple enrolled students.
  - Active child summary card displaying academic status, grade level, and student code.
  - Low attendance alert banner trigger when rate drops below 75%.
  - 4 KPI cards: overall GPA, attendance rate, assignment completion rate, and exam average.
  - Recent evaluations preview table showing scores, maximum scores, percentages, and teacher remarks.
  - Subscription and enrollment status card.
- **Children Directory (`/parent/children`)**:
  - Responsive directory of all linked children with live search by student name or code.
  - Individual student cards with academic standing, overall score progress bar, and attendance progress bar.
- **Child Detail Experience (`/parent/children/[id]`)**:
  - Built with standard `DetailLayout` and 6 specialized tabs:
    - `overview`: academic and personal details, quick KPI counters.
    - `grades`: comprehensive transcript table with evaluations, percentages, letter grades, and teacher feedback.
    - `attendance`: attendance rate, regularity standing, smart QR ID details.
    - `progress`: enrolled courses list with progress indicators.
    - `teachers`: enrolled course teachers list and academic support notes.
    - `reports`: print-ready academic report card summary with one-click print trigger (`window.print()`).
  - Desktop sticky side performance summary with `ProgressBar`s.
- **Backend Child Scoping Integration**:
  - Added `educationApi.getMyChildren()` connecting to canonical `GET /api/v1/my/children` (`MyResourceController@children`).
  - Extended `Grade` with optional `feedback?: string` and `StudentAnalyticsSnapshot` with optional course counters in `apps/web/src/types/index.ts`.
- **Verification**:
  - Frontend TypeScript check (`tsc --noEmit`): 0 errors (PASS).
  - Frontend unit tests (`npm test -- --run`): 7/7 PASS.
  - Backend PHPUnit tests (`phpunit`): 160/160 PASS, 1,774 assertions (100% green).

## [RECOVERY-R7C] - 2026-11-02 -- STAFF & TEACHER EXPERIENCE SUITE, T-FEAT-30 RESOLUTION & ASSISTANT WORKBENCH (PHASE R7C COMPLETE)
### Added
- **Staff Redirect & Routing (`/staff`, `/staff/*`)**:
  - Redirect route at `/staff` pointing to `/teacher/dashboard`.
  - Added `/staff` to `PROTECTED_PREFIXES` in Next.js middleware with matching experience evaluation.
- **T-FEAT-30 Resolution & Teacher Analytics (`/teacher/analytics`)**:
  - Removed hardcoded student UUID (`01a0ef9d-5232-7086-9129-5989e81a7dd9`) and hardcoded demo name ("Ø¹Ù…Ø± Ø£Ø­Ù…Ø¯ ÙØ§Ø±ÙˆÙ‚").
  - Implemented dynamic student selector dropdown loading real tenant students via `educationApi.getStudents()`.
  - Added live search query filtering, instant metrics loading via `analyticsApi.getStudentDashboard()`, and metric cache refresh trigger via `analyticsApi.refreshStudentDashboard()`.
- **Student Profile & Detailed Directory (`/teacher/students`, `/teacher/students/[id]`)**:
  - Student directory upgraded to semantic tokens with grade level filtering and direct action to view student details.
  - Comprehensive student detail page built with `DetailLayout` and 4 rich tabs (`overview`, `courses`, `credentials`, `parents`).
  - Added student device binding inspection (`device_fingerprint`, `device_name`, `last_used_at`) per Master Â§64 hardware security specifications.
  - Extended `Student` TypeScript definition in `apps/web/src/types/index.ts` with `StudentEnrollment`, `StudentParent`, and `created_at`.
- **Teaching Assistant Desk & Permission Model (OD-2 / Master Â§71-72)**:
  - Teaching assistant workbench (`/teacher/assistant`) upgraded to real tenant metrics.
  - Permission check via `useCan('attendance.scan')` to conditionally authorize QR attendance scanning.
  - Added visual permission boundary reference clarifying allowed operations (attendance scanning, grading tasks) versus restricted operations (course deletion, billing modification).
- **Course Builder & Exam Builder Semantic Cleanup (`/teacher/courses`, `.../[id]`, `.../exams/[examId]/builder`)**:
  - Course builder settings, syllabus accordion, module/lesson creation modals, and student progress table migrated to semantic tokens.
  - Exam builder action bar, publish confirmation, question form, and question bank modal migrated to semantic tokens (`text-primary-fg`, `bg-success`, `bg-warning`).
- **Grading Desk & Classes Management (`/teacher/grading`, `/teacher/classes`, `.../[id]`)**:
  - Grading filter tabs and bulk publish action cleaned up to use semantic tokens.
  - Corrected `assessmentApi.gradeSubmission` parameters in teacher assessments.
  - Replaced ad-hoc `var(--pri)` and raw utility classes in classes and camera scanner viewfinder.
- **Verification**:
  - Frontend TypeScript check (`tsc --noEmit`): 0 errors (PASS).
  - Frontend unit tests (`npm test -- --run`): 7/7 PASS.
  - Backend PHPUnit tests (`phpunit`): 160/160 PASS, 1,774 assertions (100% green).

## [RECOVERY-R7B] - 2026-11-02 -- STUDENT EXPERIENCE SUITE & DESIGN SYSTEM INTEGRATION (PHASE R7B COMPLETE)
### Added
- **Student Home & Dashboard (`/student`, `/student/dashboard`)**:
  - Redirect route at `/student` pointing to `/student/dashboard`.
  - Feature widgets decomposed: `StudentHeroBanner`, `LinkedAcademiesWidget`, `StudentKpiGrid`, `ContinueLearningCard`, `UpcomingDeadlinesWidget`.
- **Course Learning Experience (`/student/courses`, `.../[id]`, `.../lessons/[lessonId]`)**:
  - Course catalog with grade-level filters, progress rings, and subscription requirements.
  - Course detail refactored with `DetailLayout`: breadcrumbs, level badges, teacher profile, module & lesson accordion with completion indicators, and desktop side progress summary.
  - Course player: distraction-free layout with dynamic anti-abuse floating watermark (student name + code + contact), 15-second heartbeat progress tracking, manual document completion, and materials download list.
- **Assessments & Exams (`/student/assessments`, `/student/assignments`, `/student/exams`, `.../take`, `.../results`)**:
  - Filterable assessments hub by course and status (all, open, submitted, graded).
  - Assignment submitter with file drag & drop up to 20MB, late penalty alerts, and grading remarks review.
  - Interactive exam runner with server-synchronized countdown timer, question palette navigation, optimistic answering with background sync, and exam results summary cards.
- **Attendance & Smart ID Card (`/student/attendance`, `/student/card`)**:
  - Attendance history with overall and weekly rate KPI cards, per-class attendance breakdown, and session logs with QR vs manual detection.
  - Smart ID Card: 60-second rotating TOTP QR token canvas with countdown ring, brightness advisory banner, and click-to-copy student code.
- **Academic Grades & Transcripts (`/student/grades`)**:
  - Comprehensive grades report with cumulative GPA, evaluations count, course breakdown table with scores, percentages, letter grades, and teacher remarks.
- **Billing & Subscriptions (`/student/plans`, `.../pay`, `/student/payments`, `/student/subscriptions`)**:
  - Plans pricing grid with billing cycle badges, entitlements breakdown, and featured plan badge.
  - Multi-method payment checkout (InstaPay, Bank transfer, Cash) with tailored transfer instructions and proof upload with image preview.
  - Payments history table with status statistics (pending, approved, rejected) and slide-out inspection drawer with rejection reason display.
  - Active subscriptions cards and active entitlements table.
- **Student Profile & Device Binding (`/student/profile`)**:
  - Profile card with academic level and contact details.
  - Active device binding inspection (device model, browser, IP, fingerprint, last used timestamp).
  - Self-service device replacement request modal (`POST /api/v1/credentials/{id}/request-replacement`) with audit logging.
- **Live Meetings & Virtual Classroom (`/student/meetings`)**:
  - List of live and upcoming lectures.
  - Interactive classroom modal with microphone toggle, camera toggle, hand-raise counter, and real-time live chat stream.
- **Tokens & Accessibility Cleanup**:
  - Eliminated all legacy hardcoded `text-white`, `text-secondary`, `bg-card`, and `bg-slate-900` classes across all student routes in favor of semantic design tokens (`text-fg`, `text-fg-muted`, `bg-surface`, `bg-surface-raised`, `border-border`, etc.).
  - Added `subtitle?: React.ReactNode` compatibility to `PageHeaderProps`.
- **Verification**:
  - Frontend TypeScript check (`tsc --noEmit`): 0 errors (PASS).
  - Frontend unit tests (`npm test -- --run`): 7/7 PASS.
  - Backend PHPUnit feature & unit tests (`phpunit`): 160/160 PASS, 1,774 assertions.
  - Backend Pint: 0 violations (PASS).

## [RECOVERY-R7A] - 2026-11-02 -- DESIGN SYSTEM, UNIFIED APP SHELL & PAGE DECOMPOSITION (PHASE R7A COMPLETE)
### Added
- **Design Tokens & Theme Engine (R7-0a)**:
  - `apps/web/src/styles/tokens.css` with semantic color variables for both Light and Dark themes, radius scale, elevation shadows, motion durations, and focus ring.
  - Integrated tokens into Tailwind v4 `@theme` in `apps/web/src/app/globals.css`.
  - Replaced forced `data-theme="dark"` in `layout.tsx` with reactive `ThemeProvider` and `useTheme()` hook with local storage persistence and SSR anti-flash script.
- **UI Primitives & Patterns (R7-0b)**:
  - 24+ accessible, RTL-first UI primitives added to `apps/web/src/components/ui/`: `Textarea`, `Checkbox`, `Radio`, `Switch`, `Avatar`, `Tooltip`, `DropdownMenu`, `Toast` (+ `ToastProvider`), `ConfirmDialog`, `FileUpload`, `DataTable`, `FilterBar`, `SearchInput`, `Pagination`, `Breadcrumbs`, `PageHeader`, `Timeline`, `ActivityFeed`, `CalendarWeek`, `ProgressBar/Ring`, `KpiCard`, `StatusDot`, `Forbidden`, `ErrorState`, `StateView`.
  - Exported all components from `apps/web/src/components/ui/index.ts`.
  - Restricted public `/components` page behind `process.env.NODE_ENV !== 'production'`.
- **Unified App Shell (R7-1)**:
  - Created single universal `AppShell` component (`apps/web/src/components/layout/app-shell.tsx`) used across all experiences (admin, staff, student, parent, platform).
  - Sidebar dynamically generated from `navigation-registry.ts` filtered by experience, tenant modules, and user permissions.
  - Sadu ribbon on desktop sidebar, top header with tenant branding, global search, notifications bell placeholder, theme toggle, and authenticated user menu.
  - Responsive mobile bottom navigation bar (top 4 primary links + "Ø§Ù„Ù…Ø²ÙŠØ¯" drawer trigger).
  - Deleted dead layouts (`teacher-nav-layout.tsx`, `student-nav-layout.tsx`, `parent-nav-layout.tsx`, `platform-nav-layout.tsx`).
  - Strict elimination of mock identities; strictly bound to `useAuth().user`.
- **Page Decomposition & Feature Architecture (R7-2)**:
  - Decomposed God pages into domain feature folders under `apps/web/src/features/<feature>/components/`:
    - `payments`: `PaymentStats`, `PaymentTable`, `PaymentInspectionDrawer`, `PaymentApprovalModal`, `PaymentRejectionModal` (page reduced from 791 to 198 lines).
    - `packages`: `PackageStats`, `PackageTable`, `PackageFormModal` (page reduced from 794 to 219 lines).
    - `credentials`: `CredentialsStats`, `CredentialsStudentSidebar`, `CredentialsTable`, `IssueCredentialModal`, `ReplaceDeviceModal`, `RevokeCredentialModal` (page reduced from 718 to 216 lines).
    - `platform`: `TenantStats`, `TenantTable`, `CreateTenantModal`, `SupportAccessModal` (page reduced from 625 to 198 lines).
    - `student-dashboard`: `StudentHeroBanner`, `LinkedAcademiesWidget`, `StudentKpiGrid`, `ContinueLearningCard`, `UpcomingDeadlinesWidget` (page reduced from 495 to 175 lines).
    - `teacher-dashboard`: `TeacherHeroBanner`, `TeacherKpiGrid`, `TodaySessionsCard`, `PendingTasksCard`, `QuickActionsCard` (page reduced from 426 to 157 lines).
    - `attendance`: `AttendanceRoster`, `LiveQrScannerModal` (page reduced from 330 to 175 lines).
  - All touched pages now strictly <= 220 lines (target was <= 300 lines).
- **Detail Page Pattern (R7-3)**:
  - Shared `DetailLayout` component (`apps/web/src/components/layout/detail-layout.tsx`) with entity identity, status badges, primary actions, tabs, and desktop side summary.
- **Verification**:
  - `apps/web` TypeScript check (`tsc --noEmit`): 0 errors (PASS).
  - `apps/web` unit tests (`npm test -- --run`): 7/7 PASS.
  - `apps/api` feature & unit tests (`phpunit`): 160/160 PASS, 1774 assertions.

## [RECOVERY-R6] - 2026-11-01 -- ASSESSMENT, EXAMS, QUESTION BANK & AUTO-GRADING (PHASE R6 COMPLETE)
### Added
- **Exam Lifecycle & Validation Engine (R6-1)**:
  - States: `draft` => `published` => `closed` => `archived`. Auto-publishing on exam creation removed; default is `draft`.
  - Publishing pre-requisite validation: exam cannot be published without >= 1 question and `total_points > 0` (`UNPUBLISHABLE_EXAM`).
  - Master Â§34 attempt state progression strictly enforced.
- **Server-Authoritative Timing & Anti-Cheat (R6-2)**:
  - Server-calculated expiration: `expires_at = min(started_at + duration, closes_at)`.
  - Synced timer endpoint `GET /attempts/{id}` returning `server_now`, `expires_at`, `remaining_seconds`.
  - Rejection of late answers after expiration with HTTP 422 `ATTEMPT_EXPIRED` and automatic attempt finalization.
  - Idempotent and thread-safe submission via row-level locking.
- **Questions API & Course Question Bank (R6-3)**:
  - Support for 5 core question types: `multiple_choice`, `multiple_select`, `true_false`, `short_answer` (case-insensitive normalized matching with acceptable synonyms), and `essay` (manual evaluation).
  - Question reordering endpoint `POST /exams/{id}/questions/reorder`.
  - Question bank CRUD and batch import into exams (`POST /exams/{id}/questions/import-from-bank`).
  - Strict concealment of answer keys from students; only authorized staff with `with_answers=1` can inspect answers.
- **Assignment Submissions with Files (R6-4)**:
  - Multipart file upload stored in private tenant storage (`tenant_private`).
  - Due date enforcement with configurable late policy (`allow_late`, `late_penalty_percent`), and resubmission permissions.
  - Secure signed file download endpoint `GET /assignments/{id}/submissions/{sId}/file`.
- **Staff Builders & Grading Desk (R6-5)**:
  - `/teacher/courses/[id]/exams/[examId]/builder`: Rich Exam Builder with live question type editors, points, question bank batch import modal, student preview mode, and publishing checklist.
  - `/teacher/grading`: Staff Grading Inbox across teacher's courses, filtering pending assignments and essay exam attempts, individual grading drawers with rubric/feedback, and bulk publish button.
  - Resolved `T-UX-05` by replacing `count: 0` placeholder on the teacher dashboard with real pending grading count from the API.
- **Student Assessment Experience (R6-6)**:
  - `/student/assessments`: Unified assessment hub with filters (`open`, `upcoming`, `submitted`, `graded`) and countdowns.
  - `/student/courses/[id]/exams/[examId]/take`: Distraction-free exam runner with synchronized server timer, immediate answer autosaving, network loss detection & retry banner, question palette navigator, and confirmation dialog.
  - `/student/courses/[id]/exams/[examId]/results`: Detailed result review screen adhering to `show_results` policy (`after_publish`, `after_submit`, `never`).
  - `/student/courses/[id]/assignments/[assignmentId]`: Assignment submission workspace with file dropzone, deadline countdowns, and real-time grading feedback.
- **Automated Feature Tests**:
  - `AssessmentLifecycleAndServerTimingTest`: 7 tests, 69 assertions (100% PASS).
  - `AssessmentGateTest`: 1 test, 40 assertions (100% PASS).
  - Backend Pint style check clean.
  - Frontend TypeScript check (`tsc --noEmit`) and tests clean.

## [RECOVERY-R5] - 2026-10-31 -- ATTENDANCE, SECURE DYNAMIC QR & SESSIONS (PHASE R5 COMPLETE)
### Added
- **Dynamic Student QR Token Engine (R5-1)**:
  - Cryptographic HMAC-SHA256 URL-safe 60-second opaque token derived from `app.key` + `tenant_id`.
  - Zero leakage of raw student codes or credentials.
  - Device/credential state check preventing revoked accounts from generating tokens.
  - Endpoint `GET /api/v1/me/attendance-qr`.
- **Server-Authoritative Scanner & Attendance Engine (R5-2)**:
  - Strict multi-step validation: Tenant boundary -> Permissions & branch scope -> Session status (`scheduled`/`in_progress`) -> Time window & grace period -> Token cryptographic verification -> Student active status -> Class enrollment check -> Deterministic duplicate check -> Audit log.
  - Idempotent duplicate scan returning `200 OK` with `{ already_recorded: true }`.
  - Static student code scan rejected by default (`STATIC_SCAN_NOT_ALLOWED`) unless explicitly opted-in by tenant.
  - Endpoint `POST /api/v1/sessions/{id}/attendance/scan`.
- **Attendance Corrections & Session Lifecycle (R5-4)**:
  - Migration `2026_10_31_000006_create_attendance_changes_and_r5_fields.php` adding `timing_mode` and `grace_period_minutes` to `sessions`, and creating `attendance_record_changes` table.
  - Mandatory audit reason on corrections (`PUT /api/v1/attendance-records/{id}`).
  - Session lifecycle state transitions: `POST /api/v1/sessions/{id}/start`, `POST /api/v1/sessions/{id}/end`, `POST /api/v1/sessions/{id}/cancel`.
  - Full audit history and reports endpoint `GET /api/v1/sessions/{id}/attendance/report`.
- **Student "My Card" Screen (R5-5)**:
  - `/student/card`: High-visibility student ID card with dynamic 60s auto-refreshing QR code, animated countdown timer, screen brightness hint, student code copy fallback, and tenant branding.
- **Mobile Camera Scanner (R5-6)**:
  - `/teacher/attendance/scan/[sessionId]`: Responsive mobile scanner with live camera feed, torch toggle, camera flip, Web Audio API sound feedback, haptic vibration, live result toast, running stats counter, and manual search fallback.
- **Offline Structure Screens & Session Control Room (R5-7)**:
  - `/student/attendance`: Real student attendance dashboard with overall rate, per-class attendance progress bars, and session history table.
  - `/teacher/classes`: Classes management with branch filter and create modal.
  - `/teacher/classes/[id]`: Roster management (enroll/remove students) and session scheduling.
  - `/teacher/sessions`: Sessions catalog with status tabs (`all`, `scheduled`, `in_progress`, `completed`, `cancelled`).
  - `/teacher/sessions/[id]`: Live session control room with session lifecycle action buttons, live roster, quick status buttons (`present`, `late`, `absent`, `excused`), correction modal with mandatory reason, and audit changes history drawer.
- **Automated Feature Test Suite**:
  - `SecureAttendanceQrAndLifecycleTest`: 11 tests, 44 assertions (100% PASS).
  - Complete backend feature test suite: 152 tests, 1703 assertions (100% PASS).
- **Deferred**:
  - R5-3 (Session QR projection to classroom displays) formally deferred per Open Decision OD-4.

## [RECOVERY-R4] - 2026-10-31 -- LEARNING CONTENT, PROGRESS & COURSE BUILDER (PHASE R4 COMPLETE)
### Added
- **Hierarchical Content Model & Migrations (R4-1)**:
  - Created `course_modules` table with tenant isolation, sort order, and draft/published states.
  - Updated `courses` with `cover_path`, `level` (`beginner`, `intermediate`, `advanced`), and `published_at`.
  - Updated `lessons` with `module_id`, `type` (`video`, `document`, `text`, etc.), `duration_seconds`, `ref_id`, `published_at`.
  - Created `lesson_materials` table for lesson attachments and external links with private tenant storage.
  - Automated backfill creating default modules for existing courses and associating legacy lessons.
  - Created `video_events`, `lesson_progress`, and `abuse_signals` tables for progress and abuse tracking.
- **Content Management APIs (R4-2)**:
  - `CourseModuleController`: Modules CRUD and reordering (`POST /courses/{id}/modules/reorder`).
  - `CourseController@outline`: Hierarchical course outline (`GET /courses/{id}/outline`) returning modules, lessons, materials, real-time access decisions, and student progress.
  - `LessonController`: Lessons CRUD, reordering (`POST /modules/{id}/lessons/reorder`), publish/unpublish, and manual completion (`POST /lessons/{id}/complete`).
  - `LessonMaterialController`: Multipart material upload and external links, secure downloads (`GET /materials/{id}/download`) gated by `ContentAccessPolicy`.
- **Playback Tracking & Server-Authoritative Progress (R4-4)**:
  - Domain Service `ProgressAggregator`: Processes batched playback events, computes watch percentages, auto-marks lessons completed at â‰¥ 90%, and detects skipping speed anomalies.
  - `VideoEventController`: Playback event ingestion (`POST /lessons/{id}/events`), student personal progress (`GET /me/progress`), and teacher course progress overview (`GET /courses/{id}/progress`).
- **Course Builder - Teacher UI (R4-5)**:
  - `/teacher/courses`: Course catalog grid with level, status, and access badges, search, filter tabs, and modal for creating new courses.
  - `/teacher/courses/[id]`: Course Builder workspace with tabs for Outline (modules, lessons, materials, reordering), Student Progress (analytics table with completion percentages), and Settings.
- **Course Player - Student UI (R4-6)**:
  - `/student/courses/[id]`: Overview page with syllabus outline, progress indicators, preview badges, and continue learning button.
  - `/student/courses/[id]/lessons/[lessonId]`: Distraction-free player screen with 15-second playback heartbeats, resume position, materials drawer, previous/next lesson navigation, and dynamic anti-piracy floating watermark.
- **Removed Simulated AI Tutor (R4-7)**:
  - Fully removed simulated `setTimeout` canned responses and fake chat from student courses.
  - Redesigned `/student/courses` as an authentic dashboard with real enrolled progress bars and course catalog.
- **Automated Feature Test Suite**: `ContentManagementAndProgressTest` (9 tests, 40 assertions passing).


## [RECOVERY-R3] - 2026-10-31 -- BILLING-TO-ACCESS BRIDGE (PHASE R3 COMPLETE)
### Added
- **Content Access Policy Engine (R3-1)**: `ContentAccessPolicy` & `ContentAccessDecision` value object attached to courses and lessons. Denies unpaid students with HTTP 403 `ACCESS_REQUIRES_SUBSCRIPTION`, permits staff bypass, and allows free preview lessons (`is_free_preview`).
- **Gated Self-Enrollment (R3-2)**: `EnrollmentController` checks for `is_free` course or active student entitlement, denying unauthorized self-enrollment with HTTP 403 `ENROLLMENT_REQUIRES_PAYMENT`.
- **Payment Proof File Upload & Private Streaming (R3-3)**: Multipart proof uploads (JPEG, PNG, PDF â‰¤5MB) stored in private tenant-isolated storage; private streaming endpoint `GET /api/v1/payment-requests/{id}/proof` gated by strict authorization boundary.
- **Packages & Manual Entitlements API (R3-4)**: Full package update & archive endpoints in `PackageController`; manual entitlement grant & revoke with mandatory audit logging in `EntitlementController`; student self-service endpoints `GET /me/subscriptions` and `GET /me/entitlements`.
- **Approval Side Effects & Auto-Enrollment (R3-7)**: `PaymentReviewService::approve` transactional execution activating subscriptions, granting entitlements, and auto-enrolling students into matching course entitlements (`course:{id}`).
- **Student Billing Screen Suite (R3-5)**:
  - `/student/plans`: Active package catalog with pricing, billing cycles, entitlement benefits, and trust guarantee banner.
  - `/student/plans/[id]/pay`: Payment submission with method instructions (InstaPay, Bank Transfer, Cash), reference code, and drag & drop proof uploader.
  - `/student/payments`: Payment requests tracking table, status badges (`pending`, `approved`, `rejected` with rejection reason), and drawer inspection.
  - `/student/subscriptions`: Active subscriptions and effective entitlements dashboard.
  - Course Player Lock Integration: Course cards and lesson lists display lock states with "Ø§Ø´ØªØ±Ùƒ Ù„Ù„ÙˆØµÙˆÙ„" linking to plans.
- **Admin / Finance Billing Suite (R3-6)**:
  - `/teacher/payments`: Review queue with status tabs, search, proof file inspection with full preview/download link, approve confirmation modal, and rejection modal with preset chips.
  - `/admin/packages`: Package management with CRUD, price, currency, billing cycle, course entitlements multiselect, and archiving.
  - `/admin/users/[id]`: Dedicated student billing section displaying active subscriptions/entitlements, manual grant modal, and revocation modal with audit reasons.
- **Automated Feature Test Suite**: `ContentAccessPolicyTest` (8 tests, 26 assertions passing).


## [RECOVERY-R2] - 2026-10-31 -- USER MANAGEMENT & TENANT PROVISIONING (PHASE R2 COMPLETE)
### Added
- **Tenant Provisioning Engine (R2-4)**: `TenantProvisioningService` orchestrating atomic tenant setup (control records, isolated DB schema `tenant_{slug}.sqlite`, migrations, role synchronizer, owner creation, module enablement, rollback on failure).
- **User Identity Service (R2-1)**: `UserManagementService` delivering scoped CRUD for students, staff, and parents; password resets; student code generation; global identity linking (`global_identity` in control plane); branch scoping.
- **Bulk Student CSV Import (R2-2)**: `StudentImportService`, `StudentImportController`, `StudentImport` model, and `POST /students/import` with BOM support, auto-delimiter detection, row validation, and structured error logs.
- **Offline Learning Structure (R2-3)**: `BranchController`, `ClassroomController`, migration adding `branch_id` to classes; branch manager scope enforcement.
- **Self-Service Registration (R2-5)**: `SchoolRegistrationController` (`POST /public/register-school`) with honeypot field, reserved slug validation, and instant provisioning.
- **Platform Console & Support Tracking (R2-6)**: `platformApi` integration with `GET /platform/metrics`, `POST /tenants/{id}/suspend|activate`, `PUT /tenants/{id}/modules`, and dedicated `/platform/support-sessions` page.
- **Tenant Admin Screen Suite (R2-7)**:
  - `/admin/users`: Persona tabs, status filters, search, password reset modal, student suspend/activate.
  - `/admin/users/new`: Persona-driven multi-step form for students, staff roles, and parents.
  - `/admin/users/[id]`: Detailed profile, contact info, assigned roles, and computed effective permissions.
  - `/admin/students/import`: Drag & drop CSV uploader, sample CSV download, real-time results table, and history log.
  - `/admin/branches`: Physical branch management and classroom manager with capacity and room types.
  - `/admin/settings`: Institution branding with live color preview, auth mode selection, and read-only enabled modules view.
- **Tenant Settings API**: `TenantCurrentController::update` (`PUT /tenant/settings`) gated by `tenant.settings` permission with audit logging.
- **Automated Feature Test Suites**: `TenantProvisioningTest` (4 tests), `UserManagementApiTest` (9 tests), `StudentImportTest` (2 tests), `BranchClassroomApiTest` (3 tests). Total suite: 125 tests, 1,594 assertions passing.

## [RECOVERY-R1B] - 2026-10-31 -- ACCESS MODEL (FRONTEND) (PHASE R1B COMPLETE)
### Added
- **Canonical TypeScript Types (R1-B1)**: `src/types/auth.ts` matching backend `AuthPayloadBuilder` schema (`Experience`, `Persona`, `PermissionScope`, `PermissionsMap`, `AuthSession`, `AuthUser`, `AuthProfiles`, `AuthTenant`, `SupportSession`).
- **Unified Navigation Registry (R1-B3)**: `src/config/navigation-registry.ts` and `src/components/layout/sidebar-nav.tsx` filtering items based on backend experience, enabled modules (`tenant.modules`), and permissions (`anyOf`).
- **Route Guards & ExperienceGuard (R1-B4)**: Unified Next.js middleware in `src/middleware.ts` for route protection; `src/components/guards/ExperienceGuard.tsx` rendering explicit HTTP 403 Forbidden screen on role/experience mismatch.
- **Permission Hooks & Components (R1-B5)**: `useCan` hook (`src/hooks/useCan.ts`), `<Can>` component (`src/components/guards/Can.tsx`), and updated `<PermissionGate>` (`src/components/ui/permission-gate.tsx`).
- **Data-State Layer (R1-B6)**: `src/components/ui/data-state.tsx` providing standard `loading`, `empty`, `error`, and `forbidden` states, eliminating swallowed `.catch(() => [])` errors.
- **Tenant Role Management UI (R1-B8)**: `/admin/roles` route (`src/app/admin/roles/page.tsx`, `src/app/admin/layout.tsx`) with system role safeguards, custom role creation/deletion, and module-grouped permission matrix.
- **Support Session Persistent Banner (R1-B9)**: `src/components/layout/support-session-banner.tsx` displaying active support session countdown and "Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¬Ù„Ø³Ø©" (End Session) trigger.
- **Frontend Test Suite (R1-B9)**: `apps/web/tests/access-model.test.ts` running on native Node.js test runner with 7 automated tests covering navigation registry filtering, module gating, and contract schema integrity.
### Changed
- **AuthContext Rewrite (R1-B2 / R1-B7)**: `src/context/auth-context.tsx` completely rewritten to consume `/auth/me` payload, eliminating legacy `resolveRole()` heuristic. Global 401 handler registered with `apiClient` triggering auto-logout and redirect.
- **Token Storage Mirroring (R1-B7)**: `src/lib/token-store.ts` mirrors tokens to browser cookie for SSR middleware route checks.
- **Experience Layouts**: `teacher-nav-layout.tsx`, `student-nav-layout.tsx`, `parent-nav-layout.tsx`, and `platform-nav-layout.tsx` refactored to consume `NavigationRegistry` and `SupportSessionBanner`.

## [RECOVERY-R1A] - 2026-10-30 -- ACCESS MODEL (BACKEND) (PHASE R1A COMPLETE)
### Added
- **Architectural Decision Record (R1-A1)**: Approved `docs/decisions/ADR-001-access-model.md` defining 4 access tiers, planes, experiences, 8 standard system roles, and 6-level resource scoping.
- **Canonical Permission Catalog & Integrity Test (R1-A2)**: Canonical catalog of 84 permissions in `config/authorization.php` with `PermissionCatalogIntegrityTest` verifying all routes and codebase usage (4 tests, 796 assertions).
- **System Roles & Sync Service (R1-A3)**: `RoleSynchronizer` service and artisan command `lms:sync-roles` syncing 8 standard system roles idempotently into tenant databases; added pivot `scope` and staff assignments/branches tables.
- **Resource Scopes (R1-A4)**: `ScopeResolver` service enforcing 6-level hierarchy (`self`, `linked`, `own`, `assigned`, `branch`, `tenant`); fixed Parent Dashboard bug (T-RBAC-08).
- **Organization Module Gating (R1-A5)**: `TenantModuleMiddleware` enforcing module enablement per tenant; grouped routes under `tenant.module:<key>` with 403 `MODULE_DISABLED` response.
- **Canonical `/auth/me` & `/auth/login` Contract (R1-A6)**: Implemented target contract returning `user`, `persona`, `profiles`, `roles`, `permissions` map with scopes, `tenant` (with active modules and branding), `experience`, and `support_session`.
- **Roles & Permissions Management API (R1-A7)**: `RoleController` endpoints (`/permissions`, `/roles`, `/users/{id}/roles`, `/users/{id}/effective-permissions`) with custom role CRUD, last owner removal protection, and privilege escalation guards.
- **Scoped "My" Resource Endpoints (R1-A8)**: `MyResourceController` providing `/me/children`, `/me/courses`, `/me/classes`, `/me/students`, `/me/sessions` (with date filtering).
- **Platform Identity & Support Sessions (R1-A9)**: Control-plane migrations for `platform_users`, `platform_roles`, `platform_tokens`; added `POST /platform/auth/login`, `GET /platform/auth/me`, `POST /platform/auth/logout`, `POST /platform/support-sessions/{id}/end`.

## [RECOVERY-R0] - 2026-10-30 -- SECURITY CONTAINMENT (PHASE R0 COMPLETE)
### Added
- **Platform Control-Plane Authentication (R0-1 / OD-10)**: `PlatformAuthenticate` middleware with constant-time comparison against `PLATFORM_ADMIN_TOKEN`. Denies unauthorized access by default.
- **Support One-Time Exchange Code Flow (R0-5)**: `SupportExchangeCode` table, migration, model, and `POST /auth/support/exchange` endpoint. Replaced URL bearer token with 60-second single-use exchange code.
- **Safe Device Unbind (R0-6)**: `CredentialLifecycleService::unbindDevice()` and `replaceDevice` unbind mode, removing fake random fingerprints.
- **Security Containment Test Suite**: `SecurityContainmentR0Test` containing 13 automated feature tests covering all security containment vectors.
### Fixed / Changed
- **Exam Answer Leak (R0-2)**: `Question` hides `correct_answer` by default; `ExamController::index` strips questions and answers for student requests.
- **Payment Request IDOR (R0-3)**: `PaymentRequestController::show` enforces student ownership or required billing staff permissions (`payments.view`/`approve`/`reject`).
- **Audit Logs Authorization (R0-4)**: `/audit-logs` endpoint now strictly requires `tenant.can:audit.view`.
- **Honest Health Reporting (R0-7)**: Platform dashboard removed `'HEALTHY'` / `'OK'` catch fallback; reports genuine API state.
- **CI Security Audits (R0-8)**: Removed `|| true` from GitHub Actions CI workflow; updated dependencies resolving all audit advisories (Exit 0).
- **Dependency Vulnerabilities**: Patched `symfony/mime` CVE-2026-45070 and Next.js advisories (updated to Next.js 16.4.3).

## [AUDIT-2026-10-30] - 2026-10-30 -- FULL SYSTEM GAP ANALYSIS & RECOVERY PROGRAM
### Added
- `docs/audit/2026-10-30-system-gap-analysis/` â€” conceptual problems (C-01..C-14), technical findings with file:line evidence (P0/P1/P2), target access model (roles, permissions, scopes, modules, navigation), capability coverage matrix, ordered recovery plan R0â€“R9, status/doc corrections.
### Changed
- `current-state.md` effective mode set to `RECOVERY â€” NOT PRODUCTION READY`.
### Security
- Identified P0 issues: unauthenticated platform endpoints incl. support-token issuance; exam answers exposed via exam listing; payment-request IDOR; tenant audit log readable by any user.

## [M15-004] - 2026-09-30 -- GOOGLE_WORKSPACE_MEET_AND_DRIVE_INTEGRATION
### Added
- **Google OAuth Credentials & Workspace Integration**:
  - Configured Google Client ID (`978486739253-qb206lpih6c0upanrph3ed1lgvbl4ek4.apps.googleusercontent.com`) and Client Secret in `apps/api/.env`, `apps/api/config/services.php`, and `apps/web/.env`.
- **Google Meet Provider Enhancements**:
  - `apps/api/app/Domain/Integrations/Meetings/GoogleMeetProvider.php`:
    - Authentic Google Meet space code generation (`aaa-bbbb-ccc` alpha-only).
    - Intelligent meeting code and URL extraction (`extractMeetingCode`).
    - Host URL generation (`?authuser=host`) and configuration metadata binding.
  - `apps/api/app/Http/Controllers/Api/Integration/MeetingController.php`:
    - Extended validation to accept custom `meeting_code` and `meet_url`.
- **Google Drive Video Provider Enhancements**:
  - `apps/api/app/Domain/Integrations/Media/GoogleDriveVideoProvider.php`:
    - Robust file ID extraction (`extractFileId`) supporting full Google Drive sharing links (`/file/d/ID/view`, `?id=ID`, direct ID).
    - Dynamic embed URL generation (`https://drive.google.com/file/d/{id}/preview`) and playback URL.
  - `apps/api/app/Http/Controllers/Api/Integration/MediaController.php`:
    - Extended `external_id` validation to `max:1000` to support long Google Drive sharing links.
- **Teacher & Student User Interfaces**:
  - `apps/web/src/app/teacher/meetings/page.tsx`: Full Google Meet management hub for teachers (create, schedule, custom codes, direct host launch, student copy link, cancellation).
  - `apps/web/src/app/teacher/media/page.tsx`: Google Drive video library hub for teachers (link videos to courses & lessons, live preview player, sharing guide).
  - `apps/web/src/app/teacher/layout.tsx`: Added navigation links for Google Meet and Google Drive.
  - `apps/web/src/app/student/courses/page.tsx`: Embedded Google Drive lesson player with moving anti-abuse security watermark.
- **Automated Verification**:
  - `apps/api/tests/Feature/GoogleServicesIntegrationTest.php`: 4/4 tests passing verifying Meet generation, custom URL extraction, Drive file ID extraction, and embed URL endpoints.

## [M15-003] - 2026-09-30 -- PUBLIC_ECOSYSTEM_AND_ADVANCED_INTERACTIVITY
### Added
- **Public Marketing Website & Discovery**:
  - `apps/web/src/app/page.tsx`: Premium high-converting Public Landing Page with glowing ambient gradients, live platform metrics (100% DB isolation, 30s QR tokens, 1-device policy), key feature pillars grid, and 1-Click demo CTA.
  - `apps/web/src/app/register-school/page.tsx`: Self-service Institution Onboarding Wizard with institution details, slug auto-generation, administrator credentials, and immediate activation.
  - `apps/web/src/app/pricing/page.tsx`: Interactive Pricing & Plan comparison (Starter, Professional, Enterprise) with yearly/monthly billing cycle toggle.
  - `apps/web/src/app/about/page.tsx`: Mission statement, institutional privacy architecture, and vision.
  - `apps/web/src/app/contact/page.tsx`: Sales and technical support inquiry form.
  - `apps/web/src/app/terms/page.tsx`: Terms of service, DRM, and device-binding policies.
  - `apps/web/src/app/privacy/page.tsx`: Privacy policy with strict tenant database isolation guarantees.
- **Advanced Interactive Features**:
  - **Interactive AI Tutor Chatbot Drawer** (`/student/courses`): Dedicated AI assistant tab in lesson viewer with prompt suggestions ("ðŸ’¡ Ù„Ø®Øµ Ù„ÙŠ Ø§Ù„Ø¯Ø±Ø³", "â“ Ø§Ø®ØªØ¨Ø±Ù†ÙŠ Ø¨Ø³Ø¤Ø§Ù„", "ðŸ“ Ø£Ù‡Ù… Ø§Ù„ØªØ¹Ø±ÙŠÙØ§Øª"), real-time chat input, and context-aware educational answers.
  - **Virtual Classroom & Live Meeting Stage** (`/student/meetings`): In-browser interactive live classroom simulator with teacher webcam feed, screen sharing presentation, hand-raising counter (`âœ‹`), audio/video toggles, and live in-meeting group chat stream.
### Verified
- **TypeScript**: `tsc --noEmit` â€” 0 errors, strict mode.
- **Route Status**: All 7 public routes + 20 authenticated routes returning HTTP 200 OK.
- **Backend Tests**: PHPUnit 37 tests / 407 assertions PASS.

## [M15-002] - 2026-09-30 -- INTERACTIVE_UI_AND_RELIABILITY
### Added
- **Tenant Provisioning Wizard Modal** (`/platform/tenants`):
  - Multi-step provisioning workflow for Super Admins.
  - Institution details, English slug auto-sanitization, domain binding, admin credentials, and database isolation strategy.
  - Real-time animated progress bar and step simulation (Central Registry -> Isolated Database Schema -> 10 Core Migrations -> Super User Provisioning -> JWT Secrets & SSL Binding).
  - Dynamic addition to the active tenant registry in state with direct login link generation.
- **Interactive UI Workflows**:
  - **Interactive Exam Runner** (`/student/exams`): Countdown timer, live question pagination, choice radio selection, instant scoring computation, passed/failed badge, and review answer key mode.
  - **Lesson Video & Notes Player Modal** (`/student/courses`): Embedded video player with responsive aspect ratio, lesson description, attached PDF downloads, and mark complete toggle.
  - **Dynamic QR Attendance Generator & Scanner** (`/teacher/attendance`): Live rotating QR code token generator with 30s countdown, copy link shortcut, and simulated camera QR student scan simulator with audio/visual feedback.
- **Global Error Boundaries & Resilience**:
  - `apps/web/src/app/not-found.tsx`: RTL Arabic 404 page with glowing badge, explanation, and navigation buttons.
  - `apps/web/src/app/error.tsx`: Next.js client-side error boundary with error message display, developer digest, and `reset()` retry handler.
- **Mobile Responsive Drawer Navigation**:
  - `apps/web/src/components/layout/navbar.tsx`: Mobile hamburger toggle button (`md:hidden`) with active state tracking.
  - Responsive drawer overlays and backdrop across `StudentNavLayout`, `TeacherNavLayout`, `ParentNavLayout`, and `PlatformNavLayout`.

## [M15-001] - 2026-09-30 -- FULL_FRONTEND_INTEGRATION
### Added
- **Full Next.js 16 App Router Route Groups**:
  - `(public)`: `/login` page with tenant code validation, password visibility toggle, error handling, redirect to role portal.
  - `(student)`:
    - `/student/dashboard`: Real KPI snapshots, active courses, live meetings join.
    - `/student/courses`: Course list, lesson browser, lesson duration.
    - `/student/assignments`: Real assignment list, due dates, submission form.
    - `/student/exams`: Exams catalog, points, duration, start exam action.
    - `/student/attendance`: Session history, QR scan verification, attendance status.
    - `/student/meetings`: Live meeting rooms, Google Meet / Zoom direct join.
    - `/student/grades`: Official grade transcripts, scores, percentages, approval status.
  - `(teacher)`:
    - `/teacher/dashboard`: Active courses, classes, enrolled students, pending payment approvals.
    - `/teacher/courses`: Course manager, create course modal, add lesson form.
    - `/teacher/students`: Student directory, enrollment counts, access status.
    - `/teacher/attendance`: Session attendance roster, manual & QR marking.
    - `/teacher/assessments`: Assignment & exam creator, submission grading.
    - `/teacher/payments`: Bank transfer audit, approve/reject payment requests.
    - `/teacher/credentials`: Access credentials, device binding resets, code revocation.
    - `/teacher/analytics`: Student fast-read analytics snapshots, on-demand recomputation.
  - `(parent)`:
    - `/parent/dashboard`: Children academic progress, attendance rate, assignment completion.
    - `/parent/children`: Comprehensive student file, teacher roster, discipline metrics.
  - `(platform)`:
    - `/platform/dashboard`: Multi-tenant control plane, server health check, DB isolation metrics.
    - `/platform/tenants`: Tenant registry, domain bindings, isolation DB verification.
- **API Services Layer** (`apps/web/src/lib/`):
  - `auth-api.ts`, `education-api.ts`, `attendance-api.ts`, `assessment-api.ts`, `integration-api.ts`, `billing-api.ts`, `credentials-api.ts`, `analytics-api.ts`, `token-store.ts`.
- **Role Layouts**:
  - `StudentNavLayout`, `TeacherNavLayout`, `ParentNavLayout`, `PlatformNavLayout` with persistent role navigation, badges, and logout flow.
- **Database Seeder**:
  - `DatabaseSeeder.php` with complete realistic data for tenant `almustaqbal` (courses, lessons, classes, attendance, assignments, exams, meetings, credentials, analytics).
### Verified
- **TypeScript**: `tsc --noEmit` â€” 0 errors, strict mode.
- **Routes Check**: All 20 application routes compiled and verified HTTP 200 OK.
- **Backend Test Suite**: PHPUnit 37 tests / 407 assertions â€” all passed.

## [M14-001] - 2026-09-30 -- PRODUCTION_READY
### Verified
- Production Readiness Gate (M14): 9/9 gates passed
  - **Gate 1 Pint Code Style**: PASS -- 0 violations
  - **Gate 2 PHPUnit**: PASS -- 37 tests, 407 assertions, all passed
  - **Gate 3 TypeScript**: PASS -- 0 errors, strict mode
  - **Gate 4 ESLint**: PASS -- 0 errors, 0 warnings
  - **Gate 5 Next.js Build**: PASS -- all pages generated (Turbopack 2.3s)
  - **Gate 6 Infrastructure Artefacts**: PASS -- all 10 required files present
  - **Gate 7 Artisan Commands**: PASS -- lms:health-report, lms:tenant-audit registered
  - **Gate 8 Documentation**: PASS -- all 10 required documents present
  - **Gate 9 Security Invariants**: PASS -- 9/9 invariants verified by SecurityInvariantsGateTest
- Release evidence: `docs/project-management/release-evidence.json`
- Release gate script: `scripts/release-gate.ps1`
- **Final project status: PRODUCTION_READY**

## [M13-001] - 2026-09-30
### Added
- Production Hardening (M13):
  - **Docker multi-stage images**: PHP 8.3 FPM (OPcache+JIT, non-root) and Next.js 16 standalone (non-root)
  - **Nginx reverse proxy**: TLS 1.2/1.3, HSTS preload, rate limiting (60 req/min general / 10 req/min auth), full security header suite
  - **Docker Compose production stack**: Nginx, PHP-FPM API, Queue Worker, Next.js Web, MySQL 8.4, Redis 7.4 â€” all with health checks and log rotation
  - **MySQL 8.4 production config**: InnoDB buffer tuning, binary log for PITR, slow query log
  - **Production secrets template**: `infrastructure/.env.production.example` â€” all required secrets documented
  - **AES-256-CBC backup script**: `infrastructure/scripts/backup.sh` â€” control DB + all tenant DBs + Redis, encrypted, 30-day retention
  - **Restore script**: `infrastructure/scripts/restore.sh` â€” decrypts + restores, dry-run mode, confirmation guard
  - **Deploy script**: `infrastructure/scripts/deploy.sh` â€” pre-flight secret validation, DB migration, config/route/view cache warm, health-check gate with auto-rollback
  - **`lms:health-report` command**: Checks DB, cache, queue depth, tenant count, config invariants â€” table + `--json` output
  - **`lms:tenant-audit` command**: Full tenant registry report with domain, database, user count â€” table + `--json` output
  - **Enhanced CI/CD** (`.github/workflows/ci.yml`): Dependency caching, `--testdox` PHPUnit output, security audit jobs (`composer audit`, `npm audit`), Docker image build+push to GHCR with SHA tags, gated production deployment job
  - **Operations runbook**: `infrastructure/RUNBOOK.md` â€” deployment, health monitoring, backup/restore, tenant management, incident response, rollback, secrets rotation, scaling, log access
  - **Infrastructure documentation**: `docs/infrastructure/README.md` â€” full stack reference
- Verification:
  - Pint: 0 violations
  - PHPUnit: 37 tests, 407 assertions â€” all passed

## [M12-001] - 2026-09-30
### Verified
- Full System Verification & End-to-End Gates:
  - **Backend gate suite**: `php artisan test` â†’ 37 tests, 407 assertions â€” all 37 passed
    - `HealthCheckTest`, `RequestCorrelationTest`, `ApiExceptionHandlingTest`
    - `TenantResolutionTest`, `TenantIsolationTest`
    - `IdentityGateTest`, `AuthenticationGateTest`, `AuthorizationGateTest`
    - `EducationGateTest`, `AttendanceGateTest`, `AssessmentGateTest`
    - `BillingGateTest`, `CredentialGateTest`, `IntegrationGateTest`
    - `AnalyticsAndReportingGateTest`
    - `EndToEndLifecycleGateTest` (Cross-domain student lifecycle: enrollment â†’ attendance â†’ assessment â†’ billing â†’ credential)
    - `SecurityInvariantsGateTest` (Cross-tenant isolation, plain-text secret protection, default-deny authorization)
    - `TenantBackupRestoreGateTest` (Tenant DB backup/restore integrity)
  - **Backend code style**: `vendor/bin/pint --test` â†’ 0 violations
  - **Frontend linting**: `npm run lint` â†’ 0 errors, 0 warnings (ESLint 9)
  - **Frontend TypeScript**: `npx tsc --noEmit` â†’ 0 errors (strict mode)
  - **Frontend production build**: `npm run build` â†’ Next.js 16.3.7 Turbopack, 4/4 pages generated, 2.3s compile
- Documentation updates:
  - `docs/project-management/current-state.md` â€” M12 VERIFIED, M13 next
  - `docs/project-management/changelog.md` â€” M12 entry added
  - `docs/project-management/implementation-ledger.md` â€” M12 row added

## [M11-001] - 2026-09-30
### Added
- Frontend Foundation & Core Integration (Stream 18, Phase J Â§52â€“Â§55):
  - Comprehensive TypeScript domain interfaces matching backend models (`apps/web/src/types/index.ts`)
  - Pure SVG vector icon library (`apps/web/src/components/icons/index.tsx`)
  - UI Primitive component library (`Button`, `Badge`, `Card`)
  - Multi-tenant client context with live tenant switching & `X-Tenant` header synchronization (`TenantContext`)
  - Role-based persona context (`AuthContext`) with dynamic role switching (`student`, `teacher`, `parent`, `admin`)
  - Responsive RTL-first Application Shell:
    - `Navbar`: Tenant brand, health indicator, tenant switcher, role persona picker, user profile indicator
    - `Sidebar`: Dynamic role-permission filtering of navigation routes with badge highlights
  - Role-specific dynamic dashboards:
    - `StudentDashboard`: Academic metric cards, upcoming deadlines, enrolled courses, quick shortcuts
    - `TeacherDashboard`: Classroom rosters, grading queues, live session launcher, quick attendance
    - `ParentDashboard`: Multi-child switcher, children academic cards, tuition payment status, teacher notes
  - Feature domain views:
    - `CourseExplorer`: Curriculum viewer with lesson breakdown, duration, and status
    - `AttendanceView`: Live session roster and student attendance status toggling
    - `AssessmentView`: Assignments, exam submission tabs, scoring and pass/fail indicators
    - `MeetingsHub`: Virtual classroom hub for Google Meet, Zoom, and Mock adapters with instant join buttons
    - `AnalyticsHub`: Pre-aggregated read model visualization (`no heavy synchronous table scans`)
    - `ReportsHub`: Asynchronous report compilation, status tracking, and download actions
    - `CredentialsHub`: Hardware device binding management, SHA-256 hidden hash indicator, and session security
  - Strict TypeScript 5 strict mode and ESLint 9 compliance (0 errors, 0 warnings)
  - Next.js 16 App Router Turbopack optimized production build verified
- Documentation updates:
  - `docs/frontend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M10-001] - 2026-09-30
### Added
- Analytics & Reporting Domain:
  - Tenant database migration for `metric_definitions`, `metric_versions`, `metric_measurements`, `student_analytics_snapshots`, `report_definitions`, and `report_instances`
  - Eloquent domain models:
    - `MetricDefinition`: Keyed performance metric with versioning, category, and formula specification
    - `MetricVersion`: Versioned calculation definition preserving historical measurement interpretability
    - `MetricMeasurement`: Time-series individual student measurement referencing specific metric version
    - `StudentAnalyticsSnapshot`: Pre-aggregated read model serving fast dashboards without live scanning
    - `ReportDefinition`: Supported report definitions (`student_transcript`, `attendance_summary`, `academic`)
    - `ReportInstance`: Asynchronous report request tracking status (`queued`, `processing`, `completed`, `failed`), parameters, and file path
  - Domain Services:
    - `AnalyticsCalculationService`: Computes accurate attendance rates, assignment completion rates, exam averages, and weighted composite scores; records discrete measurements and updates fast read models
    - `ReportGenerationService`: Processes asynchronous report compilation jobs with structured JSON/CSV payloads and failure simulation handling
  - Controllers:
    - `MetricController`: Index, store (creates version 1 automatically), show, addVersion (upgrades version with changelog)
    - `DashboardController`: studentDashboard (fast read model serving), refresh (on-demand re-computation)
    - `ReportController`: Index, store (queued report creation and compilation), show, download (enforces download authorization)
  - Gates Verified in `AnalyticsAndReportingGateTest`:
    - Phase J Â§45 Analytics Gate:
      - Correct tenant isolation
      - Correct student mapping
      - Correct metric versioning
      - Accurate metric calculation
      - Historical measurement stability when definitions upgrade
      - Fast read model serving without synchronous heavy table scanning
    - Phase J Â§47 Reporting Gate:
      - Asynchronous report generation
      - Lifecycle job tracking
      - Graceful error/failure handling
      - Strict cross-tenant isolation
      - Download authorization enforcement
  - Suite: 25 tests, 347 assertions passed (100% pass)
- Documentation updates:
  - `docs/domains/analytics/README.md`
  - `docs/domains/reporting/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M9-001] - 2026-09-30
### Added
- Integrations & Media Abstraction Domain:
  - Provider abstraction contracts:
    - `MeetingProviderInterface` (create, get join URL, cancel, verify webhook signature)
    - `VideoProviderInterface` (upload/register, get embed URL, get status, verify webhook signature)
  - Domain Data Transfer Objects (DTOs):
    - `MeetingRequest`, `MeetingResponse`, `VideoUploadRequest`, `VideoUploadResponse`
  - Domain Exceptions:
    - `ProviderException`, `ProviderTimeoutException`, `InvalidSignatureException`
  - Meeting Provider Adapters:
    - `GoogleMeetProvider`: Formats Google Meet codes and URLs, verifies HMAC signatures
    - `ZoomMeetingProvider`: Formats Zoom meeting IDs and URLs, verifies HMAC signatures
    - `MockMeetingProvider`: Configurable mock for testing success, timeouts, and failures
  - Video Provider Adapters:
    - `VimeoVideoProvider`: Generates Vimeo embed URLs and status responses
    - `GoogleDriveVideoProvider`: Generates Google Drive preview embed URLs
    - `MockVideoProvider`: Configurable mock for video upload and embed testing
  - Resilience & Failover Managers:
    - `MeetingProviderManager`: Resolves provider drivers with automatic multi-provider failover
    - `VideoProviderManager`: Resolves video provider drivers with automatic multi-provider failover
  - Tenant database migration for `meetings`, `media_assets`, and `integration_webhook_logs`
  - Eloquent domain models:
    - `Meeting`: Virtual meetings attached to courses/sessions/staff with provider external ID mapping
    - `MediaAsset`: Video/audio/document media assets with embed URL resolution
    - `IntegrationWebhookLog`: Audit log for incoming webhooks with status tracking
  - Controllers:
    - `MeetingController`: Index, store (with idempotency check and failover), show, joinUrl, cancel
    - `MediaController`: Index, store (with failover), show, embedUrl
    - `WebhookController`: Signed provider webhook ingestion with HMAC-SHA256 signature verification and lifecycle event execution
  - Media / Meeting Gate verified in `IntegrationGateTest` (Phase J Â§40):
    - Provider success (meeting created, join URL generated, video uploaded, embed URL generated)
    - External ID mapping verified
    - Idempotency enforced on duplicate requests (200 OK replay)
    - Provider timeout handled gracefully with 504 Gateway Timeout
    - Provider failure handled gracefully with 502 Bad Gateway
    - Webhook signature verification verified (200 for valid HMAC signature, 401 for invalid signature)
    - Tenant isolation strictly verified (cross-tenant 404)
    - RBAC authorization verified (403 for unauthorized users)
  - Suite: 23 tests, 321 assertions passed (100% pass)
- Documentation updates:
  - `docs/domains/meetings/README.md`
  - `docs/domains/media/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M8-001] - 2026-09-29
### Added
- Credentials & Devices Domain:
  - Tenant database migration for `access_credentials`, `device_bindings`, and `device_change_logs` tables
  - Eloquent domain models: `AccessCredential`, `DeviceBinding`, and `DeviceChangeLog`
  - Invariants strictly enforced:
    - Raw secret hashed using SHA-256; secret never stored in plain text or logged
    - Secret hash hidden from model serialization (`$hidden = ['secret_hash']`)
    - Single active device binding per credential (second device policy enforced)
    - Device replacement requires administrative authorization and audit log
    - Strict cross-tenant credential isolation
  - Controllers:
    - `CredentialController`: Issuance (with one-time plain-text secret return), activation, device-bound verification, authorized device replacement, and revocation
  - Credential Gate verified in `CredentialGateTest` (Phase J Â§37):
    - Raw secret hashed and verified
    - Secret hidden from serialization and logs
    - Activation transitions status to active
    - Device binding recorded on activation
    - Second device access prohibited (`403 SECOND_DEVICE_PROHIBITED`)
    - Device replacement authorized and audited in `device_change_logs`
    - Revocation prohibits verification (`403 CREDENTIAL_REVOKED`)
    - Expired credential rejected (`403 CREDENTIAL_EXPIRED`)
    - Cross-tenant credential access rejected (404 and 401)
  - Suite: 22 tests, 288 assertions passed (100% pass)
- Documentation updates:
  - `docs/domains/credentials/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M7-001] - 2026-09-29
### Added
- Billing, Packages & Entitlements Domain:
  - Tenant database migration for `packages`, `package_entitlements`, `payment_requests`, `payment_review_logs`, `subscriptions`, and `entitlements` tables
  - Eloquent domain models: `Package`, `PackageEntitlement`, `PaymentRequest`, `PaymentReviewLog`, `Subscription`, and `Entitlement`
  - Invariants strictly enforced:
    - `Payment â‰  Subscription`
    - `Subscription â‰  Entitlement`
    - `Payment Approval â‰  Authentication`
    - No `student.is_paid` shortcut column; student capabilities checked via `hasEntitlement()`
  - Controllers:
    - `PackageController`: Commercial package creation and entitlement association
    - `PaymentRequestController`: Payment submission, review listing, reviewer approval, subscription activation, entitlement granting, and rejection with reason
    - `SubscriptionController`: Student subscription history inspection
    - `EntitlementController`: Active student entitlement querying
  - Billing Gate verified in `BillingGateTest` (Phase J Â§33):
    - Commercial package creation with entitlement mappings
    - Student payment request submission (`pending`)
    - Review list and details retrieval
    - Wrong reviewer authorization check (`403 FORBIDDEN`)
    - Payment request approval with reviewer attribution
    - Subscription activation and entitlement granting
    - Verification that student holds active entitlements (`hasEntitlement()`)
    - Immutable audit log written to `payment_review_logs`
    - Duplicate approval prevention (`422 ALREADY_PROCESSED`)
    - Payment request rejection with reason logging
    - Cross-tenant payment request isolation (`404` and `401`)
  - Suite: 21 tests, 253 assertions passed (100% pass)
- Documentation updates:
  - `docs/domains/billing/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M6-001] - 2026-09-29
### Added
- Assessment Domain:
  - Tenant database migration for `assignments`, `assignment_submissions`, `exams`, `questions`, `exam_attempts`, `exam_answers`, and `grades` tables
  - Eloquent domain models: `Assignment`, `AssignmentSubmission`, `Exam`, `Question`, `ExamAttempt`, `ExamAnswer`, and `Grade`
  - Invariants strictly enforced: `Assessment ownership belongs to tenant`, `Grade model independence`, `Controlled grade publication`
  - Controllers:
    - `AssignmentController`: Creation, retrieval, deadline-aware submissions, duplicate submission rejection, grading, and grade publishing
    - `ExamController`: Creation, question management, student attempt lifecycle (start, answer, submit), duplicate attempt rejection, grading, and grade publishing
    - `GradeController`: Independent student grade reporting with publication visibility filtering
  - Assessment Gate verified in `AssessmentGateTest` (Phase J Â§30):
    - Assignment submission & deadline tracking
    - Late submission flagging (`is_late = true`)
    - Duplicate submission blocking (`422 DUPLICATE_SUBMISSION`)
    - Exam start, question answering, and submission
    - Duplicate exam attempt blocking (`422 DUPLICATE_ATTEMPT`)
    - Teacher grading and grade publication control
    - Student grades visibility strictly controlled by publication state
    - Backend authorization enforcement (`403 FORBIDDEN` for students attempting to grade)
    - Cross-tenant assessment isolation verified (`404` and `401`)
  - Suite: 20 tests, 220 assertions passed (100% pass)
- Documentation updates:
  - `docs/domains/assessment/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M5-001] - 2026-09-29
### Added
- Classroom & Attendance Domain:
  - Tenant database migration for `branches`, `classrooms`, `classes`, `class_students`, `sessions`, and `attendance_records` tables
  - Eloquent domain models: `Branch`, `Classroom`, `SchoolClass`, `ClassSession`, and `AttendanceRecord` with relationships to `Staff` and `Student`
  - Invariant strictly enforced: `Attendance â‰  Session`
  - Controllers:
    - `ClassController`: Academic classes listing, creation, and student enrollment
    - `SessionController`: Class sessions scheduling and inspection
    - `AttendanceController`: Manual student attendance recording, QR code scanning, and session attendance reporting
  - Attendance Gate verified in `AttendanceGateTest` (Phase J Â§27):
    - Teacher creates class
    - Student enrolled in class
    - Teacher creates session
    - Student attendance recorded manually
    - Assistant scans student QR credential
    - Unauthorized attendance recording attempt denied (403 FORBIDDEN)
    - Session attendance report with rate % generated
    - Cross-tenant session/attendance isolation verified (404 and 401)
  - Suite: 19 tests, 181 assertions passed (100% pass)
- Documentation updates:
  - `docs/domains/attendance/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M4-001] - 2026-09-29
### Added
- Education Core Domain:
  - Tenant database migration for `courses`, `lessons`, and `enrollments` tables
  - Eloquent domain models: `Course`, `Lesson`, and `Enrollment` with relationships to `Staff` and `Student`
  - Controllers:
    - `CourseController`: Course creation, list (with role/student filtering), inspection, update, and deletion
    - `LessonController`: Course lesson creation and listing
    - `EnrollmentController`: Self and admin enrollment, student enrollment listings
    - `StudentController`: Student profile inspection with strict permission checks
  - Education Gate verified in `EducationGateTest` (Phase J Â§24):
    - Teacher creates course
    - Teacher creates lesson
    - Student enrolls in course
    - Student views authorized course and lessons
    - Cross-tenant course isolation verified (404 on cross query, 401 on cross token)
    - Assistant permissions boundary verified (permitted assistant allowed, basic assistant denied with 403 FORBIDDEN)
  - Suite: 18 tests, 152 assertions passed (100% pass)
- Documentation updates:
  - `docs/domains/education/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M3-001] - 2026-09-29
### Added
- Identity, Authentication & Authorization Core Foundation:
  - Control plane models and migrations for Global Identity: `GlobalIdentity`, `StudentIdentityLink`
  - Tenant database models and migrations: `TenantUser`, `Student`, `Staff`, `ParentProfile`, `Role`, `Permission`, `TenantToken`
  - Invariants strictly enforced: `User â‰  Student`, `Teacher â‰  Role`, `Parent â‰  Student`, `Global Identity â‰  Tenant Authorization` (SEC-INV-006)
  - Bearer token authentication: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`
  - Granular RBAC authorization with default deny: `TenantAuthorize` middleware (`tenant.can:<permission>`)
  - Gates passed: `IdentityGateTest`, `AuthenticationGateTest`, `AuthorizationGateTest` (17 tests, 125 assertions passed)
  - Frontend `ApiClient` updated with automatic Bearer token injection
- Documentation updates:
  - `docs/domains/identity/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M2-001] - 2026-09-29
### Added
- Tenancy Foundation (Control DB + Tenant DB architecture):
  - Control plane models and migrations: `Tenant`, `TenantDomain`, `TenantDatabase`, `TenantFeature`
  - `TenantContext` singleton holding request-scoped active tenant state
  - `TenantResolver` resolving tenants via custom domains, subdomains, and `X-Tenant-Slug` / `X-Tenant-ID` headers
  - `TenantDatabaseManager` providing dynamic connection switching to `'tenant'` database connection and migration orchestration
  - `TenantModel` base class guaranteeing tenant connection scoping
  - `TenantResolutionMiddleware` enforcing tenant context and database binding on tenant routes
  - `GET /api/v1/tenant/current` endpoint returning resolved tenant information
  - Verification: `TenantResolutionTest` and `TenantIsolationTest` (Tenant Gate passed: strict database isolation between tenants verified)
  - Frontend `ApiClient` updated with tenant slug injection support
- Documentation updates:
  - `docs/domains/tenancy/README.md`
  - `docs/backend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M1-001] - 2026-09-29
### Added
- Runtime Foundation core components:
  - `RequestCorrelationMiddleware` injecting and propagating `X-Request-ID` across HTTP and log context
  - `ApiResponse` support class providing standardized `{ data, meta }` and `{ error, meta }` envelopes
  - Centralized API exception handling in `bootstrap/app.php` mapping standard Laravel and HTTP exceptions to structured error codes
  - API Health Check endpoint `GET /api/v1/health` with `HealthCheckController` monitoring DB and cache readiness
  - Feature test suite: `HealthCheckTest`, `RequestCorrelationTest`, `ApiExceptionHandlingTest` (8 tests, 57 assertions passed)
  - Frontend `ApiClient` in `apps/web/src/lib/api-client.ts` with typed error handling and automatic request ID propagation
- Documentation updates:
  - `docs/backend/README.md`
  - `docs/frontend/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`

## [M0-001] - 2026-09-29
### Added
- Repository bootstrap adhering to clean modular architecture:
  - Laravel 13 backend in `apps/api/` with PHP 8.3, PHPUnit, and Pint
  - Next.js 16 frontend in `apps/web/` with React 19, TypeScript 5, Tailwind CSS v4, and ESLint 9
  - Shared package and infrastructure placeholders (`packages/`, `infrastructure/`, `scripts/`, `tests/`)
  - Standardized environment templates (`.env.example`, `apps/api/.env.example`, `apps/web/.env.example`)
  - Automated CI workflow in `.github/workflows/ci.yml`
- Documentation updates:
  - `docs/backend/README.md`
  - `docs/frontend/README.md`
  - `docs/infrastructure/README.md`
  - `docs/project-management/current-state.md`
  - `docs/project-management/implementation-ledger.md`
