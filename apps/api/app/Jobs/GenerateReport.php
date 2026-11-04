<?php

namespace App\Jobs;

use App\Domain\Reporting\Services\ReportGenerationService;
use App\Models\ReportInstance;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * R8-5: report generation runs on the queue; the client polls GET /reports/{id}.
 */
class GenerateReport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $reportId,
    ) {}

    public function handle(TenantRunner $runner, ReportGenerationService $service): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $runner->run($tenant, function () use ($service) {
            $report = ReportInstance::find($this->reportId);
            if ($report) {
                $service->generate($report);
            }
        });
    }
}
