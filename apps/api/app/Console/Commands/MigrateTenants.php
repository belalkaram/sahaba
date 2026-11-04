<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Console\Command;
use Throwable;

/**
 * Applies pending tenant migrations to every tenant database. Run on each deploy, after
 * `php artisan migrate` (which only covers the Control DB).
 */
class MigrateTenants extends Command
{
    protected $signature = 'lms:migrate-tenants';

    protected $description = 'Run pending tenant migrations on all tenant databases';

    public function handle(TenantDatabaseManager $databases): int
    {
        $failed = 0;

        foreach (Tenant::with('databaseConfig')->get() as $tenant) {
            try {
                $databases->migrateTenant($tenant);
                $this->info("Migrated {$tenant->slug}");
            } catch (Throwable $e) {
                $failed++;
                $this->error("Failed {$tenant->slug}: {$e->getMessage()}");
            }
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
