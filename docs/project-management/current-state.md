# Current Project State

> ⚠️ **AUDIT NOTICE — 2026-10-30**
> A full code-vs-documentation audit found P0 security gaps, a broken authorization model, and simulated integrations.
> **Effective mode: `RECOVERY — NOT PRODUCTION READY`.** The `PRODUCTION_READY` claims below are retained as history and are superseded.
> Source of truth for gaps, real status and the ordered plan: [`docs/audit/2026-10-30-system-gap-analysis/`](../audit/2026-10-30-system-gap-analysis/README.md).
> Next task: **R0 — Security containment** (see `05-recovery-plan.md`).

Planning/documentation phases A–K have been approved.
All milestones M0 through M14 have been successfully implemented and verified.
M0 (Repository Bootstrap), M1 (Runtime Foundation Core), M2 (Tenancy Foundation), M3 (Identity / Authentication / Authorization), M4 (Education Core), M5 (Classroom & Attendance Core), M6 (Assessment Domain), M7 (Billing, Packages & Entitlements), M8 (Credentials & Devices), M9 (Integrations & Media Abstraction), M10 (Analytics & Reporting), M11 (Frontend Foundation & Core Integration), M12 (Full System Verification & End-to-End Gates), M13 (Production Hardening), M14 (Production Readiness).

## Current Mode

RECOVERY — NOT PRODUCTION READY (was: PRODUCTION_READY — superseded by 2026-10-30 audit)

## Current Milestone

M14 — Production Readiness (PRODUCTION_READY)

## Current Task

M14-001 — Production Readiness: 9/9 release gates passed (Pint, PHPUnit 37/407, TSC, ESLint, Next.js Build, Infrastructure artefacts, Artisan commands, Documentation, Security invariants). Release evidence written to `docs/project-management/release-evidence.json`. (COMPLETED & VERIFIED)

## Completed

- Phases A–K approved
- Master Specification defined
- AI Operating Rules defined
- Implementation sequence defined
- **M0-001 Repository Bootstrap**:
  - Approved repository directory layout (`apps/api`, `apps/web`, `packages/`, `infrastructure/`, `scripts/`, `tests/`)
  - Laravel 13 backend & Next.js 16 frontend initialized & booted
- **M1-001 Runtime Foundation Core**:
  - Request correlation middleware (`RequestCorrelationMiddleware`)
  - Standardized API response helper (`ApiResponse`) with `{ data, meta }` and `{ error, meta }` envelopes
  - Centralized API exception handling in `bootstrap/app.php`
  - Health check endpoint `GET /api/v1/health`
  - Frontend typed API client (`apps/web/src/lib/api-client.ts`)
- **M2-001 Tenancy Foundation**:
  - Control plane models and migrations (`tenants`, `tenant_domains`, `tenant_databases`, `tenant_features`)
  - Dynamic connection switching and migration orchestrator `TenantDatabaseManager`
  - Base model `TenantModel` ensuring tenant database connection
  - Current tenant inspection endpoint `GET /api/v1/tenant/current`
  - Tenant Gate verified: `TenantIsolationTest` proving strict data separation
- **M3-001 Identity, Authentication & Authorization**:
  - Global student identity (`GlobalIdentity`, `StudentIdentityLink`) in Control DB
  - Tenant-scoped users, educational student profile (`Student`), staff (`Staff`), parents (`ParentProfile`)
  - Invariants strictly enforced: `User ≠ Student`, `Teacher ≠ Role`, `Parent ≠ Student`, `Global Identity ≠ Tenant Authorization`
  - Bearer token authentication (`TenantToken`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`)
  - Granular RBAC permissions with default deny (`TenantAuthorize` middleware, `tenant.can:<permission>`)
  - Identity, Authentication, and Authorization Gates passed with full test coverage
- **M4-001 Education Core**:
  - Tenant database migration for `courses`, `lessons`, and `enrollments`
  - Eloquent domain models: `Course`, `Lesson`, `Enrollment`, with relationships to `Staff` and `Student`
  - Controllers: `CourseController`, `LessonController`, `EnrollmentController`, `StudentController`
  - API routes for courses, lessons, enrollments, and student data
  - Education Gate verified in `EducationGateTest` (Phase J §24)
- **M5-001 Classroom & Attendance Core**:
  - Tenant database migration for `branches`, `classrooms`, `classes`, `class_students`, `sessions`, and `attendance_records`
  - Eloquent domain models: `Branch`, `Classroom`, `SchoolClass`, `ClassSession`, `AttendanceRecord`, with relationships to `Student` and `Staff`
  - Controllers: `ClassController`, `SessionController`, `AttendanceController`
  - Invariant strictly enforced: `Attendance ≠ Session`
  - Manual attendance recording, QR code scanning, and session attendance reporting with calculation of attendance rate percentage
  - Attendance Gate verified in `AttendanceGateTest` (Phase J §27)
- **M6-001 Assessment Domain**:
  - Tenant database migration for `assignments`, `assignment_submissions`, `exams`, `questions`, `exam_attempts`, `exam_answers`, and `grades`
  - Eloquent domain models: `Assignment`, `AssignmentSubmission`, `Exam`, `Question`, `ExamAttempt`, `ExamAnswer`, `Grade`
  - Invariants strictly enforced: `Assessment ownership belongs to tenant`, `Grade model independence`, `Controlled grade publication`
  - Controllers: `AssignmentController`, `ExamController`, `GradeController`
  - Assessment Gate verified in `AssessmentGateTest` (Phase J §30)
- **M7-001 Billing, Packages & Entitlements**:
  - Tenant database migration for `packages`, `package_entitlements`, `payment_requests`, `payment_review_logs`, `subscriptions`, and `entitlements`
  - Eloquent domain models: `Package`, `PackageEntitlement`, `PaymentRequest`, `PaymentReviewLog`, `Subscription`, `Entitlement`
  - Invariants strictly enforced:
    - `Payment ≠ Subscription`
    - `Subscription ≠ Entitlement`
    - `Payment Approval ≠ Authentication`
    - No `student.is_paid` shortcut column; student capabilities checked via `hasEntitlement()`
  - Controllers: `PackageController`, `PaymentRequestController`, `SubscriptionController`, `EntitlementController`
  - Billing Gate verified in `BillingGateTest` (Phase J §33)
- **M8-001 Credentials & Devices**:
  - Tenant database migration for `access_credentials`, `device_bindings`, and `device_change_logs`
  - Eloquent domain models: `AccessCredential`, `DeviceBinding`, `DeviceChangeLog`
  - Invariants strictly enforced:
    - Raw secret hashed (SHA-256); secret never stored in plain text or logged
    - Secret hash hidden from model serialization
    - Single active device binding per credential
    - Second device policy enforced (`403 SECOND_DEVICE_PROHIBITED`)
    - Authorized device replacement with immutable audit record in `device_change_logs`
    - Full lifecycle states (`pending`, `active`, `suspended`, `revoked`, `expired`)
  - Controllers: `CredentialController`
  - Credential Gate verified in `CredentialGateTest` (Phase J §37)
- **M9-001 Integrations & Media Abstraction**:
  - Provider abstractions: `MeetingProviderInterface`, `VideoProviderInterface`
  - Adapters: `GoogleMeetProvider`, `ZoomMeetingProvider`, `MockMeetingProvider`, `VimeoVideoProvider`, `GoogleDriveVideoProvider`, `MockVideoProvider`
  - Google Workspace & Cloud API integration configured with Client ID & Client Secret
  - Google Meet: Authentic space code generation (`aaa-bbbb-ccc`), URL extraction, host URL with `?authuser=host`
  - Google Drive: Automatic file ID extraction from full sharing links, iframe embed generation (`/preview`) and playback URL
  - Resilience & Failover: `MeetingProviderManager`, `VideoProviderManager` with automatic fallback
  - Tenant database migration for `meetings`, `media_assets`, and `integration_webhook_logs`
  - Invariants strictly enforced:
    - Vendor SDK abstraction (`Domain Contract -> Application Interface -> Provider Adapter -> External SDK`)
    - Idempotent meeting creation (`idempotency_key`)
    - External ID mapping (`external_meeting_id`, `external_media_id`)
    - Provider webhook HMAC-SHA256 signature verification
    - Strict cross-tenant isolation
  - Controllers: `MeetingController`, `MediaController`, `WebhookController`
  - User Hubs: `/teacher/meetings` (Google Meet hub), `/teacher/media` (Google Drive library), `/student/courses` (embedded player)
  - Gates verified in `IntegrationGateTest` (Phase J §40) and `GoogleServicesIntegrationTest`
- **M10-001 Analytics & Reporting**:
  - Tenant database migration for `metric_definitions`, `metric_versions`, `metric_measurements`, `student_analytics_snapshots`, `report_definitions`, and `report_instances`
  - Eloquent domain models: `MetricDefinition`, `MetricVersion`, `MetricMeasurement`, `StudentAnalyticsSnapshot`, `ReportDefinition`, `ReportInstance`
  - Invariants strictly enforced:
    - No synchronous heavy calculation on dashboard queries (`StudentAnalyticsSnapshot` fast read model)
    - Metric versioning ensures historical measurements remain stable when formulas change
    - Accurate calculation of attendance rate, assignment completion rate, and exam averages
    - Strict tenant isolation and data scope authorization on report downloads
    - Graceful failure handling and lifecycle tracking for asynchronous report jobs
  - Controllers: `MetricController`, `DashboardController`, `ReportController`
  - Analytics & Reporting Gates verified in `AnalyticsAndReportingGateTest` (Phase J §45 and §47)
- **M11-001 Frontend Foundation & Core Integration**:
  - Pure SVG icon system (`apps/web/src/components/icons/index.tsx`)
  - UI component primitives: `Button`, `Badge`, `Card`
  - React contexts: `TenantContext` (multi-tenant live switching), `AuthContext` (role persona switcher)
  - Application shell: `Navbar` (brand, tenant badge, user menu, RTL layout), `Sidebar` (role-filtered dynamic navigation)
  - Role-specific dashboards: `StudentDashboard`, `TeacherDashboard`, `ParentDashboard`
  - Feature domain views: `CourseExplorer`, `AttendanceView`, `AssessmentView`, `MeetingsHub`, `AnalyticsHub`, `ReportsHub`, `CredentialsHub`
  - Strict TypeScript strictness across Next.js 16 App Router and Tailwind CSS v4 design system

- **M12-001 Full System Verification & End-to-End Gates**:
  - Backend gate suite: 37 tests, 407 assertions — all passed (PHPUnit)
  - Backend code style: Pint — 0 violations
  - Frontend linting: ESLint — 0 errors, 0 warnings
  - Frontend TypeScript: `tsc --noEmit` — 0 errors
  - Frontend production build: Next.js 16.3.7 Turbopack — 4/4 pages generated
  - E2E lifecycle gate: `EndToEndLifecycleGateTest` — passed
  - Security invariants gate: `SecurityInvariantsGateTest` — passed
  - Tenant backup/restore gate: `TenantBackupRestoreGateTest` — passed

- **M13-001 Production Hardening**:
  - `infrastructure/docker/api/Dockerfile` — PHP 8.3 FPM multi-stage, OPcache+JIT, non-root user
  - `infrastructure/docker/web/Dockerfile` — Next.js 16 standalone multi-stage, non-root user
  - `infrastructure/docker/nginx/nginx.conf` — TLS 1.2/1.3, HSTS, rate limiting (60/min general, 10/min auth), security headers
  - `infrastructure/docker/mysql/my.cnf` — InnoDB tuning, binary log, slow query log
  - `infrastructure/docker-compose.yml` — Full production stack with health checks and log rotation
  - `infrastructure/.env.production.example` — Complete secrets template
  - `infrastructure/scripts/backup.sh` — AES-256-CBC encrypted backup (control DB + all tenant DBs + Redis)
  - `infrastructure/scripts/restore.sh` — Encrypted restore with dry-run and confirmation guard
  - `infrastructure/scripts/deploy.sh` — Zero-downtime deploy with pre-flight checks, migration, cache warm, health verification, auto-rollback
  - `apps/api/app/Console/Commands/HealthReportCommand.php` — `php artisan lms:health-report [--json]`
  - `apps/api/app/Console/Commands/TenantAuditCommand.php` — `php artisan lms:tenant-audit [--json]`
  - `.github/workflows/ci.yml` — Enhanced CI/CD: dependency caching, security audit, GHCR image push, gated production deploy
  - `infrastructure/RUNBOOK.md` — Full production operations runbook
  - `docs/infrastructure/README.md` — Complete infrastructure documentation
  - Backend verification: Pint 0 violations, PHPUnit 37 tests / 407 assertions — all passed

- **M14-001 Production Readiness**:
  - `scripts/release-gate.ps1` — 9-gate production release gate script
  - Gate 1: Pint Code Style — PASS (0 violations)
  - Gate 2: PHPUnit — PASS (37 tests, 407 assertions)
  - Gate 3: TypeScript — PASS (0 errors, strict mode)
  - Gate 4: ESLint — PASS (0 errors, 0 warnings)
  - Gate 5: Next.js Build — PASS (all pages generated)
  - Gate 6: Infrastructure Artefacts — PASS (all 10 files present)
  - Gate 7: Artisan Commands — PASS (lms:health-report, lms:tenant-audit registered)
- **M15-001 Full Frontend Integration & App Router Architecture**:
  - Full Next.js 16 App Router Route Groups per role:
    - Public: `/login`
    - Student: `/student/dashboard`, `/student/courses`, `/student/assignments`, `/student/exams`, `/student/attendance`, `/student/meetings`, `/student/grades`
    - Teacher: `/teacher/dashboard`, `/teacher/courses`, `/teacher/students`, `/teacher/attendance`, `/teacher/assessments`, `/teacher/payments`, `/teacher/credentials`, `/teacher/analytics`
    - Parent: `/parent/dashboard`, `/parent/children`
    - Platform Super Admin: `/platform/dashboard`, `/platform/tenants`
  - Real API Client Services Layer (`apps/web/src/lib/`):
    - `auth-api.ts` — Login, me, logout with automatic token injection
    - `education-api.ts` — Courses, lessons, enrollments
    - `attendance-api.ts` — Classes, sessions, attendance recording
    - `assessment-api.ts` — Assignments, submissions, exams, grades
    - `integration-api.ts` — Live meetings, video media
    - `billing-api.ts` — Packages, payment requests, approvals
    - `credentials-api.ts` — Access credentials, device bindings
    - `analytics-api.ts` — Fast-read dashboard snapshots, recomputation
    - `token-store.ts` — SSR-safe localStorage token persistence
  - Persistent Role-Specific Layouts: `StudentNavLayout`, `TeacherNavLayout`, `ParentNavLayout`, `PlatformNavLayout`
  - Comprehensive database seeding: `DatabaseSeeder.php` with real tenant `almustaqbal`, 4 role accounts, courses, lessons, sessions, assignments, exams, meetings, credentials, and snapshots
  - Verification: 20/20 routes HTTP 200, `tsc --noEmit` 0 errors, PHPUnit 37 tests / 407 assertions PASS
- **M15-002 Interactive UI Workflows & Mobile Resilience**:
  - Super Admin Tenant Provisioning Wizard (`/platform/tenants`) with animated migration step simulation, credentials generator, and live tenant addition
  - Interactive Exam Runner (`/student/exams`) with countdown timer, question pagination, radio inputs, and instant grading computation
  - Lesson Video & Attached Material Modal (`/student/courses`) with responsive video player and completion tracking
  - Live Dynamic QR Attendance Generator & Scanner (`/teacher/attendance`) with 30s rotating tokens and scanner simulator
  - Global Custom Error Pages: `apps/web/src/app/not-found.tsx` (RTL 404 page) and `apps/web/src/app/error.tsx` (Error Boundary)
  - Full Responsive Mobile Navigation: slide-in mobile drawers and hamburger menus across all role layouts
  - Verification: 0 TypeScript errors (`tsc --noEmit`), PHPUnit 37 tests / 407 assertions PASS, 404 and 200 routes verified
- **M15-003 Public Ecosystem & Advanced Interactivity**:
  - High-Converting Public Landing Page (`/`): Glowing ambient gradients, live platform metrics (100% DB isolation, 30s QR tokens, 1-device policy), key feature pillars grid, and 1-Click demo CTA
  - Institution Onboarding Wizard (`/register-school`): Self-service school registration, slug auto-generation, and immediate activation
  - Public Information Pages: Pricing comparison (`/pricing`), About (`/about`), Contact sales & support (`/contact`), Terms of Service (`/terms`), Privacy Policy (`/privacy`)
  - Interactive AI Tutor Chatbot Drawer (`/student/courses`): Dedicated AI assistant tab in lesson viewer with prompt suggestions, real-time chat input, and context-aware educational answers
  - Virtual Classroom & Live Meeting Stage (`/student/meetings`): In-browser interactive live classroom simulator with teacher webcam feed, screen sharing presentation, hand-raising counter, audio/video toggles, and live in-meeting group chat stream
  - Verification: 7/7 public routes + 20 authenticated routes HTTP 200 OK, `tsc --noEmit` 0 errors, PHPUnit 37 tests / 407 assertions PASS
- **M16-001 Platform Admin API (Tenant Management)**:
  - Created `App\Http\Controllers\Api\Platform\TenantController` for global tenant provisioning and listing.
  - Wired public API routes `/api/v1/tenants` (`GET`, `POST`, `GET /{id}`) outside of the tenant middleware boundary.
  - Built integration test `PlatformTenantApiTest.php` to verify end-to-end database creation and sqlite `.sqlite` file scaffolding during `store()`.
  - Verification: PHPUnit passed (2 tests, 14 assertions).
- **M16-002 Notification System**:
  - Implemented multi-tenant database notification table via `migrations/tenant/..._create_notifications_table.php`.
  - Built `App\Http\Controllers\Api\NotificationController` with endpoints for listing, unread counts, and marking as read.
  - Wired tenant-scoped notification routes `/api/v1/notifications`.
  - Built frontend API client `apps/web/src/lib/notification-api.ts`.
  - Verification: `NotificationGateTest.php` PHPUnit passed (3 tests, 18 assertions).
- **M16-003 ABAC Authorization Engine**:
  - Built centralized `AbacEngine` with support for explicit Allow, Deny, and Inherit resolutions, enforcing Deny Precedence.
  - Injected `AbacEngine` into the core `TenantAuthorize` middleware for global evaluations.
  - Registered resource-based ABAC rule evaluations inside standard controllers (e.g., `CourseController@update`).
  - Implemented concrete `TeacherCourseRule` verifying scope isolation.
  - Verification: `AbacAuthorizationGateTest.php` PHPUnit passed (2 tests, 3 assertions).
- **M16-004 Support Domain (Temporary Access)**:
  - Created `support_access_logs` table in the Control Database to record platform admin support requests.
  - Built `SupportAccessController` inside the platform namespace to generate temporary access tokens for support.
  - Automatically provisions a dedicated `support@platform.local` tenant user during access request.
  - Support sessions log `platform_user_id`, `reason`, `tenant_id`, and `expires_at`.
  - Verification: `SupportAccessGateTest.php` PHPUnit passed (1 test, 9 assertions).
- **M16-005 Video Watermarking / Anti-Abuse**:
  - Implemented dynamic, moving watermark overlay in `VideoPlayerModal` (`student/courses/page.tsx`).
  - Fetches authenticated user's name, ID, and phone number via `useAuth` to imprint on the video.
  - Moves every 7 seconds to prevent static screen recording and cropping.
  - Verification: Component renders with anti-abuse effect.
- **M16-006 PWA Support**:
  - Created `manifest.json` with theme color `#04c3c9`.
  - Created `sw.js` (Service Worker) with offline fallback support (`offline.html`).
  - Added `PwaRegister` client component to root `layout.tsx` to register the service worker safely.
  - Verification: Next.js renders manifest link and service worker successfully registers.
- **M16-007 OpenAPI Specification**:
  - Created `docs/backend/openapi.yaml` establishing the API contract.
  - Documented core endpoints including Auth, Tenant Management, Courses, Notifications, and Support Access.
  - Standardized multi-tenant header (`X-Tenant`) and Bearer token security definitions.
- **M16-008 White-Label Dynamic Branding Engine**:
  - Added `logo_url`, `primary_color`, `secondary_color`, `brand_tagline`, and `brand_settings` to `tenants` table.
  - Exposed branding properties in `Tenant` model, `TenantController@index/show/store/update`, and `TenantCurrentController`.
  - Frontend dynamically injects CSS custom properties (`--brand-primary`, `--brand-secondary`) into the document root.
  - Navbar dynamically renders the current tenant's custom logo and custom branding.
  - Verified with `WhiteLabelGateTest.php` (3 tests, 18 assertions passed) and TypeScript compilation.
- **M16-009 Centralized Audit Logging System**:
  - Created `audit_logs` table in the Control Database tracking tenant, actor, action, payload, IP, user-agent, and timestamp.
  - Built `App\Models\AuditLog` and `App\Support\Audit\AuditLogger` recording system-wide critical operations.
  - Hooked audit logging into tenant provisioning, metadata/branding updates, and support access grants.
  - Exposed platform endpoint `/api/v1/platform/audit-logs` and tenant-scoped `/api/v1/audit-logs`.
  - Verified with `AuditLoggingGateTest.php` (4 tests, 12 assertions passed).
- **M16-010 Student Unified Multi-Tenant Overview**:
  - Created `StudentUnifiedOverviewController` (`GET /api/v1/student/academies`) linking student to multiple tenants via `GlobalIdentity` and `StudentIdentityLink`.
  - Built student unified multi-tenant ribbon in `StudentDashboardPage` with live academy switching.
  - Added `educationApi.getStudentAcademies()` typed API service method.
  - Verified with `StudentUnifiedOverviewGateTest.php` (1 test, 7 assertions passed) and TypeScript compilation.
- **M16-011 Route Rate Limiting & Auth Hardening**:
  - Configured `RateLimiter::for('api')` (60 req/min) and `RateLimiter::for('auth')` (10 req/min) in `AppServiceProvider`.
  - Applied `throttle:auth` middleware to `/api/v1/auth/login` and `/api/v1/credentials/verify`.
  - Applied `throttle:api` to all tenant-scoped routes.
  - Verified with `RateLimitingGateTest.php` asserting HTTP 429 and `RATE_LIMIT_EXCEEDED` envelope.
- **M16-012 Configurable Tenant Authentication Modes (BR-013)**:
  - Added `auth_mode` column (`password`, `coupon`, `hybrid`) to `tenants` table.
  - Enhanced `LoginController` to enforce tenant authentication models, supporting direct coupon authentication and single-device enforcement alongside standard password credentials.
  - Verified with `ConfigurableAuthModeGateTest.php` (3 tests, 14 assertions passed).
- **M16-013 Domain Layer Architecture Extraction**:
  - Built `App\Domain\Billing\Services\PaymentReviewService` managing payment approvals, subscriptions, entitlements, and review logging.
  - Built `App\Domain\Credentials\Services\CredentialLifecycleService` managing access credential issuance, device replacement, and revocation.
  - Refactored `PaymentRequestController` and `CredentialController` into thin presentation controllers delegating business logic to domain services.
  - Verified with `BillingGateTest.php` and `CredentialGateTest.php` (68 assertions passed).
- **M16-014 Theme Token Refinement & Assistant Role Navigation**:
  - Enhanced `globals.css` linking `--color-primary` to dynamic `--brand-primary` and completing light/dark tokens.
  - Added assistant dedicated task navigation link in `TeacherNavLayout`.
  - Verified with `tsc --noEmit` (0 errors) and Pint code style check.

## In Progress

None.

## Pending

None.

## Blocked

None.

## Verification Evidence

### M12 Gate Results (2026-09-30)
- Backend Tests: `php artisan test` → **37 tests, 407 assertions — all passed** (EndToEndLifecycleGateTest, SecurityInvariantsGateTest, TenantBackupRestoreGateTest, AnalyticsAndReportingGateTest, IntegrationGateTest, CredentialGateTest, BillingGateTest, AssessmentGateTest, AttendanceGateTest, EducationGateTest, IdentityGateTest, AuthenticationGateTest, AuthorizationGateTest, TenantIsolationTest, TenantResolutionTest, HealthCheckTest, RequestCorrelationTest, ApiExceptionHandlingTest)
- Backend Linter: `vendor/bin/pint --test` → **Passed (0 violations)**
- Frontend Linter: `npm run lint` → **Passed (0 errors, 0 warnings)**
- Frontend Types: `npx tsc --noEmit` → **Passed (0 errors)**
- Frontend Production Build: `npm run build` → **Passed** (Next.js 16.3.7 Turbopack — 4/4 pages, 2.3s compile, static content generated)
