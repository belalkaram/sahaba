# R8 — Notifications, Reports, Analytics, Google Meet

> **بالعربي:** إشعارات حقيقية (داخل التطبيق + بريد)، Queue، تقارير غير متزامنة، تحليلات بدون أرقام وهمية، Google Meet حقيقي، ومقاييس المنصة.
> **Closes:** T-FEAT-10, 11, 12, 27, 28, 29, 31, 32, C-13
> **Depends on:** R3–R6 (events come from them). **Decisions:** OD-5, OD-12, OD-13. **Spec:** Master §46, §48-49, FR-NOTIFY-*, FR-REPORT-*, FR-ANALYTICS-*, BR-026.

**Stop and ask** before R8-6 if Google Calendar API is not enabled on the user's Google Cloud project, and before enabling real email if SMTP credentials are not provided (use `log` mailer meanwhile).

## Tasks

### R8-1 — Domain events & notification service
- Events: `PaymentSubmitted`, `PaymentApproved`, `PaymentRejected`, `SubscriptionExpiringSoon` (scheduled), `GradePublished`, `AssignmentDue` (scheduled), `ExamOpened`, `SessionScheduled`, `SessionCancelled`, `AttendanceMarkedAbsent` (to parents, tenant setting), `CredentialIssued`, `DeviceUnbound`, `SupportSessionStarted` (to tenant owner).
- `App\Domain\Communication\NotificationService` maps event ⇒ recipients (via scopes: e.g. parents of student) ⇒ channels per user preference: `database` (in-app), `mail`. WhatsApp remains an interface only (`WhatsAppChannel` not implemented — FR-NOTIFY-003 future).
- User notification preferences table + `GET/PUT /me/notification-preferences`.
- Arabic templates; tenant branding in emails.
- Tests per event ⇒ recipients ⇒ stored notifications.

### R8-2 — Notification center UI
- Bell with unread count (poll every 60s or SSE if trivial), dropdown latest 10, `/notifications` page with filters and mark read/all; deep links to the related entity.

### R8-3 — Queue
- `QUEUE_CONNECTION=database` (OD-12), jobs table migration exists (check), queue worker documented in `infrastructure/RUNBOOK.md`; Docker compose has a worker service.
- Move to jobs: report generation, analytics snapshot computation (nightly + on relevant events, debounced), CSV import (R2-2), notification mail sending, scheduled events (Laravel scheduler).
- Platform health includes queue backlog and failed jobs count.

### R8-4 — Analytics honesty & completeness
- `DashboardController`: when no snapshot ⇒ return `{ dashboard: null, status: 'not_computed' }` (remove the 100% fallback); UI shows "لم تُحسب بعد".
- Snapshots include: attendance rate, assignment completion, exam average, lesson completion (from R4 progress), last activity; per course and overall.
- Staff analytics endpoints: course, class, at-risk students list (thresholds as tenant settings).
- Metrics definitions/versions UI for `metrics.manage` (FR-ANALYTICS-002/003).

### R8-5 — Reports
- Report definitions: student report, parent report, class attendance report, course progress report, payments report. Formats: PDF (Arabic-capable — choose a library that supports RTL Arabic shaping and record it) and CSV.
- `POST /reports` ⇒ queued ⇒ status polling ⇒ `GET /reports/{id}/download` signed URL; data scope enforced (FR-REPORT-003).
- UI `/admin/reports`, `/staff/reports`, parent downloads.
- Audit log UIs (if not done in R7E/R7F).

### R8-6 — Google Meet (real)
- Using the tenant Google connection (R4-3) with Calendar scope: create event with `conferenceData.createRequest` ⇒ store `hangoutLink`, event id; update/cancel propagate to Google; attendees optional.
- If tenant not connected: allow "manual Meet link" with label "رابط يدوي" — no generated codes. Delete `generateSpaceCode` usage.
- Join endpoint enforces ContentAccessPolicy (R3) and returns the link only within a window around start time (setting).
- Remove the simulated virtual classroom page; student meetings page lists sessions with join buttons, states (upcoming/live/ended), and recordings link if the teacher adds one.

### R8-7 — Platform metrics
- If not completed in R2-6: aggregated counts per tenant computed by a scheduled job into a control-DB table (no live cross-tenant queries on page load).

## Acceptance criteria

- [ ] Payment approval ⇒ student sees in-app notification and (log/SMTP) email; parent gets absence notification when enabled.
- [ ] Report generation is async and downloadable; unauthorized download blocked.
- [ ] No dashboard shows numbers that were not computed from data.
- [ ] Meeting created ⇒ real Google event and Meet link (when connected) — evidence screenshot; otherwise BLOCKED with reason in tracker.
- [ ] All standard commands pass; queue worker documented.
