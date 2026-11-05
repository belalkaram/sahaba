<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Provider-agnostic health check. Run it after changing DB_* settings (new provider, new host) to
 * prove the control plane and every tenant store are reachable and fully migrated.
 */
class DatabaseCheckCommand extends Command
{
    protected $signature = 'lms:db:check';

    protected $description = 'Verify the configured database: connectivity, migrations, and every tenant store';

    public function handle(TenantDatabaseManager $manager): int
    {
        $default = config('database.default');
        $failed = 0;

        try {
            $conn = DB::connection();
            $version = $conn->getDriverName() === 'pgsql'
                ? $conn->selectOne('select version() as v')->v
                : $conn->getDriverName();
            $this->components->info("Control plane [{$default}] reachable: {$version}");
            $pending = $this->pendingMigrations(database_path('migrations'), null);
            $this->line($pending === 0 ? '  migrations: up to date' : "  <error>migrations: {$pending} pending</error>");
            $failed += $pending === 0 ? 0 : 1;
        } catch (Throwable $e) {
            $this->error('Control plane unreachable: '.$e->getMessage());

            return self::FAILURE;
        }

        foreach (Tenant::with('databaseConfig')->orderBy('slug')->get() as $tenant) {
            try {
                $manager->configureConnection($tenant);
                $pending = $this->pendingMigrations(database_path('migrations/tenant'), 'tenant');
                $label = $manager->getSchemaName($tenant) ?? ($manager->getDatabasePath($tenant) ?? 'tenant');
                $this->line(sprintf('  tenant %-24s %-34s %s', $tenant->slug, $label, $pending === 0 ? 'ok' : "<error>{$pending} pending migration(s)</error>"));
                $failed += $pending === 0 ? 0 : 1;
            } catch (Throwable $e) {
                $this->line(sprintf('  tenant %-24s <error>unreachable</error> %s', $tenant->slug, strtok($e->getMessage(), "\n")));
                $failed++;
            }
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function pendingMigrations(string $path, ?string $connection): int
    {
        $migrator = app('migrator');
        $migrator->setConnection($connection);
        $repo = $migrator->getRepository();
        $repo->setSource($connection);

        $files = array_keys($migrator->getMigrationFiles($path));
        $ran = $repo->repositoryExists() ? $repo->getRan() : [];

        return count(array_diff($files, $ran));
    }
}
