<?php

namespace App\Jobs;

use App\Domain\Analytics\Services\AnalyticsCalculationService;
use App\Models\Student;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * R8-3/R8-4: recomputes one student's snapshot. Unique per student for 5 minutes, which debounces
 * bursts such as a teacher recording attendance for a whole class.
 */
class ComputeStudentAnalytics implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $uniqueFor = 300;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $studentId,
    ) {}

    public function uniqueId(): string
    {
        return "{$this->tenantId}:{$this->studentId}";
    }

    public function handle(TenantRunner $runner, AnalyticsCalculationService $service): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $runner->run($tenant, function () use ($service) {
            $student = Student::find($this->studentId);
            if ($student) {
                $service->computeAllForStudent($student);
            }
        });
    }
}
