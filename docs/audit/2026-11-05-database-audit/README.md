# Database Audit & Postgres Enablement — 2026-11-05

Scope: how data is stored today, whether every table is really used by backend and frontend, what was broken, what was fixed, and what is left. Everything below was measured on the current tree (no old versions). Decision record: `docs/decisions/ADR-002-postgres-schema-per-tenant-and-provider-portability.md`. Operating guide: `docs/infrastructure/DATABASE-PORTABILITY.md`.

Status vocabulary follows AGENTS.md §5.

## 1. What the project ran on before

| Item | Finding |
|---|---|
| Stack | Laravel 13 (`apps/api`) + Next.js 16 (`apps/web`). The web app has **no** database access: all data goes through the API. |
| Control plane | SQLite file `database/database.sqlite` |
| Tenant data | One SQLite file per tenant under `database/tenants/` |
| Config | `pgsql` connection existed but had never been run; `.env.example` said `pgsql`; `config/database.php` defaulted to `sqlite` |
| Infra | `infrastructure/` (compose, Dockerfile, backup, restore, runbook) described **MySQL 8.4** — matched neither code nor config. The Docker image had no `pdo_pgsql`. |

## 2. Table inventory and wiring (83 tables created by migrations)

Method: tables from `Schema::create` in migrations, mapped to Eloquent models (explicit `$table` or Laravel naming), then searched for use in controllers, services/jobs/commands, and raw `DB::table`. Frontend wiring: every `apiClient.*` call in `apps/web/src` compared with `php artisan route:list`.

Result: **no table is "fake"**. Every domain table has a model and is read/written by real controllers or services, and the frontend contains no mock data layer (the words mock/fake appear only in comments saying they were removed).

Tables with no direct controller/service use (kept; nothing was removed):

| Table | Reality | Verdict |
|---|---|---|
| `tenant_courses` | Used only by `TenantIsolationTest`; superseded by `courses` | Legacy — candidate for removal after owner decision |
| `report_definitions` | `ReportController` validates `report_definition_id` against it, but **no endpoint creates definitions** (only tests do) | Half-wired — decision needed: add CRUD or drop the column |
| `users` (central), `password_reset_tokens` | Laravel skeleton tables. Real identities are `tenant_users` and `platform_users`. `users` is still the target of an old FK chain in `support_access_logs` history | Legacy skeleton |
| `device_change_logs` | Written by `AccessCredential` (model method), read only in tests | Write-only audit trail |
| `cache`, `cache_locks`, `job_batches`, `jobs`, `failed_jobs`, `sessions`, pivots (`role_permission`, `user_roles`, `class_students`, `student_parent`, `platform_user_roles`) | Framework / pivot tables used through relations | OK |

Frontend ↔ backend (244 API routes, 211 distinct call sites):
- Frontend calls with no backend route: **0** (the 2 that looked missing, `/media${qs}` and `/meetings${qs}`, are query-string concatenations that do exist).
- Backend routes the UI never calls: ~35, mostly downloads/images opened as links, plus genuinely UI-less endpoints: `/me/classes|courses|sessions|students`, `/metrics*` (definition management), `GET /classrooms`, `POST /credentials/verify`, `/analytics/classes/{id}`, `/analytics/courses/{id}`, `POST /platform/support-sessions`. These are implemented backend features without a screen.

## 3. Defects found and fixed

SQLite is type-lax; Postgres is strict. Running the full suite on Postgres 16 exposed real bugs:

| # | Defect | Fix |
|---|---|---|
| 1 | `audit_logs.actor_id` was `uuid` but platform actors have integer ids / `admin` → every audited platform action (tenant create/update, settings, support) crashed with HTTP 500 on Postgres | column → `string(64)` (migration edited in place) |
| 2 | `notifications.notifiable_id` was a bigint morph but tenant users have UUID ids → all notifications crashed on Postgres | `uuidMorphs` |
| 3 | `GET /me/sessions?from=&to=` passed raw query text into a timestamp comparison (500 on malformed input; SQLite string-compared silently) | validated `date` rule + Carbon parse (422 on bad input) |
| 4 | `lms:tenant-audit` selected a non-existent column (`tenant_databases.database_name`), imported a non-existent class and counted a non-existent `users` table — the command could not have run | rewritten on `TenantRunner` / `TenantUser` |
| 5 | Tenant `DROP SCHEMA ... CASCADE` exhausts `max_locks_per_transaction` ("out of shared memory") with ~70 tables | drop table-by-table, then schema |
| 6 | Platform metrics measured storage only for SQLite files (`storage_bytes` was always null elsewhere) | `TenantDatabaseManager::storageBytes()` (SQLite file size / Postgres relation size) |
| 7 | Backup/restore service only understood SQLite files | `pg_dump`/`pg_restore` per tenant schema |
| 8 | `infrastructure/` targeted MySQL; Docker image lacked `pdo_pgsql`/`pg_dump`; `deploy.sh` ran only central migrations (never tenants) | compose, Dockerfile, backup/restore/deploy scripts, runbook moved to Postgres; deploy now runs `lms:migrate-tenants` and `lms:db:check` |
| 9 | `.env.example` copied by CI would have broken the e2e job once it points to Postgres | e2e job pins `DB_CONNECTION=sqlite`; new CI job runs the full suite on Postgres 16 |
| 10 | `composer.lock` pins `symfony/mime v8.1.10` (needs PHP ≥ 8.4.1) while `composer.json` allows PHP `^8.3` → `composer install` fails on PHP 8.3 | **not fixed** (see §5) |

## 4. Verification actually run (this session)

| Check | Result |
|---|---|
| Full PHPUnit suite, SQLite (default) | 200 / 200 passed, 2037 assertions |
| Full PHPUnit suite, PostgreSQL 16 (local) | 199 / 200 on the first complete run; the one failure (tenant restore) was fixed and `TenantBackupRestoreGateTest` re-run → 4 / 4 passed. A full Postgres re-run after that last edit was **not** repeated. |
| Migrations on empty Postgres | all central + tenant migrations apply |
| `lms:db:copy-from-sqlite` | seeded SQLite source (1 tenant) → Postgres: every table `source rows -> target rows ok`; re-run with `--truncate` ok |
| `lms:db:check` | exit 0 |
| Live HTTP on Postgres (`php artisan serve`) | `/health` healthy; tenant login, `/auth/me`, `/courses` read; `POST /branches` write landed in the tenant schema, no tenant table exists in `public`; unknown tenant → `TENANT_NOT_FOUND` |
| `apps/web` `npm ci && npm run build` | exit 0 |
| Neon (`neon login/deploy`, real Neon database) | **NOT VERIFIED** — the container's network policy blocks the Neon API and database hosts |

Status: Postgres support is **IMPLEMENTED and VERIFIED on a local Postgres 16**; the Neon deployment itself is **NOT VERIFIED**; the system is not PRODUCTION_READY (Recovery program rules still apply).

## 5. Known limitations / open items

1. Neon not exercised (network). Run `neon login`, `neon deploy`, set `DB_URL` to the **direct** connection string, run section 3 of the portability guide.
2. Tenant restore on Postgres drops the tenant schema before `pg_restore`; if the restore fails midway the tenant is empty until restored again (checksum is verified first; keep the dump).
3. `composer.lock` / PHP version mismatch (finding 10). CI uses PHP 8.3 — run `composer update symfony/mime symfony/mailer --with-all-dependencies` with PHP 8.3 platform, or raise the PHP requirement to 8.4. Needs owner decision. (Locally the install used `--ignore-platform-req=php`.)
4. Schema-per-tenant scale limit (thousands of tenants) — ADR-002.
5. Legacy/half-wired tables in §2 await owner decisions; none were removed.
6. `apps/api/CLAUDE.md` asks to install Laravel Boost first; not installed (it would modify `composer.json`/`composer.lock`, and the lock cannot be resolved on this PHP — finding 10).
7. Pre-existing Pint style violation in `CreatePlatformAdminCommand.php` (not touched).
8. `neon init` added `neon.ts`, root `package.json`/`package-lock.json` and a `.neon` ignore rule; `neon.ts` declares no services yet because nothing could be deployed.
9. Open decisions: OD-DB-1 (final provider), OD-DB-2 (pooling), OD-DB-3 (pg tools on API host).
