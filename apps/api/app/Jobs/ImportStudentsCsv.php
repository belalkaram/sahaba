<?php

namespace App\Jobs;

use App\Domain\Identity\Services\StudentImportService;
use App\Models\StudentImport;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * R8-3: CSV import runs on the queue; the client polls GET /imports/{id}.
 * One attempt only: a retry would re-create students from rows that already succeeded.
 */
class ImportStudentsCsv implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public int $timeout = 600;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $importId,
        public readonly string $path,
    ) {}

    public function handle(TenantRunner $runner, StudentImportService $service): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $runner->run($tenant, function () use ($service) {
            $import = StudentImport::find($this->importId);
            if ($import) {
                $service->process($import, $this->path);
            }
        });
    }
}
