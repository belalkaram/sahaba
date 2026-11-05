# Database Setup & Portability (PostgreSQL — Neon now, any provider later)

Decision record: `docs/decisions/ADR-002-postgres-schema-per-tenant-and-provider-portability.md`

## 1. Model

| Layer | Where | How it is selected |
|---|---|---|
| Control plane (tenants, domains, platform users/tokens, audit logs, support access, settings, queue/cache/session tables) | Postgres schema `public` | default connection (`DB_CONNECTION=pgsql`, `DB_URL`) |
| Tenant data (users, students, courses, attendance, billing, exams, ...) | one Postgres schema per tenant: `tenant_<slug>` | `tenant` connection; `search_path` = that schema only |

Tenant context is resolved first (`TenantResolutionMiddleware`) and only then is the `tenant` connection pointed at the schema. No tenant context → no tenant data.

## 2. Configuration (the only thing that changes between providers)

`apps/api/.env`:

```dotenv
DB_CONNECTION=pgsql
DB_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require   # DIRECT (non-pooled) endpoint
DB_SSLMODE=require
# DB_TENANT_URL=...   # optional, defaults to DB_URL
```

Neon: Console → project → **Connect** → untick *Connection pooling* → copy the string. Pooled endpoints (`-pooler` host) must not be used for the app: `search_path` and the advisory locks taken by `artisan migrate` are session features.

`neon deploy` writes the Neon variables into `.env.local`/`.env`; map the direct connection string to `DB_URL`.

## 3. First-time setup on a new database

```bash
cd apps/api
php artisan migrate --force          # control plane
php artisan lms:migrate-tenants      # creates/updates every tenant schema
php artisan lms:db:check             # must exit 0
```

New tenants are created through the platform console/API (`TenantProvisioningService`): it creates the schema, runs the tenant migrations and seeds roles.

## 4. Moving the existing SQLite data into Postgres (once)

```bash
cd apps/api
# Set DB_CONNECTION=pgsql + DB_URL first. Source files are read-only.
php artisan lms:db:copy-from-sqlite --dry-run
php artisan lms:db:copy-from-sqlite \
    --central=database/database.sqlite --tenants-dir=database/tenants
php artisan lms:db:check
```

- Reports `source rows -> target rows` per table; exits non-zero on any mismatch or on a source table that has no target table.
- `--truncate` makes the copy re-runnable.
- Sequences of `id()` columns are reset after copy.

## 5. Switching to another provider (Neon → anything)

1. Create the new Postgres database/role (needs `CREATE` on the database).
2. Dump from the old one:
   ```bash
   pg_dump --format=custom --no-owner --no-privileges "$OLD_DB_URL" > lms.dump
   ```
3. Restore into the new one:
   ```bash
   pg_restore --no-owner --no-privileges --dbname="$NEW_DB_URL" lms.dump
   ```
4. Put the new string in `DB_URL` (and `DB_TENANT_URL` if used), restart api/worker/scheduler.
5. `php artisan lms:db:check` → must exit 0. No code change is involved.

Alternative without a dump: run section 3 on the empty target and replay data with your own ETL. The dump route is the supported one (it carries the control plane and all tenant schemas in one consistent snapshot).

Back to SQLite (offline development): set `DB_CONNECTION=sqlite`, `DB_DATABASE=database/database.sqlite`, remove `DB_URL`.

## 6. Backup & restore

| Scope | Tool |
|---|---|
| Whole system (control plane + all tenants), nightly | `infrastructure/scripts/backup.sh` / `restore.sh` (`pg_dump`/`pg_restore`, AES-256 encrypted) |
| One tenant | `TenantBackupService` (`pg_dump --schema=tenant_x`; restore drops and recreates only that schema) |
| Point-in-time | provider feature (Neon branching/PITR) — complements, does not replace, the dumps |

## 7. Operating limits to know

- Dropping a tenant is done table by table (a single `DROP SCHEMA ... CASCADE` exhausts `max_locks_per_transaction`).
- The runtime role needs `CREATE` on the database.
- Thousands of tenants in one database slow catalog operations (see ADR-002 for the exit path).
- Neon computes scale to zero: the first request after idle pays a cold start; keep health checks tolerant.

## 8. Running the test-suite

Default (fast, SQLite): `php artisan test`.
On Postgres (use a disposable database — the suite drops every `tenant_*`/`test_*` schema):

```bash
DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=lms_test \
DB_USERNAME=lms DB_PASSWORD=lms DB_SSLMODE=disable php artisan test
```
