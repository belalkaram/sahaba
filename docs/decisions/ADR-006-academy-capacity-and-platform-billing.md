# ADR-006 — Academy capacity (seat = code) bought by the academy and granted by the super admin

**Status:** Accepted (owner, 2026-11-12)
**Decisions:** OD-38, OD-39 (supersede the money part of OD-27; amend ADR-004)
**Tasks:** CAP-1 (this ADR), PLAT-FEE-1 (retire the student platform fee flow)

## Problem

ADR-004 made each student pay the platform 10 SAR/month, reviewed by the super admin. The owner now wants the
platform to sell **capacity to the academy** and to control growth centrally: an academy (or independent teacher)
can only add students/codes up to a quota, and only the super admin can raise it, after a manual payment.

## Decision

1. **Seat model.** A student is a code; a code works on one device. Seats used by a tenant =
   Σ over students of `max(1, live codes)`, where a live code is `pending` or `active`, not revoked, not expired.
   - Creating a student (staff form, CSV import, approving a self-registration) needs one free seat.
   - The student's first code uses the seat the student already holds; any further code (second device) needs one more.
   - Device switching (`replace-device` / unbind) does not use a seat. Revoking or expiry frees it.
   - Online and offline students share one quota (OD-38).
2. **Where the quota lives.** Control DB, `tenants.seat_quota` (unsigned int). The tenant cannot change it; every
   write goes through the platform API (`platform.auth`, `platform_super_admin`) and is audited.
3. **Defaults.** `platform_settings.default_seat_quota` (super admin). New tenants start with it. Existing tenants are
   back-filled with their current usage (never locked out). `NULL` quota is treated as "not set" only during the
   migration window; the service fails closed (0 free seats) if it ever meets `NULL` after that.
4. **Capacity requests.** Control DB `capacity_requests`: tenant, seats requested, amount, transfer proof (private
   disk), note, status `pending|approved|rejected`, reviewer, reviewed_at, seats granted. The academy creates one from
   its admin area; the super admin approves (adds the granted seats to the quota, may grant fewer) or rejects with a
   reason. Idempotent approval. Payment is manual (bank transfer + proof); there is no gateway.
5. **Enforcement** is in the backend (`TenantCapacityService::assertCanAdd()` inside `UserManagementService::createStudent`
   and `CredentialLifecycleService::issueCredential`); the API answers `409 CAPACITY_EXCEEDED` with used / quota.
   The UI shows usage and a "request more" action, but is not the boundary.

## Impact

- **ADR-004 / OD-27:** students no longer pay the platform. The student 10 SAR flow (`/student/plans` platform fee,
  `/platform/payments`) keeps working until PLAT-FEE-1 retires it, so nothing breaks mid-way. Academy packages (OD-34)
  are unaffected.
- **Registration approval** can now fail with `CAPACITY_EXCEEDED`; the reviewer sees the reason and the request stays pending.
- **CSV import** stops at the first row over quota and reports it; earlier rows are kept (same as other row errors).
- **Platform console** gains: default quota setting, quota per tenant, and a capacity-request review inbox.

## Alternatives rejected

- Separate online/offline or student/code quotas (owner chose one quota, OD-38).
- Per-student platform fee (superseded, OD-39).
- Quota enforced only in the UI (violates "frontend is not the security boundary").
