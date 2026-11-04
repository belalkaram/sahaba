# ADR-001 — Unified Multi-Tenant Access Control & Identity Architecture

**Status:** Accepted
**Date:** 2026-10-30
**Related:** 
- Conceptual Problems: C-01, C-02, C-03, C-04, C-05, C-06
- Technical Findings: T-RBAC-01 through T-RBAC-13, T-SEC-02, T-SEC-08, T-SEC-09, T-QA-01
- Decisions: OD-1, OD-2, OD-7, OD-9
- Spec Sections: Master Specification §12, §26, §36, §61; FR-AUTH-*, FR-AUTHZ-*

---

## Context

The initial audit revealed fundamental architectural gaps in access control and identity:
1. **No Single Source of Truth for Permissions (C-01 / T-RBAC-01):** Permissions were created ad-hoc across seeders and tests. Controllers and routes checked permissions that didn't exist in the database, resulting in empty responses or unhandled 403s.
2. **Conflation of Role, Persona, and Staff Type (C-02):** "Teacher" was treated simultaneously as a role, a staff profile, and a route tree (`/teacher/*`). A teacher could not act as an assistant or finance reviewer without conflicting assumptions.
3. **Missing Resource Scopes (C-04 / T-SEC-08, T-SEC-09):** Authorization only checked binary boolean permissions (`user->hasPermissionTo('courses.update')`), with no tenant-wide vs. own-resource granularity. Any staff member with the permission could mutate any other staff member's resources.
4. **Missing Organization Module Enforcement (C-06 / T-RBAC-12):** Features (online courses, offline attendance, billing) had database toggles in `tenant_features`, but routes had no middleware checks.
5. **No Platform Identity Model (C-03 / T-SEC-02):** Platform administration lacked dedicated identity tables and sessions, relying on temporary workarounds.

---

## Decision

We establish a 4-tier sequential access decision model:
```text
1. Plane      : Platform Guard (Control DB) vs Tenant Guard (Tenant DB)
2. Module     : Is the feature module active for this tenant? (tenant_features)
3. Permission : Does the role grant this capability? (role_permission catalog)
4. Scope      : Over which resource boundary? (self < linked < own < assigned < branch < tenant)
```

### 1. Planes & Experiences
- **Platform Plane (`/platform/*`):** Guarded by `platform.auth` backed by `platform_users` and `platform_tokens` in the Control DB.
- **Support Sessions (`/t/{tenant}/...`):** Temporary scoped session initiated from the platform console via short-lived exchange codes, audited and revocable.
- **Tenant Admin Console (`/admin/*`):** For tenant executives and center administrators managing users, settings, and roles.
- **Staff Workspace (`/staff/*`):** Unified experience for teachers, assistants, branch managers, and finance reviewers. Navigation items dynamically render according to granted permissions and active modules.
- **Student Experience (`/student/*`):** Self-scoped portal for enrolled students.
- **Parent Experience (`/parent/*`):** Linked-scoped portal for guardians viewing their children.

### 2. Standard System Roles (OD-1)
Each tenant database automatically provisions 8 system roles (`is_system = true`):
1. `owner`: Full control over the tenant (`tenant` scope).
2. `center_admin`: Administrative manager of the educational center (`tenant` scope).
3. `branch_manager`: Manager of specific geographical branches (`branch` scope).
4. `teacher`: Instructor managing their own courses, lessons, and classes (`own` scope).
5. `assistant`: Teaching assistant supporting assigned classes/students (`assigned` scope).
6. `finance`: Billing reviewer approving payments and issuing entitlements (`tenant` scope on billing).
7. `student`: Enrolled learner (`self` scope).
8. `parent`: Guardian (`linked` scope to children).

Custom roles can be created by administrators from the permission catalog (`roles.manage`). System roles cannot be deleted.

### 3. Canonical Permission Catalog
A centralized configuration `apps/api/config/authorization.php` serves as the sole definition of permissions, their modules, Arabic labels, and permitted scopes. A CI integrity test (`PermissionCatalogIntegrityTest`) fails if any controller or route uses an uncataloged permission string.

### 4. Resource Scoping & Resolution
The `role_permission` pivot table stores the assigned `scope` (default `tenant`).
The `ScopeResolver` service evaluates resource access:
- `self`: Current user's own profile (`user_id = auth.id`).
- `linked`: Parent accessing linked children profiles.
- `own`: Staff accessing entities where `teacher_staff_id = staff.id`.
- `assigned`: Staff assigned to classes, courses, or students via `staff_assignments`.
- `branch`: Staff assigned to branches via `staff_branches`.
- `tenant`: Any resource within the tenant database.

### 5. Module Route Gates
Middleware `tenant.module:<key>` verifies tenant feature enablement (`Tenant::hasFeature`), failing closed with HTTP 403 `MODULE_DISABLED`.

### 6. Contract for `/auth/me` and `/auth/login`
Returns a unified payload:
- `user`: Identity details (id, name, email, phone, status).
- `persona`: Primary persona (`staff`, `student`, `parent`).
- `profiles`: Polymorphic profile IDs (`staff`, `student`, `parent`).
- `roles`: Assigned roles `[{ name, label }]`.
- `permissions`: Resolved map of `permission => highest_scope`.
- `tenant`: Tenant ID, slug, active modules, auth mode, branding.
- `experience`: Calculated UI experience (`admin`, `staff`, `student`, `parent`).

---

## Alternatives Considered

1. **Keep separate `/teacher` and `/assistant` experiences:** Rejected (OD-2). Leads to duplicate UI components, rigid roles, and prevents teachers from assisting or assistants from grading without separate accounts.
2. **Sanctum for Platform Auth:** Rejected (OD-9). Using a lightweight custom token model consistent with `TenantToken` maintains architecture purity without introducing stateful session complexity across separate databases.
3. **Direct ABAC engine without RBAC matrix:** Rejected. Pure ABAC increases policy complexity and is opaque to tenant admins; combining RBAC roles with query-level scoping achieves required granularity with clear admin configurability.

---

## Consequences

- **Database:** Added `scope` to `role_permission`; created `staff_assignments` and `staff_branches` in tenant DB; created `platform_users`, `platform_roles`, and `platform_tokens` in control DB.
- **Security:** Default-deny enforcement; no staff member can modify another staff member's course/lesson without explicit tenant/branch delegation.
- **Frontend:** Single source of truth for authorization (`useCan`, `PermissionGate`), dynamic staff sidebar navigation, and elimination of silent error swallowing.
- **Testing:** Comprehensive test suite for catalog integrity, role matrix validation, and cross-scope isolation.

---

## Implementation Tasks

- R1-A1: Architecture Decision Record (this document)
- R1-A2: Permission catalog definition & integrity test
- R1-A3: System roles synchronizer & database migrations
- R1-A4: Resource scope resolution & query scoping
- R1-A5: Module feature gates middleware
- R1-A6: `/auth/me` and `/auth/login` contract implementation
- R1-A7: Roles and permissions management API
- R1-A8: Scoped "My" resource endpoints
- R1-A9: Platform control plane identity & session management

