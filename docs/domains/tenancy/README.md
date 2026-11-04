# Tenancy Domain Specification

## 1. Purpose & Architectural Overview

The **Tenancy Domain** is the core boundary separating platform management (Control Plane) from tenant-specific operations (Data Plane).

Targeting individual teachers and educational centers in the Gulf/Saudi market, each tenant operates in an isolated environment preserving data ownership, privacy, and custom configurations.

### Architectural Model: Control DB + Tenant DB

```text
                     CONTROL PLANE
                          │
                   Control Database
                   (tenants, domains,
                    databases, features)
                          │
           ┌──────────────┼───────────────┐
           ▼              ▼               ▼
       Tenant A       Tenant B        Tenant C
        Database       Database        Database
```

---

## 2. Invariants & Security Boundaries

| Invariant ID | Rule | Implementation Enforcement |
|---|---|---|
| **SEC-INV-001** | No unauthorized cross-tenant access | Dynamic connection switching + Tenant DB separation |
| **SEC-INV-010** | Tenant context must exist before tenant data access | `TenantResolutionMiddleware` + `TenantContext` |
| **TEN-INV-001** | Client-supplied tenant IDs are untrusted | Server-side resolution via Host/Domain mapping or authenticated session |
| **TEN-INV-002** | Inactive or suspended tenants cannot process requests | `TenantResolver` validates `status === 'active'` before activating context |

---

## 3. Control Plane Domain Model

### Entities
1. **Tenant (`App\Models\Tenant`)**:
   - `id`: UUID (Primary Key)
   - `type`: `individual_teacher` | `educational_center`
   - `status`: `active` | `suspended` | `provisioning` | `archived`
   - `name`: Human-readable name (Arabic/English)
   - `slug`: Unique URL-friendly slug
2. **TenantDomain (`App\Models\TenantDomain`)**:
   - `id`: UUID
   - `tenant_id`: FK to `tenants`
   - `domain`: Subdomain (e.g., `teacher-ahmed.platform.local`) or custom domain (e.g., `academy.riyadh.sa`)
   - `type`: `subdomain` | `custom`
   - `active`: Boolean
3. **TenantDatabase (`App\Models\TenantDatabase`)**:
   - `id`: UUID
   - `tenant_id`: FK to `tenants`
   - `connection_identifier`: Database name or SQLite file path
   - `status`: `ready` | `provisioning` | `migrating` | `offline`
4. **TenantFeature (`App\Models\TenantFeature`)**:
   - `id`: UUID
   - `tenant_id`: FK to `tenants`
   - `feature_key`: e.g. `online_exams`, `google_meet`, `whatsapp_notifications`
   - `enabled`: Boolean

---

## 4. Tenant Context & Resolution Lifecycle

1. **Incoming Request**: Captured by `TenantResolutionMiddleware`.
2. **Resolution Phase (`TenantResolver`)**:
   - Matches registered host in `tenant_domains`.
   - Falls back to subdomain matching from host (e.g., `slug.domain.com`).
   - Supports `X-Tenant-Slug` or `X-Tenant-ID` headers for mobile/API clients.
   - Throws `TenantNotFoundException` (HTTP 404) if not found.
   - Throws `TenantInactiveException` (HTTP 403) if status is not `active`.
3. **Activation Phase (`TenantContext` & `TenantDatabaseManager`)**:
   - Binds `Tenant` to `TenantContext` singleton.
   - Reconfigures the `'tenant'` dynamic connection to point to the tenant's database.
   - Attaches `tenant_id` and `tenant_slug` to logging context and response headers (`X-Tenant-ID`, `X-Tenant-Slug`).

---

## 5. Tenant Data Plane Base Model (`TenantModel`)

All tenant-scoped models extend `App\Models\TenantModel`:
- Automatically binds to connection `'tenant'`.
- Guarantees queries target the active tenant's isolated database.

---

## 6. Verification & The Tenant Gate

The **Tenant Gate** defined in Phase J §15 is fully verified by [TenantIsolationTest.php](../../../apps/api/tests/Feature/TenantIsolationTest.php):
- **Tenant A request → Tenant A data only.**
- **Tenant B request → Tenant B data only.**
- **Tenant A request for Tenant B resource → Denied (not found / null).**
