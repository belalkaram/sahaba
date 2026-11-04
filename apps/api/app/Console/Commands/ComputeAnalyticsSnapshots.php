<?php

namespace App\Console\Commands;

use App\Jobs\ComputeStudentAnalytics;
use App\Models\Student;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * R8-3: nightly analytics. Queues one job per active student in every active tenant.
 */
class ComputeAnalyticsSnapshots extends Command
{
    protected $signature = 'lms:compute-analytics';

    protected $description = 'Queue analytics snapshot computation for all active students in all active tenants';

    public function handle(TenantRunner $runner): int
    {
        foreach (Tenant::where('status', 'active')->get() as $tenant) {
            try {
                $studentIds = $runner->run($tenant, fn () => Student::where('status', 'active')->pluck('id'));

                foreach ($studentIds as $studentId) {
                    ComputeStudentAnalytics::dispatch($tenant->id, $studentId);
                }
            } catch (Throwable $e) {
                Log::warning('Analytics scheduling failed for tenant', ['tenant_id' => $tenant->id, 'error' => $e->getMessage()]);
            }
        }

        return self::SUCCESS;
    }
}
