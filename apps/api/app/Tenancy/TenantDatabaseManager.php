<?php

namespace App\Tenancy;

use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Activates the per-tenant data store on the `tenant` connection.
 *
 * The control-plane database (tenants, platform users, ...) is the default connection. Each tenant's
 * own data lives in an isolated store whose shape depends on the driver, and the choice is made by
 * configuration only, never by application code (see ADR-002):
 *
 *  - sqlite : one file per tenant (local development and the automated test-suite)
 *  - pgsql  : one Postgres SCHEMA per tenant, in the same database as the control plane. Works on
 *             any Postgres provider (Neon, RDS, Supabase, self-hosted) because it needs no
 *             CREATE DATABASE privilege and no provider API.
 *  - other  : legacy "one database per tenant" (database name = connection_identifier)
 */
class TenantDatabaseManager
{
    /**
     * Configure and activate the tenant database connection.
     */
    public function configureConnection(Tenant $tenant): void
    {
        $identifier = $this->identifierFor($tenant);
        $driver = $this->driver();

        if ($driver === 'sqlite') {
            if ($identifier === ':memory:') {
                $dbPath = ':memory:';
            } else {
                $dir = $this->tenantsDirectory();
                if (! is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                $dbPath = $dir.DIRECTORY_SEPARATOR.$identifier.'.sqlite';
                if (! file_exists($dbPath)) {
                    touch($dbPath);
                }
            }
            config(['database.connections.tenant.database' => $dbPath]);
        } elseif ($driver === 'pgsql') {
            // Only the tenant's schema is on the search path: tenant queries can never fall back to
            // (or leak into) the control-plane tables in `public`.
            config(['database.connections.tenant.search_path' => $this->schemaName($identifier)]);
        } else {
            config(['database.connections.tenant.database' => $identifier]);
        }

        DB::purge('tenant');
        DB::reconnect('tenant');
    }

    /**
     * Postgres schema that holds a tenant's tables. Deterministic and injective: two different
     * identifiers can never share a schema (that would be a cross-tenant leak).
     */
    public function schemaName(string $identifier): string
    {
        $safe = preg_replace('/[^a-z0-9_]/', '_', strtolower($identifier));

        if ($safe !== $identifier) {
            // Characters were rewritten (for example "-" in a slug): disambiguate with a hash of the original.
            $safe = substr($safe, 0, 54).'_'.substr(sha1($identifier), 0, 8);
        }

        if ($safe === '' || strlen($safe) > 63) {
            throw new RuntimeException("Tenant identifier '{$identifier}' cannot be mapped to a valid Postgres schema name.");
        }

        return $safe;
    }

    /**
     * The tenant's Postgres schema name, or null when the tenant driver is not pgsql.
     */
    public function getSchemaName(Tenant $tenant): ?string
    {
        return $this->driver() === 'pgsql' ? $this->schemaName($this->identifierFor($tenant)) : null;
    }

    /**
     * Where SQLite tenant databases live. Tests point this at a throwaway folder (phpunit.xml).
     */
    private function tenantsDirectory(): string
    {
        $configured = (string) config('database.tenants_path', '');

        return $configured !== '' ? base_path($configured) : database_path('tenants');
    }

    /**
     * Create the tenant's isolated store when the driver needs it to exist before migrating.
     */
    public function ensureStorage(Tenant $tenant): void
    {
        $this->configureConnection($tenant);

        if ($this->driver() === 'pgsql') {
            $schema = $this->schemaName($this->identifierFor($tenant));
            DB::connection('tenant')->statement('CREATE SCHEMA IF NOT EXISTS "'.$schema.'"');
        }
    }

    /**
     * Run tenant migrations on the tenant database connection.
     */
    public function migrateTenant(Tenant $tenant, string $path = 'database/migrations/tenant'): int
    {
        $this->ensureStorage($tenant);

        if ($this->canCloneFromTemplate($tenant, $path)) {
            $this->cloneFromTemplate($this->schemaName($this->identifierFor($tenant)));

            return 0;
        }

        return $this->runMigrations($path);
    }

    private function runMigrations(string $path): int
    {
        return Artisan::call('migrate', [
            '--database' => 'tenant',
            '--path' => $path,
            '--force' => true,
        ]);
    }

    /**
     * Schema that holds the pre-migrated tenant structure. It starts with "_" so it can never collide
     * with a tenant schema (those are always "tenant_<slug>" or a hashed variant).
     */
    public const TEMPLATE_SCHEMA = '_tenant_template';

    /**
     * Bring the template schema up to date with database/migrations/tenant. This is the slow, one-time
     * path (every migration statement is a network round trip on a remote database); run it ahead of
     * time with `php artisan tenants:refresh-template`. Returns the number of migrations applied.
     */
    public function refreshTemplate(): int
    {
        if ($this->driver() !== 'pgsql') {
            return 0;
        }

        $conn = DB::connection('tenant');
        // One builder at a time: concurrent first registrations must not both migrate the template.
        // Held on the control connection because the tenant connection is re-opened while building.
        $lock = DB::connection();
        $lock->statement('select pg_advisory_lock(727001)');

        try {
            $conn->statement('CREATE SCHEMA IF NOT EXISTS "'.self::TEMPLATE_SCHEMA.'"');
            $before = $this->templateMigrationCount();
            config(['database.connections.tenant.search_path' => self::TEMPLATE_SCHEMA]);
            DB::purge('tenant');
            DB::reconnect('tenant');
            $this->runMigrations('database/migrations/tenant');

            return $this->templateMigrationCount() - $before;
        } finally {
            DB::purge('tenant');
            DB::reconnect('tenant');
            $lock->statement('select pg_advisory_unlock(727001)');
        }
    }

    private function templateMigrationCount(): int
    {
        $conn = DB::connection('tenant');
        $exists = $conn->selectOne(
            'select 1 as x from pg_tables where schemaname = ? and tablename = ?',
            [self::TEMPLATE_SCHEMA, 'migrations']
        );

        return $exists ? (int) $conn->selectOne('select count(*) c from "'.self::TEMPLATE_SCHEMA.'".migrations')->c : 0;
    }

    /**
     * Cloning is used only for a brand-new, empty tenant schema on pgsql with the default migration path,
     * so upgrading existing tenants (MigrateTenants) still goes through the normal incremental migrate.
     */
    private function canCloneFromTemplate(Tenant $tenant, string $path): bool
    {
        if ($this->driver() !== 'pgsql' || $path !== 'database/migrations/tenant' || ! config('database.tenant_template', true)) {
            return false;
        }

        $conn = DB::connection('tenant');
        $schema = $this->schemaName($this->identifierFor($tenant));
        $tables = (int) $conn->selectOne('select count(*) c from pg_tables where schemaname = ?', [$schema])->c;
        if ($tables > 0) {
            return false;
        }

        $files = count(glob(base_path('database/migrations/tenant').'/*.php') ?: []);
        if ($this->templateMigrationCount() < $files) {
            $this->refreshTemplate();
            // refreshTemplate re-pointed the connection; restore this tenant's search_path.
            $this->configureConnection($tenant);
        }

        return $this->templateMigrationCount() >= $files;
    }

    /**
     * Copy the template's tables, indexes, defaults, sequences, foreign keys and migration history into a
     * new schema in ONE statement (server side, atomic), instead of replaying every migration.
     */
    private function cloneFromTemplate(string $dst): void
    {
        $conn = DB::connection('tenant');
        $pdo = $conn->getPdo();
        $src = $pdo->quote(self::TEMPLATE_SCHEMA);
        $dstLit = $pdo->quote($dst);

        $conn->unprepared(<<<SQL
DO \$clone\$
DECLARE
  r record;
  src text := {$src};
  dst text := {$dstLit};
  seq text;
BEGIN
  -- Qualify every object reference (pg_get_constraintdef) regardless of the session search_path.
  PERFORM set_config('search_path', 'pg_catalog', true);

  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = src LOOP
    EXECUTE format('CREATE TABLE %I.%I (LIKE %I.%I INCLUDING ALL)', dst, r.tablename, src, r.tablename);
  END LOOP;

  -- Serial columns: LIKE copied a default that points at the template's sequence; give each tenant its own.
  FOR r IN
    SELECT table_name AS t, column_name AS c FROM information_schema.columns
    WHERE table_schema = dst AND column_default LIKE 'nextval(%'
  LOOP
    seq := r.t || '_' || r.c || '_seq';
    EXECUTE format('CREATE SEQUENCE %I.%I OWNED BY %I.%I.%I', dst, seq, dst, r.t, r.c);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT nextval(%L)', dst, r.t, r.c, quote_ident(dst) || '.' || quote_ident(seq));
  END LOOP;

  -- Foreign keys are not copied by LIKE: recreate them against the new schema.
  FOR r IN
    SELECT cl.relname AS t, con.conname AS n, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE ns.nspname = src AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', dst, r.t, r.n,
      replace(r.def, 'REFERENCES ' || quote_ident(src) || '.', 'REFERENCES ' || quote_ident(dst) || '.'));
  END LOOP;

  EXECUTE format('INSERT INTO %I.migrations (migration, batch) SELECT migration, batch FROM %I.migrations ORDER BY id', dst, src);
END
\$clone\$
SQL);
    }

    /**
     * Disconnect and purge tenant database connection.
     */
    public function purgeConnection(): void
    {
        DB::purge('tenant');
    }

    /**
     * Get the file path for the tenant's database if sqlite.
     */
    public function getDatabasePath(Tenant $tenant): ?string
    {
        $identifier = $this->identifierFor($tenant);

        if ($this->driver() === 'sqlite' && $identifier !== ':memory:') {
            return $this->tenantsDirectory().DIRECTORY_SEPARATOR.$identifier.'.sqlite';
        }

        return null;
    }

    /**
     * Delete the tenant's data store (sqlite file or Postgres schema).
     */
    public function deleteDatabase(Tenant $tenant): void
    {
        $this->purgeConnection();

        if ($this->driver() === 'pgsql') {
            $this->dropSchema($this->schemaName($this->identifierFor($tenant)));
            $this->purgeConnection();

            return;
        }

        $path = $this->getDatabasePath($tenant);
        if ($path && file_exists($path)) {
            @unlink($path);
        }
    }

    /**
     * Drop a tenant schema table by table. A single DROP SCHEMA ... CASCADE takes one lock per object
     * in one transaction and fails with "out of shared memory" (max_locks_per_transaction) once a
     * schema has a few dozen tables - which every tenant does.
     */
    private function dropSchema(string $schema): void
    {
        $db = DB::connection('tenant');

        $tables = $db->select(
            'select tablename from pg_tables where schemaname = ?',
            [$schema]
        );
        foreach ($tables as $table) {
            $db->statement('DROP TABLE IF EXISTS "'.$schema.'"."'.$table->tablename.'" CASCADE');
        }

        $db->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
    }

    /**
     * Approximate size in bytes of the tenant's data store, or null when it cannot be measured.
     */
    public function storageBytes(Tenant $tenant): ?int
    {
        if ($this->driver() === 'pgsql') {
            $schema = $this->schemaName($this->identifierFor($tenant));
            $row = DB::connection('tenant')->selectOne(
                'select coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint as bytes
                   from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = ? and c.relkind = \'r\'',
                [$schema]
            );

            return (int) $row->bytes;
        }

        $path = $this->getDatabasePath($tenant);

        return $path && file_exists($path) ? filesize($path) : null;
    }

    private function identifierFor(Tenant $tenant): string
    {
        return $tenant->databaseConfig?->connection_identifier ?? 'tenant_'.$tenant->slug;
    }

    private function driver(): string
    {
        return (string) config('database.connections.tenant.driver', 'sqlite');
    }
}
