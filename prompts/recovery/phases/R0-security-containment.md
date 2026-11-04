# R0 — Security Containment

> **بالعربي:** قفل الثغرات الحرجة فورًا بدون إعادة تصميم. صغيرة ومحلية.
> **Closes:** T-SEC-01, T-SEC-03, T-SEC-04, T-SEC-05, T-SEC-06, T-SEC-12, T-SEC-14, T-SEC-16, T-FEAT-27b, T-QA-02
> **Depends on:** nothing. **Decisions used:** OD-10.

## Context

The audit found that anyone on the network can provision/modify tenants and mint a support token into any tenant, that students can read exam answers, and that payment proofs and tenant audit logs are readable by any authenticated user. Fix these with the smallest correct change. The full platform identity comes later (R1-A9).

## Tasks

### R0-1 — Protect all platform endpoints (T-SEC-01, T-QA-02)
- Files: `apps/api/routes/api.php` (lines ~49-61), `apps/api/bootstrap/app.php`, new `apps/api/app/Http/Middleware/PlatformAuthenticate.php`, `apps/api/config/services.php` or new `config/platform.php`, `apps/api/.env.example`.
- Create middleware alias `platform.auth`. Interim rule (OD-10): request must send `Authorization: Bearer <PLATFORM_ADMIN_TOKEN>`; compare with `hash_equals`; if the env value is empty ⇒ deny everything (401).
- Wrap **all** of: `GET/POST /tenants`, `GET/PUT /tenants/{id}`, `POST /tenants/{id}/support-access`, `GET /platform/audit-logs`.
- In `SupportAccessController`: remove the `?? 1` fallback; record actor as `platform_token` (interim) in the log and audit.
- Frontend `apps/web/src/lib/platform-api.ts`: send the platform token from a platform login screen value stored in memory/sessionStorage (simple interim "Platform access key" field on `/platform` entry). Never put it in `NEXT_PUBLIC_*`.
- Update `PlatformTenantApiTest`, `SupportAccessGateTest`, `AuditLoggingGateTest`, `WhiteLabelGateTest` to send the token.
- New tests: each platform route without token ⇒ 401; wrong token ⇒ 401; empty env token ⇒ 401 even with empty bearer.

### R0-2 — Stop leaking exam answers (T-SEC-04)
- Files: `apps/api/app/Models/Question.php`, `apps/api/app/Http/Controllers/Api/Assessment/ExamController.php` (`index` line ~26), `apps/api/routes/api.php`.
- Add `protected $hidden = ['correct_answer'];` to `Question`. Where staff legitimately need answers (exam editing), expose them only through an endpoint protected by `exams.create` using `makeVisible`.
- `index`: do not eager-load `questions` for users without `exams.create`; return `questions_count` instead.
- Test: student calls `GET /courses/{id}/exams` and `start` ⇒ JSON contains no `correct_answer` anywhere (assert recursively).

### R0-3 — Payment request IDOR (T-SEC-05)
- File: `PaymentRequestController@show`.
- Allow if: user has `payments.approve` or `payments.reject` (interim, catalog comes in R1) **or** the request's `student_id` equals the user's student id. Else 403.
- Test: student A cannot view student B's request; owner can; admin can.

### R0-4 — Tenant audit logs (T-SEC-06)
- Add middleware `tenant.can:audit.view` to `GET /audit-logs`. Add `audit.view` to the seeder's permission list and to the admin role.
- Test: student ⇒ 403, admin ⇒ 200.

### R0-5 — Support token not in URL (T-SEC-03)
- Backend: `POST /tenants/{id}/support-access` returns a **one-time exchange code** (random, stored hashed, 60s TTL, single use) instead of the token. New tenant-scoped endpoint `POST /auth/support/exchange { code }` (inside `tenant` middleware, outside `tenant.auth`) returns the bearer token.
- Frontend: platform page opens `/login?support_code=…&tenant=…`; login page exchanges the code via POST and then removes the query string (`router.replace`).
- Test: code works once; second use ⇒ 401; expired ⇒ 401.

### R0-6 — Device replacement bug (T-SEC-12)
- Backend `CredentialLifecycleService::replaceDevice` + `CredentialController@replaceDevice`: support a mode where the staff action **unbinds** the current device (with reason, audited) and the next successful coupon login binds the new device. Make `new_device_id` / `new_device_fingerprint` optional; when omitted ⇒ unbind mode.
- Frontend `apps/web/src/app/teacher/credentials/page.tsx` (~line 166): remove random fingerprint generation; call unbind mode; message: "تم فك ربط الجهاز — سيُربط الجهاز الجديد عند أول تسجيل دخول".
- Test: after unbind, login from a new device succeeds and binds; old device then gets `SECOND_DEVICE_PROHIBITED`.

### R0-7 — Honest platform health (T-FEAT-27b)
- `apps/web/src/app/platform/dashboard/page.tsx` lines ~31-39, 93-123: use `apiClient`/env base URL (no hardcoded `http://localhost:8000`); on failure show "تعذر الوصول للخادم" state; remove all `'healthy'`/`'OK'` fallbacks.

### R0-8 — CI security audits must fail (T-SEC-14)
- `.github/workflows/ci.yml` lines ~103,107: remove `|| true`. If current audits fail, record the advisories in the report and in `docs/project-management/risks.md`; fix what is trivially upgradable; for the rest stop and ask.

### R0-9 — Secret hygiene (T-SEC-16)
- Search the repo (excluding `node_modules`, `vendor`) for `GOOGLE_CLIENT_SECRET` and any `client_secret` value in frontend files and `NEXT_PUBLIC_*`. Report findings **without printing secret values**. If a secret is in a frontend file, remove it there and note in the report that the user must rotate it in Google Cloud Console.
- Verify `.gitignore` covers `.env`, `.env.local`, `apps/api/database/*.sqlite`, `apps/api/database/tenants/*.sqlite`.

## Acceptance criteria

- [ ] No platform route is reachable without the platform token (tests).
- [ ] No API response to a student contains `correct_answer` (test).
- [ ] Payment request and audit log access are permission/ownership checked (tests).
- [ ] Support access uses one-time code exchange; no token in any URL.
- [ ] Device replacement no longer locks students out (test).
- [ ] Platform dashboard shows real health or a real error.
- [ ] CI audits are blocking.
- [ ] `php artisan test`, `pint --test`, `tsc --noEmit`, `npm run lint`, `npm run build` all pass.

## Report

`docs/recovery-reports/R0.md` + tracker + coverage-matrix rows (FR-ADMIN-002/003/004, FR-ONLINE-010, FR-BILL-005, FR-AUTH-006).
