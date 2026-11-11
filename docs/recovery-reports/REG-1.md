# REG-1 — Student self-registration (Saudi market)

Date: 2026-11-06 · Status: **IMPLEMENTED, backend VERIFIED by feature tests; UI checked in the browser up to step 2 only** (see "Not verified").

Requested by the product owner outside the numbered phases. Governing decisions: OD-15 (no self-enrollment — a registration is a *request* that staff approve), OD-17 (digits), OD-23/24 (independent teacher = a tenant), OD-28 (PII audited, none in logs), OD-33 (every student has a guardian with name + mobile).

## Flow

1. Login page → "سجّل كطالب جديد" → public `/register` (6 steps with a progress bar: student → address → guardian → password → choose centers/teachers → review).
2. The student picks one or more centers / independent teachers (max 5) from a directory of tenants that opted in (`tenants.accepts_registrations`, switch in `/admin/settings`).
3. One request is created **inside each chosen tenant's own database**. Each tenant decides independently.
4. Reviewer (`students.create` at **tenant** scope — owner/center_admin/independent teacher) opens `/teacher/registrations`, approves or rejects.
5. Approval calls the existing `UserManagementService::createStudent`: creates the student user (login = mobile + the password chosen at registration, email optional), links/creates the guardian by mobile, links the global identity, audits `student.created` and `student.registration.approved`.

## Data and rules

- Fields: full name, national ID/iqama, region (13 Saudi regions), governorate/city, address, stage + grade, student mobile, guardian name + mobile + occupation, optional email, password + confirmation, target tenants.
- `App\Support\Saudi\SaudiRules` (mirrored in `apps/web/src/lib/saudi.ts`): ID = 10 digits starting 1/2 with the Luhn-style checksum; mobile normalised to `05XXXXXXXX` from 05…, 5…, 966…, +966…, 00966…, Arabic-Indic digits; guardian mobile must differ from the student's; password ≥ 8 with letters and digits.
- The login endpoint now also tries the normalised mobile, so `+966…` / Arabic digits log in too.
- National ID: encrypted at rest (`encrypted` cast), HMAC hash only for duplicate hints, hidden from every JSON payload, reviewers see the last 4 digits. Password stored as a bcrypt hash, wiped on rejection.
- Migrations: control `tenants.accepts_registrations`; tenant `student_registration_requests` + Saudi profile columns on `students`. Run `php artisan migrate` and `php artisan lms:migrate-tenants`.
- Endpoints: `GET /public/registration/options|academies|status`, `POST /public/registration` (throttled, honeypot), `GET /registration-requests`, `GET /registration-requests/pending-count`, `POST /registration-requests/{id}/approve|reject`.

## Verification

- `StudentRegistrationTest`: 10 tests / 83 assertions (rules, opt-in directory, per-tenant requests and isolation, encryption at rest, validation, honeypot, reviewer permission, approval → login with 3 mobile spellings + guardian link, double decision 409, rejection, applicant status needs reference + matching mobile).
- `tsc`, ESLint (no errors), `lint:design` pass. Browser: `/register` renders, client validation, steps 1→2, Arabic-Indic ID and +966 accepted.
- **Not verified:** a full end-to-end submit → approve through the browser (see incident below: the local API is currently pointed at a remote database, so no data was written); steps 3–6 visually; reviewer inbox UI in the browser; real SMS/WhatsApp (none exists — the applicant is not notified of the decision, they can check status with reference + mobile via the API; there is no UI for that yet).

## Incident: tests reached a remote Postgres

`apps/api/.env` was changed on 2026-11-06 to `DB_CONNECTION=pgsql` with `DB_URL` / `DB_TENANT_URL` (Neon). `phpunit.xml` forced `DB_URL=""` but not `DB_TENANT_URL`, so one test run created Postgres schemas named `tenant_reg-*` on that database and ran the first tenant migrations in them before failing on a duplicate `sessions` table. Fixed by forcing `DB_TENANT_DRIVER=sqlite` and `DB_TENANT_URL=""` in `phpunit.xml`, plus a test that fails if the tenant store is not sqlite. The leftover schemas were **not** removed; they need an explicit decision.

## Discovered, not fixed / open decisions

- OD-new: guardian **name** is collected in addition to the mobile (OD-33 requires both); region and governorate are separate fields.
- OD-new: parent login — the guardian account is created by mobile on approval; how a guardian first sets a password (OTP) is not built.
- OD-new: no applicant notification channel yet (email optional, no SMS).
- A student registering with the same national ID twice in one tenant creates two pending requests; reviewers see a duplicate warning.
- Existing students are not migrated to carry a national ID.
