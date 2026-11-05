<?php

namespace App\Domain\Platform;

use App\Models\AuditLog;
use App\Models\Course;
use App\Models\Staff;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantMetricSnapshot;
use App\Tenancy\TenantDatabaseManager;
use App\Tenancy\TenantRunner;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Throwable;

/**
 * R8-7: per-tenant counts stored in the Control DB by a scheduled job. R8-3: queue health.
 */
class PlatformMetricsService
{
    public function __construct(
        private readonly TenantRunner $runner,
        private readonly TenantDatabaseManager $databases,
    ) {}

    public function refreshAll(): int
    {
        $tenants = Tenant::with('databaseConfig')->get();

        foreach ($tenants as $tenant) {
            $this->refreshTenant($tenant);
        }

        return $tenants->count();
    }

    public function refreshTenant(Tenant $tenant): void
    {
        $lastActivity = AuditLog::where('tenant_id', $tenant->id)->max('created_at');

        try {
            $counts = $this->runner->run($tenant, fn () => [
                'students_count' => Student::count(),
                'staff_count' => Staff::count(),
                'courses_count' => Course::count(),
            ]);

            $storageBytes = $this->runner->run($tenant, fn () => $this->databases->storageBytes($tenant));

            TenantMetricSnapshot::updateOrCreate(['tenant_id' => $tenant->id], [
                ...$counts,
                'storage_bytes' => $storageBytes,
                'last_activity_at' => $lastActivity,
                'status' => 'ok',
                'computed_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::warning('Platform metrics failed for tenant', ['tenant_id' => $tenant->id, 'error' => $e->getMessage()]);

            // Unknown stays unknown: never report zeroes for an unreachable tenant.
            TenantMetricSnapshot::updateOrCreate(['tenant_id' => $tenant->id], [
                'students_count' => null,
                'staff_count' => null,
                'courses_count' => null,
                'storage_bytes' => null,
                'last_activity_at' => $lastActivity,
                'status' => 'unavailable',
                'computed_at' => now(),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        $tenants = Tenant::orderBy('name')->get();
        $snapshots = TenantMetricSnapshot::whereIn('tenant_id', $tenants->pluck('id'))->get()->keyBy('tenant_id');

        return [
            'summary' => [
                'total_tenants' => $tenants->count(),
                'active_tenants' => $tenants->where('status', 'active')->count(),
                'suspended_tenants' => $tenants->where('status', 'suspended')->count(),
                'total_students' => $this->sumOrNull($snapshots, 'students_count'),
                'total_staff' => $this->sumOrNull($snapshots, 'staff_count'),
                'total_courses' => $this->sumOrNull($snapshots, 'courses_count'),
                'computed_at' => $snapshots->max('computed_at')?->toIso8601String(),
            ],
            'tenants' => $tenants->map(function (Tenant $tenant) use ($snapshots) {
                $snapshot = $snapshots->get($tenant->id);

                return [
                    'tenant_id' => $tenant->id,
                    'slug' => $tenant->slug,
                    'name' => $tenant->name,
                    'status' => $tenant->status,
                    'students_count' => $snapshot?->students_count,
                    'staff_count' => $snapshot?->staff_count,
                    'courses_count' => $snapshot?->courses_count,
                    'storage_bytes' => $snapshot?->storage_bytes,
                    'last_activity' => $snapshot?->last_activity_at?->toIso8601String(),
                    'metrics_status' => $snapshot?->status ?? 'not_computed',
                    'computed_at' => $snapshot?->computed_at?->toIso8601String(),
                ];
            })->values(),
            'queue' => $this->queueHealth(),
        ];
    }

    /**
     * @return array{pending: int|null, failed: int|null}
     */
    public function queueHealth(): array
    {
        try {
            $pending = Queue::size();
        } catch (Throwable) {
            $pending = null;
        }

        try {
            $failed = DB::table(config('queue.failed.table', 'failed_jobs'))->count();
        } catch (Throwable) {
            $failed = null;
        }

        return ['pending' => $pending, 'failed' => $failed];
    }

    private function sumOrNull($snapshots, string $column): ?int
    {
        $values = $snapshots->pluck($column)->filter(fn ($v) => $v !== null);

        return $values->isEmpty() ? null : (int) $values->sum();
    }
}
