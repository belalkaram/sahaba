# Decisions — القرارات المعتمدة

> **للمالك:** هذه القيم الافتراضية المقترحة. إن أردت تغيير أي قرار، عدّل عمود "القرار" قبل أن يصل Claude Code للمرحلة المعنية.
> **For Claude Code:** Treat the "Decision" column as approved. Do not re-open these. If a needed decision is missing here, stop and ask.

| ID | Question | Decision (default) | Needed by | Alternatives |
|---|---|---|---|---|
| OD-1 | System roles per tenant | 8 roles: `owner`, `center_admin`, `branch_manager`, `teacher`, `assistant`, `finance`, `student`, `parent`. Platform roles (Control DB): `platform_super_admin`, `platform_support`. | R1-A3 | Fewer roles (merge owner/center_admin) |
| OD-2 | Staff experience | One experience `/staff/*` for teacher + assistant + finance; navigation and actions driven by permissions. Tenant admin experience `/admin/*`. Student `/student/*`, parent `/parent/*`, platform `/platform/*`. | R1-B3 | Separate `/teacher` and `/assistant` trees |
| OD-3 | Google Drive integration | One Google connection **per tenant** (OAuth by the tenant owner), files uploaded into a tenant folder, sharing restricted; embed URL generated only after access check. Keep "register existing Drive link" as a secondary option. | R4-3 | Platform-wide Service Account |
| OD-4 | QR attendance direction | Primary: **assistant/teacher scans student QR** (student shows a short-lived signed QR from "My Card"). Session-QR (student scans) deferred. | R5-1 | Both modes |
| OD-5 | Google Meet | Create meetings via **Google Calendar API events with `conferenceData`** using the tenant's Google connection (same as OD-3). Until connected: allow pasting an existing Meet link, labelled as manual. | R8-6 | Meet REST API |
| OD-6 | AI Tutor | **Remove** from the UI now; keep a "قريبًا" placeholder only if it is clearly labelled. | R4-7 | Implement with Claude API later |
| OD-7 | Who reviews payments by default | ~~`finance`, `owner`, `center_admin`~~ **Superseded by OD-27 (2026-11-05): student payments are reviewed by the platform super admin only; tenant roles get read-only payment status.** Applies from P4 / ADR-004. | R1-A3 | Teacher by default |
| OD-8 | Route rename impact | Old routes `/teacher/*` redirect to `/staff/*` during the transition; removed in R7. | R1-B3 | Keep `/teacher` |
| OD-9 | Platform auth mechanism | Separate `platform_users` table + bearer tokens on a `platform.auth` middleware (same token style as tenant tokens), no tenant header. | R0-1 / R1-A9 | Laravel Sanctum |
| OD-10 | Interim platform protection in R0 | Static `PLATFORM_ADMIN_TOKEN` from `.env` checked by `platform.auth` until R1-A9 replaces it. Empty/missing token ⇒ deny all. | R0-1 | — |
| OD-11 | File storage for proofs/materials | Laravel `local` private disk in dev, S3-compatible in prod; downloads through signed temporary routes only. | R3-3 | — |
| OD-12 | Queue driver | `database` queue now; Redis in production config. | R8-3 | — |
| OD-13 | Email | SMTP via Laravel Mail; log driver in dev. | R8-1 | — |
| OD-14 | Frontend testing | Playwright for E2E; no unit test framework required unless needed. | R1-B | Vitest + Playwright |
| OD-15 | Self-enrollment | Disabled. Enrollment happens through entitlement (payment approval) or staff action. Free courses: a course flag `is_free` allows self-enrollment. | R3-2 | — |
| OD-16 | Display font | `Liftaswashfixed` (web embedding licensed, confirmed by owner 2026-11-02) for **Arabic text only** via `unicode-range`, used for headings/display. IBM Plex Sans Arabic (self-hosted via `@fontsource`) for everything else. See `docs/design/UI-UX-REDESIGN-PLAN.md` §5. | R7-0a | — |
| OD-17 | Numerals | Arabic-Indic digits (٠–٩, `nu-arab`) for all displayed numbers; identifiers (email, slug, codes, OTP, phone, IBAN, academic IDs) shown as-is in LTR isolation; numeric inputs accept both and normalize to 0–9 before API calls. | R7-0a | Western digits |
| OD-18 | Calendar | Gregorian primary + Hijri (Umm al-Qura) secondary on important dates; Hijri as tooltip in dense tables. Always explicit calendar via `src/lib/format.ts` (never bare `ar-SA`). | R7-0a | Gregorian only |
| OD-19 | Tenant admin landing | Separate `/admin/dashboard`; admins no longer land on the staff/teacher dashboard. | R7E | — |
| OD-20 | Demo login accounts | Shown in development. In production hidden by default; a platform-admin switch (`/platform/settings`, audited, read by login via `GET /public/config`, fail-closed) can enable it. `NEXT_PUBLIC_DEMO_LOGIN=true|false` forces it. Demo seeder never runs in production. | R2-6 / R7F | Dev only |
| OD-21 | Landing marketing content | Sample content allowed **only** on the public landing, in one file `src/features/landing/content.ts`, every item `sample: true`, fictional names and generated logos only (no real entities). Release gate fails while any `sample: true` remains. Exception to Operating Rule §4 limited to this file. | R7F | Omit sections |
| OD-22 | Product name | **سحابة** / **Sahaba** (changed by owner 2026-11-04; replaces «سنتاركم»). Single source: `apps/web/src/config/brand.ts`. | R7-0a | — |

### Owner decisions — 2026-11-05 (plan: `docs/plans/2026-11-05-platform-console-tenancy-venues-qr-plan.md`)

| ID | Question | Decision (approved by owner 2026-11-05) | Needed by | Alternatives |
|---|---|---|---|---|
| OD-23 | Tenant types | `individual_teacher` or `organization`; organization has `organization_kind` ∈ `center`, `academy`, `school`, `institute`. | P1 | — |
| OD-24 | Independent teacher experience | Very simple UI: no branch manager, no center admin, no "branches" or complex roles. The teacher can teach in several centers and manages the halls inside them (OD-30). Visible roles: owner (teacher), assistant, student, parent. | P1 | — |
| OD-25 | Teacher who is independent **and** inside a contracted center | One platform-level staff identity (`global_staff_identities` + per-tenant links by invitation + OTP; never auto-linked by email). Workspace switcher. One token per tenant; no permission crosses tenants. ADR-003. | P7 | — |
| OD-26 | Landing self-registration | Organizations create a **lead reviewed first** by the platform team, then converted to a tenant. Independent teachers activate immediately. | P2 | — |
| OD-27 | Money | Teachers and organizations pay **nothing**. **Each student pays 10 SAR per month** (configurable by the super admin, never hard-coded). Payment is a **manual transfer** with proof; **review and approval by the platform super admin only, not the teacher**. Approval grants that month's access. Supersedes OD-7. ADR-004. Open: Q-1..Q-4 in the plan §2. | P4 | Platform SaaS plans (rejected) |
| OD-28 | Super-admin visibility | Sees everything: statistics, numbers **and students' personal data**. Controls: `platform_super_admin` only, every PII read and export audited, no PII in logs, privacy notice (PDPL). ADR-005. | P3 | Aggregates only (rejected) |
| OD-29 | QR decoding without `BarcodeDetector` | `@zxing/browser` (or `jsqr`), lazy-loaded only when `BarcodeDetector` is missing. | P6 | — |
| OD-30 | Non-contracted center | Added by the teacher as a **place only**: center name, address, halls. No center account, no tenant link. | P5 | — |
| OD-31 | Services | Two separate services, **online** and **offline** (existing `online` / `offline` modules). A tenant takes one or both at sign-up; the super admin can change them. Navigation, pages and API are gated server-side. | P1 | — |
| OD-32 | Student mode | Each enrollment has `mode` ∈ `online`, `offline`, `both`. An offline student's account is **follow-up only**: attendance, homework checks, scores, payments, announcements. No videos or online exams (enforced in the backend). The teacher's assistant is the main offline actor: QR attendance, homework checks, paper-quiz scores. | P8 | — |
| OD-33 | Parent link & notifications | **Every student must be linked to a parent** (at least name + mobile) on create/import. Notifications route to the student and/or the parent per event. A WhatsApp channel sits behind an adapter (Meta WhatsApp Business Cloud API, approved templates, opt-in) and is enabled once credentials exist. | P9 | — |
