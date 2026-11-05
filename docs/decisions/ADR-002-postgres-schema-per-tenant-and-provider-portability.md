# ADR-002 — PostgreSQL as the data engine, schema-per-tenant, provider-portable by configuration

**Status:** Accepted (implementation VERIFIED locally on Postgres 16; Neon deployment pending network access — see Open Decisions)
**Date:** 2026-11-05
**Related:** Master Specification (database-per-tenant model), AGENTS.md §7 (tenant context before tenant data access), ADR-001

---

## Context

Until now the data layer was:

- Control plane: one SQLite file (`database/database.sqlite`).
- Tenant data: one SQLite **file per tenant** (`database/tenants/<identifier>.sqlite`).
- `config/database.php` already carried a `pgsql` connection and `.env.example` said `pgsql`, but nothing had ever been run on Postgres; `infrastructure/` described a MySQL 8.4 stack (compose, backup, restore, runbook) that matched neither the code nor the config.

The owner is hosting PostgreSQL temporarily on **Neon** and will probably move again (another managed provider, or a self-hosted Postgres). Requirement: *the whole system runs on that database, and changing provider must be a configuration change, not a code change.*

## Problem

1. "Database per tenant" cannot be done portably on Postgres: `CREATE DATABASE` is not available on every provider, and on Neon it is a control-plane API call (provider lock-in).
2. SQLite hid real defects (type mismatches, unvalidated inputs) that Postgres rejects.
3. Operational tooling (backup, restore, compose, Docker image) targeted a different engine.

## Options

| # | Option | Isolation | Portable | Notes |
|---|--------|-----------|----------|-------|
| A | One Postgres **database** per tenant | strongest | **no** (provider API) | Needs per-provider provisioning code |
| B | **One schema per tenant** in one database | strong (separate namespaces, tenant-only `search_path`) | **yes** (plain SQL) | One endpoint, one backup |
| C | Shared tables + `tenant_id` column | weakest | yes | Rewrites every model/query: rejected (no silent redesign) |

## Decision

**Option B.** The control plane stays in schema `public`. Each tenant gets schema `tenant_<slug>` (name sanitised and made injective by `TenantDatabaseManager::schemaName`). The `tenant` connection sets `search_path` to **only** that schema, so tenant queries can never read control-plane tables or another tenant's tables, and a request without tenant context still fails closed.

SQLite remains supported (file per tenant) for local development and the fast test-suite. The driver is chosen only by `DB_CONNECTION` / `DB_TENANT_DRIVER`; no application code branches on the engine except `app/Tenancy/` (manager, backup service) — the single place that knows how a tenant store is created, dropped, measured and backed up.

Provider portability is delivered by:

- `DB_URL` (and optional `DB_TENANT_URL`): one connection string, any provider.
- `php artisan lms:db:check`: proves connectivity, migrations and every tenant schema after any switch.
- `php artisan lms:db:copy-from-sqlite`: one-way migration of legacy SQLite data.
- Standard `pg_dump` / `pg_restore` for Postgres → Postgres moves (`docs/infrastructure/DATABASE-PORTABILITY.md`).
- Backup/restore scripts and `TenantBackupService` use `pg_dump`/`pg_restore` only (no provider tooling).

### Neon-specific rule
Session state (`search_path`, advisory locks used by `migrate`) is not reliable behind a transaction-mode pooler. The app therefore uses the **direct** (non-pooled) endpoint. Pooling can be added later for the control-plane connection only.

## Consequences

Positive
- Switching provider = change `DB_URL`, restore a dump, run `lms:db:check`. No code change.
- One consistent backup/PITR/branch covers the control plane and all tenants.
- Postgres strictness already surfaced and fixed real bugs (see `docs/audit/2026-11-05-database-audit/README.md`).

Negative / risks
- Tenants share one database's resources (noisy neighbour); thousands of schemas slow catalog operations. Revisit (Option A or sharding) if tenant count grows beyond the low thousands.
- The runtime role needs `CREATE` on the database to provision tenants.
- Master Specification still says "database-per-tenant"; it should read "isolated store per tenant (file / schema / database depending on driver)".

## Migration notes
- Edited in place (no behavioural change on SQLite, correct types on Postgres): `audit_logs.actor_id` (uuid → string(64): platform actors are not UUIDs) and `notifications.notifiable_id` (bigint morph → uuid morph: tenant user ids are UUIDs).
- No table, column or feature was added or removed.
- Removed only `infrastructure/docker/mysql/my.cnf` (config for a MySQL service that no longer exists in compose).

## Open Decisions
- OD-DB-1: Final long-term database provider (Neon is temporary).
- OD-DB-2: Connection pooling for the control-plane connection once load requires it.
- OD-DB-3: Per-tenant restore on Postgres needs `pg_dump`/`pg_restore` on the API host (present in the Docker image).
