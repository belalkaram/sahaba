# ADR-002 — Tenant Types, Simplified Profiles & Service Bundling

**Status:** Accepted
**Date:** 2026-11-05
**Related Decisions:** OD-23, OD-24, OD-30, OD-31
**Related Audit Findings:** F-6 (Module toggles in platform console)
**Spec Sections:** Master Specification §12, §26; Plan `docs/plans/2026-11-05-platform-console-tenancy-venues-qr-plan.md` §2, §4 (P1)

---

## Context

Prior to this decision, the tenancy model had several limitations identified during the architecture audit:
1. **Unbounded Tenant Types:** Tenants were provisioned with unstructured strings (`school`, `center`, `tutor`, `academy`, `university` or arbitrary Arabic strings), without consistent semantics across the codebase.
2. **Conflated Organizational Needs (OD-24):** Independent teachers were forced into the same organizational hierarchy as large schools and academies. They were presented with `center_admin`, `branch_manager`, and "الفروع" (branches), causing confusion because an independent teacher rents or teaches across multiple external venues (OD-30) rather than owning multi-branch enterprises.
3. **No Service Specialization (OD-31):** Every tenant had all modules enabled by default. A teacher operating purely in physical halls had digital video courses and online meetings cluttering their experience; an online educator had physical attendance and venues cluttering theirs.
4. **Platform Module Management Missing (F-6):** Although `tenant_features` existed in the database, the platform console lacked any UI controls for super administrators to adjust tenant services and modules.

---

## Decision

We establish two distinct tenant archetypes and two service dimensions:

### 1. Tenant Archetypes (OD-23)

Every tenant has a canonical `type`:
- `individual_teacher`: An independent educator managing their own classes, students, and teaching assistants.
- `organization`: A full educational institution, qualified by an `organization_kind` ∈ {`center`, `academy`, `school`, `institute`}.

### 2. Tailored Experience & Role Profiles (OD-24)

Role provisioning and terminology are specialized per tenant archetype:

| Archetype | Visible System Roles | Hall/Venue Terminology | Management Tree |
|---|---|---|---|
| `individual_teacher` | `owner` (teacher), `assistant`, `student`, `parent` | «أماكن التدريس والقاعات» | Simplified; no branch manager or center admin |
| `organization` | `owner`, `center_admin`, `branch_manager`, `teacher`, `assistant`, `finance`, `student`, `parent` | «الفروع والقاعات» | Full enterprise hierarchy |

- Configuration is centralized in `config/tenant_profiles.php`.
- An independent teacher can be upgraded to an organization at any time (`POST /platform/tenants/{id}/convert-to-organization`) without loss of historical data, which provisions the remaining organizational roles (`center_admin`, `branch_manager`, `finance`).

### 3. Service Dimensions & Module Bundling (OD-31)

Tenants declare which services they operate:
- `online`: Digital learning (courses, video lessons, live meetings, media library, online assessments).
- `offline`: Physical presence (venues/halls, classes, sessions, QR attendance, assistants).
- `both`: Complete hybrid operations.

Module association:
- **Online Modules:** `courses`, `assessments`, `meetings`, `media`, `online`.
- **Offline Modules:** `attendance`, `classes`, `sessions`, `offline`, `credentials`.
- **Core Modules (Always Active):** `core`, `billing`, `analytics`.

### 4. Enforcement & Boundaries

1. **Backend Route Gating:** Routes continue to be guarded by `tenant.module:<key>` middleware. Requesting a disabled module route fails closed with HTTP 403 `MODULE_DISABLED`.
2. **Context Resolution:** Both `/auth/me` and `GET /tenant/current` expose `tenant.type`, `tenant.organization_kind`, and active `tenant.services`.
3. **Frontend Navigation:** `navigation-registry.ts` filters items based on active `services` and `modules`, dynamically adjusting labels (e.g. «أماكن التدريس» vs «الفروع»).
4. **Platform Console Controls:** Super administrators can inspect and toggle modules and services for any tenant via `PUT /platform/tenants/{id}/modules` (resolving F-6).

---

## Consequences

### Positive
- Independent teachers get an uncluttered, intuitive workspace with terminology matching reality.
- Educational institutions retain enterprise structure and multi-branch management.
- Eliminates cognitive overhead for offline-only and online-only educators.
- Seamless upgrade path from solo teacher to expanding academy.

### Negative / Trade-offs
- Navigation registry requires dynamic label evaluation based on tenant archetype.
- Platform console and registration forms must validate archetype and service combinations.
