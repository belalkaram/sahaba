# Phase Report — PS-1 Platform Create-Tenant Form Security & Consistency

**Date:** 2026-11-05
**Status:** DONE
**Session scope:** PS-1 (F-5 / RK-2)

## 1. Tasks

| Task | Finding IDs | Status | Evidence |
|---|---|---|---|
| PS-1 | F-5, RK-2 | DONE | `Tests\Feature\PlatformTenantProvisioningSecurityTest` (7 tests, 24 assertions PASS), `PlatformTenantApiTest` (2 tests PASS), `TenantProvisioningTest` (5 tests PASS), `WhiteLabelGateTest` (3 tests PASS), `AuditLoggingGateTest` (3 tests PASS), `tsc --noEmit` PASS, `npm run build` PASS (68 routes) |

## 2. What changed

- **Backend:**
  - `apps/api/app/Http/Controllers/Api/Platform/TenantController.php`:
    - Added `ALLOWED_TYPES` and `ALLOWED_ORGANIZATION_KINDS` constants reflecting approved decision OD-23.
    - Updated `store()` validation:
      - Validates `type` with `Rule::in(self::ALLOWED_TYPES)`.
      - Validates optional `organization_kind` with `Rule::in(self::ALLOWED_ORGANIZATION_KINDS)`.
      - Validates optional custom `domain` with `nullable|string|max:255|unique:tenant_domains,domain`.
      - Requires owner password (`min:8`) whenever `owner` is provided (`owner.password => required_with:owner|string|min:8`).
    - Updated `update()` validation:
      - Validates `type` with `Rule::in(self::ALLOWED_TYPES)`.
      - Validates `organization_kind` with `Rule::in(self::ALLOWED_ORGANIZATION_KINDS)`.
  - `apps/api/app/Tenancy/TenantProvisioningService.php`:
    - Persists custom domain into `tenant_domains` with `type = 'custom'` when `domain` is passed in provisioning payload (in addition to primary `$slug.localhost`).
    - Saves `organization_kind` into `brand_settings` if provided.
  - `apps/api/tests/Feature/PlatformTenantProvisioningSecurityTest.php`:
    - New test suite covering:
      1. Rejection of tenant creation without password (422).
      2. Rejection of tenant creation with empty password (422).
      3. Rejection of tenant creation with invalid type (422).
      4. Rejection of tenant update with invalid type (422).
      5. Successful creation with valid OD-23 types (`individual_teacher`, `organization`).
      6. Custom domain persistence into `tenant_domains`.
      7. Static assertion proving `create-tenant-modal.tsx` and `platform/tenants/page.tsx` contain no `password123` string.

- **Frontend:**
  - `apps/web/src/features/platform/components/create-tenant-modal.tsx`:
    - Replaced free-form text input with a fixed select for tenant types: `organization` and `individual_teacher` (OD-23).
    - Added conditional sub-select for `organizationKind`: `center`, `academy`, `school`, `institute`.
    - Added real owner name input (`adminName`) with required validation.
    - Removed default `password123` placeholder and default value; made owner password required with `minLength={8}`.
    - Added domain field input and included it in the form change contract.
  - `apps/web/src/app/platform/tenants/page.tsx`:
    - Updated `formData` state to manage `adminName`, `organizationKind`, `domain`, and clean `adminPassword`.
    - Removed `formData.adminPassword || 'password123'` fallback.
    - Submits real `adminName`, required `adminPassword`, `organization_kind`, and optional trimmed `domain` to `platformApi.provisionTenant()`.
  - `apps/web/src/lib/platform-api.ts`:
    - Updated `ProvisionTenantPayload` to include `organization_kind?: string;` and `domain?: string;`.

- **Documentation:**
  - `docs/backend/openapi.yaml`: Updated `/tenants` schema (domain, type enum, organization_kind enum, owner.password minLength: 8).
  - `docs/project-management/risks.md`: Marked **RK-2** as `CLOSED`.
  - `prompts/recovery/03-PROGRESS-TRACKER.md`: Marked `PS-1` as `DONE`.
  - `docs/project-management/changelog.md`: Documented changes under `[PS-1]`.

## 3. Commands run (exact) and results

```text
apps/api> php artisan test --filter PlatformTenantProvisioningSecurityTest
→ 7 tests, 24 assertions, 0 failures (PASS in 4.27s)

apps/api> php artisan test --filter 'PlatformTenantApiTest|TenantProvisioningTest|WhiteLabelGateTest|AuditLoggingGateTest'
→ 13 tests, 73 assertions, 0 failures (PASS in 7.10s)

apps/api> vendor/bin/pint --test
→ passed (0 style issues)

apps/web> .\node_modules\.bin\tsc.cmd --noEmit
→ 0 errors (PASS)

apps/web> npm run lint
→ 0 errors, 124 pre-existing warnings (PASS)

apps/web> npm run lint:design
→ design-system check passed (PASS)

apps/web> npm run test
→ 9 tests, 3 suites, 0 failures (PASS in 166ms)

apps/web> npm run build
→ Compiled successfully in 2.5s, all 68 routes generated cleanly (PASS)
```

## 4. Behavior verified

1. **Owner password requirement (F-5 / RK-2):**
   - *Before:* Leaving owner password empty in the modal defaulted silently to `'password123'` on submit, creating accounts with a well-known credential.
   - *After:* Modal requires password (`minLength: 8`), placeholder is masked `••••••••••••`, frontend does not supply any default, and backend `TenantController::store` rejects requests with missing or empty owner password with 422 `VALIDATION_FAILED`.
   - *Verified by:* `PlatformTenantProvisioningSecurityTest::test_creating_tenant_without_password_is_rejected_with_422`, `test_creating_tenant_with_empty_password_is_rejected_with_422`, and `test_no_password123_default_exists_in_tenant_creation_code`.

2. **Tenant Type validation (OD-23):**
   - *Before:* `type` was a free-form string accepting arbitrary text (such as Arabic labels), with no server-side validation.
   - *After:* UI presents fixed OD-23 options (`individual_teacher`, `organization` + `organization_kind`). Backend enforces `Rule::in` on both `store` and `update`, rejecting invalid types with 422 `VALIDATION_FAILED`.
   - *Verified by:* `PlatformTenantProvisioningSecurityTest::test_creating_tenant_with_invalid_type_returns_422` and `test_updating_tenant_with_invalid_type_returns_422`.

3. **Domain submission & persistence:**
   - *Before:* The form gathered a `domain` input but discarded it before calling `platformApi.provisionTenant()`.
   - *After:* `domain` is passed in `ProvisionTenantPayload` and persisted in `tenant_domains` with `type = 'custom'` and `active = true`.
   - *Verified by:* `PlatformTenantProvisioningSecurityTest::test_creating_tenant_persists_custom_domain`.

4. **Real Owner Name:**
   - *Before:* Owner name was generated automatically as `"<Institution Name> Admin"`.
   - *After:* Real owner name input is required in the modal and submitted to the API.

## 5. Not done / limitations

- Tenant-type database column migration (converting legacy table values) is scheduled for **P1** per plan section 4. In PS-1, `organization_kind` is persisted in `brand_settings` until the dedicated column migration runs in P1.
- Invitation flow (sending email tokens instead of direct password setup) is an alternative mentioned in the plan; password requirement (min 8 chars) was implemented for immediate security hardening.

## 6. Discovered (new issues, not fixed)

- `apps/web/src/app/admin/users/new/page.tsx:274` contains an optional password input with label mention `(اختياري - افتراضي: password123)`. Left untouched to stay strictly within PS-1 scope per Operating Rules.

## 7. Decisions needed

- None. Work followed approved decisions OD-23 and plan section 4 (PS-1).

## 8. Docs updated

- [x] 03-PROGRESS-TRACKER.md (PS-1 marked DONE)
- [x] docs/project-management/risks.md (RK-2 marked CLOSED)
- [x] docs/project-management/changelog.md (added [PS-1] entry)
- [x] docs/backend/openapi.yaml (updated /tenants schema)
- [x] docs/recovery-reports/PS-1.md (this report)
