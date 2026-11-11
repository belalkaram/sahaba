<?php

namespace App\Console\Commands;

use App\Tenancy\TenantDatabaseManager;
use Illuminate\Console\Command;

/**
 * Pre-builds the Postgres template schema that new tenants are cloned from, so registering a school
 * takes seconds instead of replaying every tenant migration over the network. Run it on deploy,
 * after adding a tenant migration.
 */
class RefreshTenantTemplate extends Command
{
    protected $signature = 'tenants:refresh-template';

    protected $description = 'Build/update the tenant template schema used to provision new tenants quickly (pgsql only)';

    public function handle(TenantDatabaseManager $manager): int
    {
        $applied = $manager->refreshTemplate();
        $this->info("Tenant template is up to date ({$applied} migration(s) applied).");

        return self::SUCCESS;
    }
}
