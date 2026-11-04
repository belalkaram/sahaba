<?php

namespace App\Console\Commands;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Tenant;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Console\Command;

/**
 * SyncRolesCommand (R1-A3)
 *
 * Synchronizes the canonical permission catalog and system roles
 * into tenant databases.
 *
 * Usage:
 *   php artisan lms:sync-roles
 *   php artisan lms:sync-roles --tenant=almustaqbal
 */
class SyncRolesCommand extends Command
{
    protected $signature = 'lms:sync-roles {--tenant= : Optional tenant slug or ID}';

    protected $description = 'Synchronize canonical permissions and standard system roles into tenant databases';

    public function handle(TenantDatabaseManager $dbManager, RoleSynchronizer $synchronizer): int
    {
        $tenantQuery = Tenant::query()->where('status', 'active');

        if ($slugOrId = $this->option('tenant')) {
            $tenantQuery->where(function ($q) use ($slugOrId) {
                $q->where('slug', $slugOrId)->orWhere('id', $slugOrId);
            });
        }

        $tenants = $tenantQuery->get();

        if ($tenants->isEmpty()) {
            $this->warn('No active tenants found matching criteria.');

            return self::SUCCESS;
        }

        $this->info("Starting role & permission synchronization for {$tenants->count()} tenant(s)...");

        foreach ($tenants as $tenant) {
            $this->line("→ Syncing tenant: <comment>{$tenant->name}</comment> (<info>{$tenant->slug}</info>)...");

            try {
                $dbManager->configureConnection($tenant);
                $result = $synchronizer->sync();

                $this->info("  ✓ Synced {$result['permissions']} permissions and {$result['roles']} system roles.");
            } catch (\Throwable $e) {
                $this->error("  ✗ Failed syncing tenant [{$tenant->slug}]: {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->info('Synchronization complete.');

        return self::SUCCESS;
    }
}
