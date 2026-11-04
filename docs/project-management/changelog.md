# Changelog

All notable changes to this project will be documented in this file.

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
- Product identity **سحابة / Sahaba** (OD-22): `config/brand.ts`, brand mark, app icon, manifest.
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
  - Removed hardcoded student UUID (`01a0ef9d-5232-7086-9129-5989e81a7dd9`) and hardcoded demo name ("عمر أحمد فاروق").
  - Implemented dynamic student selector dropdown loading real tenant students via `educationApi.getStudents()`.
  - Added live search query filtering, instant metrics loading via `analyticsApi.getStudentDashboard()`, and metric cache refresh trigger via `analyticsApi.refreshStudentDashboard()`.
- **Student Profile & Detailed Directory (`/teacher/students`, `/teacher/students/[id]`)**:
  - Student directory upgraded to semantic tokens with grade level filtering and direct action to view student details.
  - Comprehensive student detail page built with `DetailLayout` and 4 rich tabs (`overview`, `courses`, `credentials`, `parents`).
  - Added student device binding inspection (`device_fingerprint`, `device_name`, `last_used_at`) per Master §64 hardware security specifications.
  - Extended `Student` TypeScript definition in `apps/web/src/types/index.ts` with `StudentEnrollment`, `StudentParent`, and `created_at`.
- **Teaching Assistant Desk & Permission Model (OD-2 / Master §71-72)**:
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
  - Responsive mobile bottom navigation bar (top 4 primary links + "المزيد" drawer trigger).
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
  - Master §34 attempt state progression strictly enforced.
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
  - Domain Service `ProgressAggregator`: Processes batched playback events, computes watch percentages, auto-marks lessons completed at ≥ 90%, and detects skipping speed anomalies.
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
- **Payment Proof File Upload & Private Streaming (R3-3)**: Multipart proof uploads (JPEG, PNG, PDF ≤5MB) stored in private tenant-isolated storage; private streaming endpoint `GET /api/v1/payment-requests/{id}/proof` gated by strict authorization boundary.
- **Packages & Manual Entitlements API (R3-4)**: Full package update & archive endpoints in `PackageController`; manual entitlement grant & revoke with mandatory audit logging in `EntitlementController`; student self-service endpoints `GET /me/subscriptions` and `GET /me/entitlements`.
- **Approval Side Effects & Auto-Enrollment (R3-7)**: `PaymentReviewService::approve` transactional execution activating subscriptions, granting entitlements, and auto-enrolling students into matching course entitlements (`course:{id}`).
- **Student Billing Screen Suite (R3-5)**:
  - `/student/plans`: Active package catalog with pricing, billing cycles, entitlement benefits, and trust guarantee banner.
  - `/student/plans/[id]/pay`: Payment submission with method instructions (InstaPay, Bank Transfer, Cash), reference code, and drag & drop proof uploader.
  - `/student/payments`: Payment requests tracking table, status badges (`pending`, `approved`, `rejected` with rejection reason), and drawer inspection.
  - `/student/subscriptions`: Active subscriptions and effective entitlements dashboard.
  - Course Player Lock Integration: Course cards and lesson lists display lock states with "اشترك للوصول" linking to plans.
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
- **Support Session Persistent Banner (R1-B9)**: `src/components/layout/support-session-banner.tsx` displaying active support session countdown and "إنهاء الجلسة" (End Session) trigger.
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
- `docs/audit/2026-10-30-system-gap-analysis/` — conceptual problems (C-01..C-14), technical findings with file:line evidence (P0/P1/P2), target access model (roles, permissions, scopes, modules, navigation), capability coverage matrix, ordered recovery plan R0–R9, status/doc corrections.
### Changed
- `current-state.md` effective mode set to `RECOVERY — NOT PRODUCTION READY`.
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
  - **Interactive AI Tutor Chatbot Drawer** (`/student/courses`): Dedicated AI assistant tab in lesson viewer with prompt suggestions ("💡 لخص لي الدرس", "❓ اختبرني بسؤال", "📝 أهم التعريفات"), real-time chat input, and context-aware educational answers.
  - **Virtual Classroom & Live Meeting Stage** (`/student/meetings`): In-browser interactive live classroom simulator with teacher webcam feed, screen sharing presentation, hand-raising counter (`✋`), audio/video toggles, and live in-meeting group chat stream.
### Verified
- **TypeScript**: `tsc --noEmit` — 0 errors, strict mode.
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
- **TypeScript**: `tsc --noEmit` — 0 errors, strict mode.
- **Routes Check**: All 20 application routes compiled and verified HTTP 200 OK.
- **Backend Test Suite**: PHPUnit 37 tests / 407 assertions — all passed.

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
  - **Docker Compose production stack**: Nginx, PHP-FPM API, Queue Worker, Next.js Web, MySQL 8.4, Redis 7.4 — all with health checks and log rotation
  - **MySQL 8.4 production config**: InnoDB buffer tuning, binary log for PITR, slow query log
  - **Production secrets template**: `infrastructure/.env.production.example` — all required secrets documented
  - **AES-256-CBC backup script**: `infrastructure/scripts/backup.sh` — control DB + all tenant DBs + Redis, encrypted, 30-day retention
  - **Restore script**: `infrastructure/scripts/restore.sh` — decrypts + restores, dry-run mode, confirmation guard
  - **Deploy script**: `infrastructure/scripts/deploy.sh` — pre-flight secret validation, DB migration, config/route/view cache warm, health-check gate with auto-rollback
  - **`lms:health-report` command**: Checks DB, cache, queue depth, tenant count, config invariants — table + `--json` output
  - **`lms:tenant-audit` command**: Full tenant registry report with domain, database, user count — table + `--json` output
  - **Enhanced CI/CD** (`.github/workflows/ci.yml`): Dependency caching, `--testdox` PHPUnit output, security audit jobs (`composer audit`, `npm audit`), Docker image build+push to GHCR with SHA tags, gated production deployment job
  - **Operations runbook**: `infrastructure/RUNBOOK.md` — deployment, health monitoring, backup/restore, tenant management, incident response, rollback, secrets rotation, scaling, log access
  - **Infrastructure documentation**: `docs/infrastructure/README.md` — full stack reference
- Verification:
  - Pint: 0 violations
  - PHPUnit: 37 tests, 407 assertions — all passed

## [M12-001] - 2026-09-30
### Verified
- Full System Verification & End-to-End Gates:
  - **Backend gate suite**: `php artisan test` → 37 tests, 407 assertions — all 37 passed
    - `HealthCheckTest`, `RequestCorrelationTest`, `ApiExceptionHandlingTest`
    - `TenantResolutionTest`, `TenantIsolationTest`
    - `IdentityGateTest`, `AuthenticationGateTest`, `AuthorizationGateTest`
    - `EducationGateTest`, `AttendanceGateTest`, `AssessmentGateTest`
    - `BillingGateTest`, `CredentialGateTest`, `IntegrationGateTest`
    - `AnalyticsAndReportingGateTest`
    - `EndToEndLifecycleGateTest` (Cross-domain student lifecycle: enrollment → attendance → assessment → billing → credential)
    - `SecurityInvariantsGateTest` (Cross-tenant isolation, plain-text secret protection, default-deny authorization)
    - `TenantBackupRestoreGateTest` (Tenant DB backup/restore integrity)
  - **Backend code style**: `vendor/bin/pint --test` → 0 violations
  - **Frontend linting**: `npm run lint` → 0 errors, 0 warnings (ESLint 9)
  - **Frontend TypeScript**: `npx tsc --noEmit` → 0 errors (strict mode)
  - **Frontend production build**: `npm run build` → Next.js 16.3.7 Turbopack, 4/4 pages generated, 2.3s compile
- Documentation updates:
  - `docs/project-management/current-state.md` — M12 VERIFIED, M13 next
  - `docs/project-management/changelog.md` — M12 entry added
  - `docs/project-management/implementation-ledger.md` — M12 row added

## [M11-001] - 2026-09-30
### Added
- Frontend Foundation & Core Integration (Stream 18, Phase J §52–§55):
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
    - Phase J §45 Analytics Gate:
      - Correct tenant isolation
      - Correct student mapping
      - Correct metric versioning
      - Accurate metric calculation
      - Historical measurement stability when definitions upgrade
      - Fast read model serving without synchronous heavy table scanning
    - Phase J §47 Reporting Gate:
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
  - Media / Meeting Gate verified in `IntegrationGateTest` (Phase J §40):
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
  - Credential Gate verified in `CredentialGateTest` (Phase J §37):
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
    - `Payment ≠ Subscription`
    - `Subscription ≠ Entitlement`
    - `Payment Approval ≠ Authentication`
    - No `student.is_paid` shortcut column; student capabilities checked via `hasEntitlement()`
  - Controllers:
    - `PackageController`: Commercial package creation and entitlement association
    - `PaymentRequestController`: Payment submission, review listing, reviewer approval, subscription activation, entitlement granting, and rejection with reason
    - `SubscriptionController`: Student subscription history inspection
    - `EntitlementController`: Active student entitlement querying
  - Billing Gate verified in `BillingGateTest` (Phase J §33):
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
  - Assessment Gate verified in `AssessmentGateTest` (Phase J §30):
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
  - Invariant strictly enforced: `Attendance ≠ Session`
  - Controllers:
    - `ClassController`: Academic classes listing, creation, and student enrollment
    - `SessionController`: Class sessions scheduling and inspection
    - `AttendanceController`: Manual student attendance recording, QR code scanning, and session attendance reporting
  - Attendance Gate verified in `AttendanceGateTest` (Phase J §27):
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
  - Education Gate verified in `EducationGateTest` (Phase J §24):
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
  - Invariants strictly enforced: `User ≠ Student`, `Teacher ≠ Role`, `Parent ≠ Student`, `Global Identity ≠ Tenant Authorization` (SEC-INV-006)
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
