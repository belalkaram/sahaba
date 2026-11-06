<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * One-way data move from the legacy SQLite layout (central file + one file per tenant) into the
 * configured Postgres (control plane in `public`, one schema per tenant). Idempotent with --truncate.
 *
 * Moving between two Postgres providers does not need this command: use pg_dump/pg_restore or
 * the provider's branching (see docs/infrastructure/DATABASE-PORTABILITY.md).
 */
class CopySqliteToPostgres extends Command
{
    protected $signature = 'lms:db:copy-from-sqlite
        {--central= : Path to the central SQLite file (default: database/database.sqlite)}
        {--tenants-dir= : Directory with the per-tenant SQLite files (default: database/tenants)}
        {--truncate : Empty each target table before copying (re-runnable)}
        {--dry-run : Only report what would be copied}';

    protected $description = 'Copy the legacy SQLite data (central + tenants) into the configured Postgres database';

    private const CHUNK = 500;

    private int $failures = 0;

    public function handle(TenantDatabaseManager $manager): int
    {
        if (config('database.connections.'.config('database.default').'.driver') !== 'pgsql'
            || config('database.connections.tenant.driver') !== 'pgsql') {
            $this->error('Target must be Postgres: set DB_CONNECTION=pgsql (and leave DB_TENANT_DRIVER unset).');

            return self::FAILURE;
        }

        $central = $this->option('central') ?: database_path('database.sqlite');
        $tenantsDir = $this->option('tenants-dir') ?: database_path('tenants');

        if (! is_file($central)) {
            $this->error("Central SQLite file not found: {$central}");

            return self::FAILURE;
        }

        $dry = (bool) $this->option('dry-run');

        if (! $dry) {
            $this->call('migrate', ['--force' => true]);
        }

        $this->components->info('Control plane');
        $centralSource = $this->sqliteConnection('lms_src_central', $central);
        $this->copyDatabase($centralSource, config('database.default'), $dry);

        foreach ($this->sourceTenants($centralSource) as $tenant) {
            $identifier = $tenant->databaseConfig?->connection_identifier ?? 'tenant_'.$tenant->slug;
            $file = rtrim($tenantsDir, '/\\').DIRECTORY_SEPARATOR.$identifier.'.sqlite';
            $this->components->info("Tenant {$tenant->slug} ({$manager->schemaName($identifier)})");

            if (! is_file($file)) {
                $this->warn("  no SQLite file at {$file} - skipped");
                $this->failures++;

                continue;
            }

            if (! $dry) {
                $manager->migrateTenant($tenant);
            } else {
                $manager->configureConnection($tenant);
            }
            $this->copyDatabase($this->sqliteConnection('lms_src_tenant', $file), 'tenant', $dry);
        }

        $this->line($this->failures === 0 ? '<info>Done: every table copied and counts match.</info>' : "<error>Finished with {$this->failures} problem(s).</error>");

        return $this->failures === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * Tenants as recorded in the SOURCE control plane (the target may still be empty, e.g. on --dry-run).
     *
     * @return list<Tenant>
     */
    private function sourceTenants(string $source): array
    {
        $databases = DB::connection($source)->table('tenant_databases')->get()->keyBy('tenant_id');

        return DB::connection($source)->table('tenants')->orderBy('slug')->get()->map(function ($row) use ($databases) {
            $tenant = (new Tenant)->forceFill((array) $row);
            $db = $databases->get($row->id);
            $tenant->setRelation('databaseConfig', $db ? (new TenantDatabase)->forceFill((array) $db) : null);

            return $tenant;
        })->all();
    }

    private function sqliteConnection(string $name, string $path): string
    {
        config(["database.connections.{$name}" => [
            'driver' => 'sqlite', 'database' => $path, 'prefix' => '', 'foreign_key_constraints' => false,
        ]]);
        DB::purge($name);

        return $name;
    }

    private function copyDatabase(string $src, string $dst, bool $dry): void
    {
        $srcTables = array_column(Schema::connection($src)->getTables(), 'name');
        $dstTables = array_column(Schema::connection($dst)->getTables(), 'name');
        $skip = ['migrations'];

        foreach (array_diff($srcTables, $dstTables, $skip, ['sqlite_sequence']) as $orphan) {
            $this->warn("  source table '{$orphan}' has no target table - NOT copied");
            $this->failures++;
        }

        $tables = array_values(array_diff(array_intersect($dstTables, $srcTables), $skip));

        foreach ($this->dependencyOrder($dst, $tables) as $table) {
            $count = DB::connection($src)->table($table)->count();

            if ($dry) {
                $this->line(sprintf('  %-34s %d row(s) would be copied', $table, $count));

                continue;
            }

            try {
                $this->copyTable($src, $dst, $table);
                $copied = DB::connection($dst)->table($table)->count();
                $ok = $copied === $count;
                $this->line(sprintf('  %-34s %d -> %d %s', $table, $count, $copied, $ok ? 'ok' : '<error>MISMATCH</error>'));
                $this->failures += $ok ? 0 : 1;
            } catch (Throwable $e) {
                $this->line(sprintf('  %-34s <error>FAILED</error> %s', $table, strtok($e->getMessage(), "\n")));
                $this->failures++;
            }
        }
    }

    private function copyTable(string $src, string $dst, string $table): void
    {
        $target = DB::connection($dst);
        $columns = collect(Schema::connection($dst)->getColumns($table))->keyBy('name');

        if ($this->option('truncate')) {
            $target->statement('TRUNCATE TABLE "'.$table.'" CASCADE');
        }

        $query = DB::connection($src)->table($table);
        $buffer = [];

        foreach ($query->cursor() as $row) {
            $row = (array) $row;
            foreach ($row as $name => $value) {
                $row[$name] = $this->castValue($value, $columns[$name]['type_name'] ?? '');
            }
            // Columns that only exist in the source are dropped; columns only in the target keep defaults.
            $buffer[] = array_intersect_key($row, $columns->all());

            if (count($buffer) >= self::CHUNK) {
                $target->table($table)->insert($buffer);
                $buffer = [];
            }
        }
        if ($buffer) {
            $target->table($table)->insert($buffer);
        }

        $this->resetSequence($target, $table, $columns);
    }

    private function castValue(mixed $value, string $type): mixed
    {
        if ($value === null) {
            return null;
        }

        return match ($type) {
            'bool', 'boolean' => (bool) $value,
            default => $value,
        };
    }

    private function resetSequence($target, string $table, $columns): void
    {
        foreach ($columns as $name => $col) {
            if (! empty($col['auto_increment'])) {
                $target->statement(
                    "select setval(pg_get_serial_sequence('\"{$table}\"', '{$name}'), coalesce((select max(\"{$name}\") from \"{$table}\"), 1), (select max(\"{$name}\") is not null from \"{$table}\"))"
                );
            }
        }
    }

    /**
     * Parents before children, using the target's foreign keys.
     *
     * @param  list<string>  $tables
     * @return list<string>
     */
    private function dependencyOrder(string $dst, array $tables): array
    {
        $deps = [];
        foreach ($tables as $t) {
            $deps[$t] = [];
            foreach (Schema::connection($dst)->getForeignKeys($t) as $fk) {
                if ($fk['foreign_table'] !== $t && in_array($fk['foreign_table'], $tables, true)) {
                    $deps[$t][] = $fk['foreign_table'];
                }
            }
        }

        $ordered = [];
        while ($deps) {
            $ready = array_keys(array_filter($deps, fn ($d) => ! array_diff($d, $ordered)));
            if (! $ready) {
                $ready = [array_key_first($deps)]; // cycle: let the database report it
            }
            foreach ($ready as $t) {
                $ordered[] = $t;
                unset($deps[$t]);
            }
        }

        return $ordered;
    }
}
