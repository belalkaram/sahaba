# ADR-004 — Platform-Managed Student Payments, Super Admin Review & Pricing Centralization

**Status:** Accepted
**Date:** 2026-11-05
**Related Decisions:** OD-27 (supersedes OD-7), OD-23, OD-24, OD-31, OD-32, OD-33
**Related Audit Findings:** F-16, F-17 (pricing page)
**Spec Sections:** Master Specification §13, §14; Plan `docs/plans/2026-11-05-platform-console-tenancy-venues-qr-plan.md` §2 (Q-1..Q-4), §3, §4 (P4)

---

## Context

Prior to this decision, the billing and payment review model had structural misalignments with the platform's operating business model:

1. **Decentralized Review (OD-7):** Payment review was previously handled internally within each tenant by `owner`, `center_admin`, or `finance` roles. This allowed individual teachers or center staff to approve payments directly at `/payment-requests/{id}/approve`.
2. **Monetization Architecture Mismatch (OD-27):** Public pricing displayed legacy multi-tiered school SaaS plans (Starter 499 SAR, Pro 1299 SAR, Enterprise), whereas the platform business model specifies that **teachers and organizations pay nothing (0 SAR)**. Revenue is derived entirely from a **10 SAR/month fee per active student** (configurable by the platform super administrator, never hard-coded).
3. **Receiving Accounts & Multi-Tenancy (OD-27 Q-2):** Depending on the agreement, payment transfers may be received either into the platform's central bank account or the teacher's bank account. In both models, the review and approval authority must rest exclusively with the **platform super administrator**, ensuring strict governance before subscription and course access are granted.
4. **Tenant Staff Role Misplacement:** Teachers and educational staff should focus on curriculum and classroom management rather than conducting financial ledger approvals. However, teachers still require read-only visibility into their students' payment statuses to track active participation.

---

## Decision

We establish centralized platform payment management and supersede OD-7 in favor of OD-27:

### 1. Pricing Structure & Control DB Storage (OD-27, F-17)

1. **Platform Pricing Table (`platform_pricing` in Control DB):**
   - Centralizes the baseline monthly fee: `student_monthly_fee` (default 10.00 SAR), `currency` (SAR).
   - Stores payment instructions and receiving account credentials:
     - `receiving_account_type` (`platform` or `teacher`).
     - `bank_name`, `account_holder_name`, `iban`, `transfer_instructions`.
   - Supports optional per-tenant pricing overrides (`tenant_id` foreign key).
2. **Public Endpoint (`GET /public/pricing`):**
   - Returns public marketing pricing: teachers & centers 0 SAR, students 10 SAR/month.
   - Powers the public `/pricing` page, resolving audit finding F-17.
3. **Tenant Endpoint (`GET /billing/pricing`):**
   - Provides students and parents with the active monthly fee and bank transfer details (IBAN/InstaPay) when submitting payment proofs.

### 2. Tenant DB Payment Requests Model (R3-3, OD-27)

1. `payment_requests` in each Tenant DB represents a monthly fee payment for a student:
   - Added column `period_month` (string `YYYY-MM`, e.g., `2026-11`).
   - Retains proof file persistence (`proof_path`) stored in private storage.
   - Records reviewer metadata: `reviewed_by_platform_user_id`, `reviewed_by_platform_user_name`, and timestamp `reviewed_at`.
2. **Permission Boundary:**
   - Permissions `payments.approve` and `payments.reject` are removed from all default tenant roles (`owner`, `center_admin`, `finance`, `teacher`, `assistant`).
   - Tenant staff retain `payments.view` (read-only) to inspect student payment statuses in their dashboard.
   - Attempting to approve/reject from a tenant role returns HTTP 403 `FORBIDDEN`.

### 3. Centralized Platform Review Inbox (`/platform/payments`)

1. **Cross-Tenant Queue (`GET /platform/payments`):**
   - Platform super administrators can inspect all pending, approved, and rejected payments across all tenants.
   - Supports filtering by tenant (`tenant_id`), status (`pending`, `approved`, `rejected`), period (`period_month`), and student search.
2. **Secure Approval (`POST /platform/payments/{tenantId}/{paymentId}/approve`):**
   - Protected by `platform.auth` middleware; restricted to `platform_super_admin`.
   - Switches execution into the target tenant database via `TenantRunner::run($tenant, ...)`.
   - Activates `Subscription` for that specific calendar month (`period_month`), granting entitlements (`ONLINE_ACCESS`, `all_courses`, or package entitlements).
   - Idempotent: repeated approval calls return the processed state without duplicating subscriptions or entitlements.
   - Records review log in Control DB (`platform_payment_reviews`) and Tenant DB (`payment_review_logs`).
   - Emits centralized audit log (`AuditLogger::log('platform.payment.approved', ...)`).
   - Automatically dispatches notifications to both student and parents (`NotificationCatalog::PAYMENT_APPROVED`).
3. **Rejection (`POST /platform/payments/{tenantId}/{paymentId}/reject`):**
   - Requires a rejection reason (`reason`).
   - Updates status to `rejected`, records review logs in Control and Tenant DBs, and notifies student and parents with the reason.
4. **Secure Proof Access (`GET /platform/payments/{tenantId}/{paymentId}/proof`):**
   - Serves uploaded transfer receipts securely to authenticated platform super admins.

### 4. Architectural Invariants Enforced

- **Payment ≠ Subscription:** Submitting a transfer proof does not grant subscription status. Subscription is activated only upon explicit super admin approval.
- **Subscription ≠ Entitlement:** Entitlements are distinct capability tokens linked to subscription validity periods.
- **Tenant Isolation:** Centralized review executes strictly within tenant context boundaries via `TenantRunner`.
- **Auditability:** Every review action records who reviewed, when, for which tenant and student, and the exact amount and month.

---

## Consequences

### Positive
- Strict financial governance: tenant teachers cannot self-approve fictitious student payments.
- Transparent monetization: students pay 10 SAR/month with clear transfer instructions; teachers and centers onboard for free.
- Auditable review trail in Control DB across all tenants.
- Sibling / parent clarity: parents receive instant payment approvals/rejections via notifications.

### Negative / Trade-offs
- Super admin operational overhead: payment approvals require platform administrator intervention (until automated payment gateway integration).
- Cross-tenant queries require iterating or aggregating across tenant databases for metrics.
