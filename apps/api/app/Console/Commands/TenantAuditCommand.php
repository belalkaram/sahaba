<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\TenantUser;
use App\Tenancy\TenantRunner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * M13 — Tenant Audit Command
 *
 * Reports on all tenants in the control plane:
 *   - Tenant slug, status, domain, DB name
 *   - Active user count, active subscription status
 *
 * Usage:
 *   php artisan lms:tenant-audit
 *   php artisan lms:tenant-audit --json
 */
class TenantAuditCommand extends Command
{
    protected $signature = 'lms:tenant-audit {--json : Output as JSON}';

    protected $description = 'Audit all tenants in the control plane registry';

    public function handle(): int
    {
        try {
            $tenants = DB::table('tenants')
                ->leftJoin('tenant_domains', 'tenants.id', '=', 'tenant_domains.tenant_id')
                ->leftJoin('tenant_databases', 'tenants.id', '=', 'tenant_databases.tenant_id')
                ->select(
                    'tenants.id',
                    'tenants.name',
                    'tenants.slug',
                    'tenants.status',
                    'tenant_domains.domain',
                    'tenant_databases.connection_identifier',
                    'tenants.created_at',
                )
                ->get();

            $records = $tenants->map(function ($t) {
                $userCount = 0;
                try {
                    $tenant = Tenant::with('databaseConfig')->find($t->id);
                    $userCount = $tenant
                        ? app(TenantRunner::class)->run($tenant, fn () => TenantUser::count())
                        : 0;
                } catch (Throwable) {
                    $userCount = -1; // unreachable
                }

                return [
                    'id' => $t->id,
                    'name' => $t->name,
                    'slug' => $t->slug,
                    'status' => $t->status,
                    'domain' => $t->domain ?? '—',
                    'database' => $t->connection_identifier ?? '—',
                    'users' => $userCount < 0 ? 'unreachable' : (string) $userCount,
                    'created_at' => $t->created_at,
                ];
            })->toArray();

            if ($this->option('json')) {
                $this->line(json_encode([
                    'timestamp' => now()->toIso8601String(),
                    'total' => count($records),
                    'tenants' => $records,
                ], JSON_PRETTY_PRINT));
            } else {
                $this->line('');
                $this->line('<fg=cyan;options=bold>  LMS Tenant Audit Report</>   '.now()->toIso8601String());
                $this->line('  Total tenants: <fg=yellow>'.count($records).'</>');
                $this->line('');
                $this->table(
                    ['ID', 'Name', 'Slug', 'Status', 'Domain', 'Database', 'Users', 'Created'],
                    array_map(fn ($r) => array_values($r), $records)
                );
            }

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error('Tenant audit failed: '.$e->getMessage());

            return self::FAILURE;
        }
    }
}
