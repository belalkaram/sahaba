<?php

namespace App\Tenancy;

use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class TenantDatabaseManager
{
    /**
     * Configure and activate the tenant database connection.
     */
    public function configureConnection(Tenant $tenant): void
    {
        $identifier = $tenant->databaseConfig?->connection_identifier
            ?? 'tenant_'.$tenant->slug;

        $driver = config('database.connections.tenant.driver', 'sqlite');

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
        } else {
            config(['database.connections.tenant.database' => $identifier]);
        }

        DB::purge('tenant');
        DB::reconnect('tenant');
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
     * Run tenant migrations on the tenant database connection.
     */
    public function migrateTenant(Tenant $tenant, string $path = 'database/migrations/tenant'): int
    {
        $this->configureConnection($tenant);

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
        $identifier = $tenant->databaseConfig?->connection_identifier
            ?? 'tenant_'.$tenant->slug;

        $driver = config('database.connections.tenant.driver', 'sqlite');

        if ($driver === 'sqlite' && $identifier !== ':memory:') {
            $dir = $this->tenantsDirectory();

            return $dir.DIRECTORY_SEPARATOR.$identifier.'.sqlite';
        }

        return null;
    }

    /**
     * Delete the database file for the tenant if sqlite.
     */
    public function deleteDatabase(Tenant $tenant): void
    {
        $this->purgeConnection();
        $path = $this->getDatabasePath($tenant);
        if ($path && file_exists($path)) {
            @unlink($path);
        }
    }
}
