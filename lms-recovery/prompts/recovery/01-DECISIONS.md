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
| OD-7 | Who reviews payments by default | `finance`, `owner`, `center_admin`. `teacher` does **not** by default (can be granted). | R1-A3 | Teacher by default |
| OD-8 | Route rename impact | Old routes `/teacher/*` redirect to `/staff/*` during the transition; removed in R7. | R1-B3 | Keep `/teacher` |
| OD-9 | Platform auth mechanism | Separate `platform_users` table + bearer tokens on a `platform.auth` middleware (same token style as tenant tokens), no tenant header. | R0-1 / R1-A9 | Laravel Sanctum |
| OD-10 | Interim platform protection in R0 | Static `PLATFORM_ADMIN_TOKEN` from `.env` checked by `platform.auth` until R1-A9 replaces it. Empty/missing token ⇒ deny all. | R0-1 | — |
| OD-11 | File storage for proofs/materials | Laravel `local` private disk in dev, S3-compatible in prod; downloads through signed temporary routes only. | R3-3 | — |
| OD-12 | Queue driver | `database` queue now; Redis in production config. | R8-3 | — |
| OD-13 | Email | SMTP via Laravel Mail; log driver in dev. | R8-1 | — |
| OD-14 | Frontend testing | Playwright for E2E; no unit test framework required unless needed. | R1-B | Vitest + Playwright |
| OD-15 | Self-enrollment | Disabled. Enrollment happens through entitlement (payment approval) or staff action. Free courses: a course flag `is_free` allows self-enrollment. | R3-2 | — |
