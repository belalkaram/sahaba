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

        return Artisan::call('migrate', [
            '--database' => 'tenant',
            '--path' => $path,
            '--force' => true,
        ]);
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
